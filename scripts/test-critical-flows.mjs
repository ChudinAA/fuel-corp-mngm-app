import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import pg from "pg";

const { Pool } = pg;
const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const tempRoot = mkdtempSync(join(tmpdir(), "critical-flows-"));
const dataDir = join(tempRoot, "pgdata");
const socketDir = join(tempRoot, "socket");
mkdirSync(socketDir, { recursive: true });

let postgresStarted = false;
let appProcess;
let activeCommand;

function run(command, args, env = process.env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env,
      stdio: "inherit",
    });
    activeCommand = child;
    child.once("error", (error) => {
      activeCommand = undefined;
      reject(new Error(`Could not start ${command}: ${error.message}`));
    });
    child.once("close", (code, signal) => {
      activeCommand = undefined;
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`${command} exited with ${code ?? signal}.`));
      }
    });
  });
}

async function freePort() {
  const server = createServer();
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const port = server.address().port;
  await new Promise((resolvePromise, reject) =>
    server.close((error) => (error ? reject(error) : resolvePromise())),
  );
  return port;
}

function startApp(env) {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "server/index.ts"],
    { cwd: projectRoot, env, stdio: "inherit" },
  );
  appProcess = child;
  return child;
}

async function waitForApp(child, baseUrl) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Test application exited early with code ${child.exitCode}.`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/auth/user`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.status === 401) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("Timed out waiting for the isolated test application.");
}

async function stopApp() {
  const child = appProcess;
  appProcess = undefined;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolvePromise) => child.once("exit", resolvePromise)),
    new Promise((resolvePromise) =>
      setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
        resolvePromise();
      }, 5_000),
    ),
  ]);
}

async function main() {
  const databasePort = await freePort();
  const appPort = await freePort();
  const databaseUrl = `postgresql://postgres@127.0.0.1:${databasePort}/critical_flows`;
  const restoreAdminUrl = `postgresql://postgres@127.0.0.1:${databasePort}/restore_admin`;
  const adminDatabaseUrl = `postgresql://postgres@127.0.0.1:${databasePort}/postgres`;
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const testEmail = `flow-${randomUUID()}@example.test`;
  const testPassword = randomBytes(24).toString("base64url");
  const appEnv = {
    ...process.env,
    NODE_ENV: "development",
    PORT: String(appPort),
    DATABASE_URL: databaseUrl,
    NEON_DATABASE_URL: databaseUrl,
    STOCK_TEST_USE_STANDARD_POSTGRES: "true",
    SESSION_SECRET: randomBytes(32).toString("hex"),
    E2E_BASE_URL: baseUrl,
    E2E_ADMIN_EMAIL: testEmail,
    E2E_ADMIN_PASSWORD: testPassword,
  };

  try {
    console.log("Starting a disposable local PostgreSQL cluster...");
    await run("initdb", [
      "-D",
      dataDir,
      "-U",
      "postgres",
      "--auth-local=trust",
      "--auth-host=trust",
      "--no-instructions",
    ]);
    await run("pg_ctl", [
      "-D",
      dataDir,
      "-o",
      `-k ${socketDir} -p ${databasePort} -h 127.0.0.1`,
      "-w",
      "start",
    ]);
    postgresStarted = true;

    const adminPool = new Pool({ connectionString: adminDatabaseUrl });
    try {
      await adminPool.query("CREATE DATABASE critical_flows");
      await adminPool.query("CREATE DATABASE restore_admin");
    } finally {
      await adminPool.end();
    }

    console.log("Applying the current schema to the isolated app database...");
    await run("npx", ["drizzle-kit", "push", "--force"], appEnv);
    const appPool = new Pool({ connectionString: databaseUrl });
    try {
      await appPool.query(
        `INSERT INTO roles (name, description, permissions, is_default, is_system)
         VALUES ('Админ', 'Temporary critical-flow test role', ARRAY[]::text[], true, true)`,
      );
    } finally {
      await appPool.end();
    }

    console.log("Starting the app with a generated, isolated test account...");
    const child = startApp(appEnv);
    await waitForApp(child, baseUrl);
    await run(
      process.execPath,
      ["--test", "tests/critical-user-flows.test.mjs"],
      appEnv,
    );
    await stopApp();

    console.log("Running the existing stock restoration suite in a second disposable database...");
    await run("node", ["scripts/test-restore-stock.mjs"], {
      ...appEnv,
      TEST_DATABASE_URL: restoreAdminUrl,
    });
    console.log("Critical user-flow and stock-restoration tests passed.");
  } finally {
    await stopApp();
    activeCommand?.kill("SIGTERM");
    if (postgresStarted) {
      try {
        await run("pg_ctl", ["-D", dataDir, "-m", "fast", "-w", "stop"]);
      } catch (error) {
        console.error("Could not stop the disposable PostgreSQL cluster cleanly:", error);
      }
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
