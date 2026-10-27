import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { freePort, withTemporaryPostgres } from "./lib/temporary-postgres.mjs";
import { runStockRestorationSuite } from "./lib/stock-restoration-suite.mjs";

const { Pool } = pg;
const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
let appProcess;

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

async function main({ createDatabase, run }) {
  const databaseEnvironment = await createDatabase("critical_flows");
  const appPort = await freePort();
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const testEmail = `flow-${randomUUID()}@example.test`;
  const testPassword = randomBytes(24).toString("base64url");
  const appEnv = {
    ...databaseEnvironment,
    NODE_ENV: "development",
    PORT: String(appPort),
    SESSION_SECRET: randomBytes(32).toString("hex"),
    E2E_BASE_URL: baseUrl,
    E2E_ADMIN_EMAIL: testEmail,
    E2E_ADMIN_PASSWORD: testPassword,
  };

  try {
    console.log("Applying the current schema to the isolated app database...");
    await run("npx", ["drizzle-kit", "push", "--force"], appEnv);
    const appPool = new Pool({ connectionString: appEnv.DATABASE_URL });
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
    const stockEnvironment = await createDatabase("stock_restore");
    await runStockRestorationSuite(run, stockEnvironment);
    console.log("Critical user-flow and stock-restoration tests passed.");
  } finally {
    await stopApp();
  }
}

withTemporaryPostgres(main).catch((error) => {
  console.error(error);
  process.exitCode = error.exitCode ?? 1;
});
