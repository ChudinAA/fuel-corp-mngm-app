import { spawnSync } from "node:child_process";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  console.error(
    "TEST_DATABASE_URL must point to a dedicated test database. The test suite will not use DATABASE_URL or NEON_DATABASE_URL as a fallback.",
  );
  process.exit(1);
}

function getDatabaseTarget(connectionString) {
  try {
    const url = new URL(connectionString);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
}

const testTarget = getDatabaseTarget(testDatabaseUrl);
for (const variableName of ["DATABASE_URL", "NEON_DATABASE_URL"]) {
  const configuredUrl = process.env[variableName];
  if (configuredUrl && getDatabaseTarget(configuredUrl) === testTarget) {
    console.error(
      `TEST_DATABASE_URL must point to a separate database, not the database configured by ${variableName}.`,
    );
    process.exit(1);
  }
}

const testEnvironment = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
};

function run(command, args) {
  const result = spawnSync(command, args, {
    env: testEnvironment,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`Could not start ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Preparing the isolated test database with the current application schema...");
run("npx", ["drizzle-kit", "push", "--force"]);

console.log("Running stock restoration integration tests...");
run("npx", [
  "tsx",
  "--test",
  "tests/stock-restore-calculations.test.ts",
  "tests/refueling-restore-recalculation.test.ts",
  "tests/refueling-order-restore.test.ts",
  "tests/refueling-order-atomicity.test.ts",
]);
