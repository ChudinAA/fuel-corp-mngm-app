import { spawn } from "node:child_process";
import { constants as osConstants } from "node:os";
import { randomUUID } from "node:crypto";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

let activeChild;
let receivedSignal;

function getDatabaseTarget(connectionString) {
  try {
    const url = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname) {
      throw new Error("not a PostgreSQL URL");
    }
    const port = url.port || "5432";
    const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    if (!database) {
      throw new Error("database name is missing");
    }
    return `${url.hostname.toLowerCase()}:${port}/${database}`;
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    activeChild = child;

    child.once("error", (error) => {
      activeChild = undefined;
      reject(new Error(`Could not start ${command}: ${error.message}`));
    });
    child.once("close", (code, signal) => {
      activeChild = undefined;
      if (receivedSignal) {
        const signalNumber = osConstants.signals[receivedSignal] ?? 0;
        reject(
          Object.assign(new Error(`Interrupted by ${receivedSignal}.`), {
            exitCode: 128 + signalNumber,
          }),
        );
      } else if (code !== 0) {
        reject(
          Object.assign(new Error(`${command} exited with status ${code ?? signal}.`), {
            exitCode: code ?? 1,
          }),
        );
      } else {
        resolve();
      }
    });
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    receivedSignal ??= signal;
    process.exitCode = 128 + (osConstants.signals[signal] ?? 0);
    activeChild?.kill(signal);
  });
}

async function main() {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL must point to a dedicated test database. The test suite will not use DATABASE_URL or NEON_DATABASE_URL as a fallback.",
    );
  }

  const testTarget = getDatabaseTarget(testDatabaseUrl);
  for (const variableName of ["DATABASE_URL", "NEON_DATABASE_URL"]) {
    const configuredUrl = process.env[variableName];
    if (configuredUrl && getDatabaseTarget(configuredUrl) === testTarget) {
      throw new Error(
        `TEST_DATABASE_URL must point to a separate database, not the database configured by ${variableName}.`,
      );
    }
  }

  const databaseName = `stock_test_${process.pid}_${randomUUID().replaceAll("-", "")}`;
  const testUrl = new URL(testDatabaseUrl);
  const existingOptions = testUrl.searchParams.get("options");
  testUrl.pathname = `/${databaseName}`;
  testUrl.searchParams.set(
    "options",
    [existingOptions, "-c search_path=public"].filter(Boolean).join(" "),
  );

  const testEnvironment = {
    ...process.env,
    DATABASE_URL: testUrl.toString(),
  };
  const adminPool = new Pool({ connectionString: testDatabaseUrl });
  const failures = [];
  let databaseCreated = false;

  try {
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
    console.log(`Preparing isolated test database ${databaseName} with the current application schema...`);
    if (receivedSignal) {
      throw Object.assign(new Error(`Interrupted by ${receivedSignal}.`), {
        exitCode: 128 + (osConstants.signals[receivedSignal] ?? 0),
      });
    }
    await run("npx", ["drizzle-kit", "push", "--force"], testEnvironment);

    console.log("Running stock restoration integration tests...");
    await run(
      "npx",
      [
        "tsx",
        "--test",
        "tests/stock-restore-calculations.test.ts",
        "tests/refueling-restore-recalculation.test.ts",
        "tests/refueling-order-restore.test.ts",
        "tests/refueling-order-atomicity.test.ts",
        "tests/rollback-restore-atomicity.test.ts",
      ],
      testEnvironment,
    );
  } catch (error) {
    failures.push(error);
  } finally {
    if (databaseCreated) {
      try {
        await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      } catch (error) {
        failures.push(
          new Error(`Could not clean up temporary database ${databaseName}.`, {
            cause: error,
          }),
        );
      }
    }
    try {
      await adminPool.end();
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length > 0) {
    for (const error of failures) {
      console.error(error);
    }
    const failureWithExitCode = failures.find((error) => error.exitCode);
    process.exitCode = failureWithExitCode?.exitCode ?? 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = error.exitCode ?? 1;
});
