import { spawn } from "node:child_process";
import { constants, tmpdir } from "node:os";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import pg from "pg";

const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export async function freePort() {
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

/** Own the entire test server lifecycle; never connect to a configured app DB. */
export async function withTemporaryPostgres(callback) {
  const tempRoot = mkdtempSync(join(tmpdir(), "local-postgres-tests-"));
  const dataDir = join(tempRoot, "pgdata");
  const socketDir = join(tempRoot, "socket");
  mkdirSync(socketDir);
  let startAttempted = false;
  let activeChild;
  let receivedSignal;
  let cleanupFailed = false;

  const signalHandlers = new Map(
    ["SIGINT", "SIGTERM"].map((signal) => [
      signal,
      () => {
        receivedSignal ??= signal;
        activeChild?.kill(signal);
      },
    ]),
  );
  for (const [signal, handler] of signalHandlers) process.on(signal, handler);

  function run(command, args, env = process.env, cleaningUp = false) {
    if (receivedSignal && !cleaningUp) {
      return Promise.reject(Object.assign(new Error(`Interrupted by ${receivedSignal}.`), {
        exitCode: 128 + constants.signals[receivedSignal],
      }));
    }
    return new Promise((resolvePromise, reject) => {
      const child = spawn(command, args, { cwd: projectRoot, env, stdio: "inherit" });
      activeChild = child;
      child.once("error", (error) => {
        activeChild = undefined;
        reject(new Error(`Could not start ${command}: ${error.message}`));
      });
      child.once("close", (code, signal) => {
        activeChild = undefined;
        if (code === 0) resolvePromise();
        else reject(Object.assign(
          new Error(`${command} exited with ${code ?? signal}.`),
          { exitCode: code ?? 128 + (constants.signals[signal] ?? 0) },
        ));
      });
    });
  }

  try {
    const port = await freePort();
    console.log("Starting a disposable local PostgreSQL cluster...");
    await run("initdb", [
      "-D", dataDir, "-U", "postgres",
      "--auth-local=trust", "--auth-host=trust", "--no-instructions",
    ]);
    startAttempted = true;
    await run("pg_ctl", [
      "-D", dataDir, "-o", `-k ${socketDir} -p ${port} -h 127.0.0.1`,
      "-w", "start",
    ]);

    await callback({
      run,
      async createDatabase(name) {
        if (!/^[a-z][a-z0-9_]*$/.test(name)) {
          throw new Error("Invalid temporary database name.");
        }
        const baseUrl = `postgresql://postgres@127.0.0.1:${port}`;
        const pool = new pg.Pool({ connectionString: `${baseUrl}/postgres` });
        try {
          await pool.query(`CREATE DATABASE "${name}"`);
        } finally {
          await pool.end();
        }
        // Override both app connection settings; no external URL is accepted.
        return {
          ...process.env,
          DATABASE_URL: `${baseUrl}/${name}`,
          NEON_DATABASE_URL: `${baseUrl}/${name}`,
          STOCK_TEST_USE_STANDARD_POSTGRES: "true",
        };
      },
    });
    if (receivedSignal) {
      throw Object.assign(new Error(`Interrupted by ${receivedSignal}.`), {
        exitCode: 128 + constants.signals[receivedSignal],
      });
    }
  } finally {
    try {
      if (startAttempted) {
        try {
          await run("pg_ctl", ["-D", dataDir, "-m", "fast", "-w", "stop"], process.env, true);
        } catch (error) {
          cleanupFailed = true;
          throw new Error(`Could not stop temporary PostgreSQL; files retained at ${tempRoot}.`, {
            cause: error,
          });
        }
      }
    } finally {
      for (const [signal, handler] of signalHandlers) process.off(signal, handler);
      if (!cleanupFailed) rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}
