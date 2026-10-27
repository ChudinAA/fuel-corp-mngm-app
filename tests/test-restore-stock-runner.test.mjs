import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const runnerPath = join(projectRoot, "scripts/test-restore-stock.mjs");

function createRunnerHarness(t) {
  const directory = mkdtempSync(join(tmpdir(), "restore-stock-runner-test-"));
  const binDirectory = join(directory, "bin");
  const poolLog = join(directory, "pool.log");
  const npxLog = join(directory, "npx.log");
  const loaderPath = join(directory, "loader.mjs");
  const mockDriverPath = join(directory, "mock-pg.mjs");
  const fakeNpxPath = join(binDirectory, "npx");

  t.after(() => rmSync(directory, { recursive: true, force: true }));

  writeFileSync(
    loaderPath,
    `import { pathToFileURL } from "node:url";
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "pg") {
    return { url: pathToFileURL(process.env.MOCK_DRIVER_PATH).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
`,
  );
  writeFileSync(
    mockDriverPath,
    `import { appendFileSync } from "node:fs";
function record(event) {
  appendFileSync(process.env.MOCK_POOL_LOG, JSON.stringify(event) + "\\n");
}
export class Pool {
  constructor(options) {
    record({ type: "connect", connectionString: options.connectionString });
  }
  async connect() {
    return {
      async query(sql, params = []) {
        record({ type: "query", sql, params });
        if (sql.includes("FROM pg_database")) {
          return { rows: JSON.parse(process.env.MOCK_DATABASES_JSON ?? "[]").map((datname) => ({ datname })) };
        }
        if (sql.includes("pg_try_advisory_lock")) {
          const active = JSON.parse(process.env.MOCK_ACTIVE_DATABASES_JSON ?? "[]");
          return { rows: [{ acquired: !active.includes(params[0]) }] };
        }
        return { rows: [] };
      },
      release() {
        record({ type: "release" });
      },
    };
  }
  async end() {
    record({ type: "end" });
  }
}
`,
  );

  mkdirSync(binDirectory, { recursive: true });
  writeFileSync(
    fakeNpxPath,
    `#!/bin/sh
printf '%s\\n' "$*" >> "$MOCK_NPX_LOG"
if [ "$MOCK_FAIL_SCHEMA_PREP" = "1" ] && [ "$1" = "drizzle-kit" ] && [ "$2" = "push" ]; then
  exit 23
fi
`,
  );
  chmodSync(fakeNpxPath, 0o755);

  function run(environment = {}) {
    const env = {
      ...process.env,
      ...environment,
      MOCK_DRIVER_PATH: mockDriverPath,
      MOCK_NPX_LOG: npxLog,
      MOCK_POOL_LOG: poolLog,
      NODE_OPTIONS: "",
      PATH: `${binDirectory}:${process.env.PATH ?? ""}`,
    };
    if (!Object.hasOwn(environment, "TEST_DATABASE_URL")) {
      delete env.TEST_DATABASE_URL;
    }
    const result = spawnSync(
      process.execPath,
      ["--no-warnings", "--experimental-loader", loaderPath, runnerPath],
      { cwd: projectRoot, encoding: "utf8", env, timeout: 10_000 },
    );

    assert.ifError(result.error);
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      poolEvents: existsSync(poolLog)
        ? readFileSync(poolLog, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line))
        : [],
      npxCalls: existsSync(npxLog) ? readFileSync(npxLog, "utf8").trim().split("\n").filter(Boolean) : [],
    };
  }

  return { run };
}

function appDatabaseEnvironment(testDatabaseUrl, variableName) {
  return {
    TEST_DATABASE_URL: testDatabaseUrl,
    DATABASE_URL: variableName === "DATABASE_URL" ? testDatabaseUrl : "postgres://user:pass@app.example/app",
    NEON_DATABASE_URL:
      variableName === "NEON_DATABASE_URL" ? testDatabaseUrl : "postgres://user:pass@neon.example/app",
  };
}

test("rejects a missing TEST_DATABASE_URL before connecting or running commands", (t) => {
  const { run } = createRunnerHarness(t);
  const result = run({
    DATABASE_URL: "postgres://user:pass@db.example/app",
    NEON_DATABASE_URL: "postgres://user:pass@neon.example/app",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /TEST_DATABASE_URL must point to a dedicated test database/);
  assert.deepEqual(result.poolEvents, []);
  assert.deepEqual(result.npxCalls, []);
});

for (const variableName of ["DATABASE_URL", "NEON_DATABASE_URL"]) {
  test(`rejects a TEST_DATABASE_URL matching ${variableName} before connecting or running commands`, (t) => {
    const { run } = createRunnerHarness(t);
    const target = "postgres://tester:secret@db.example:5432/app";
    const result = run(appDatabaseEnvironment(target, variableName));

    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`not the database configured by ${variableName}`));
    assert.deepEqual(result.poolEvents, []);
    assert.deepEqual(result.npxCalls, []);
  });
}

test("accepts a separate TEST_DATABASE_URL and runs the isolated test flow", (t) => {
  const { run } = createRunnerHarness(t);
  const result = run({
    TEST_DATABASE_URL: "postgres://tester:secret@test-db.example:5432/stock_test_admin",
    DATABASE_URL: "postgres://user:pass@db.example/app",
    NEON_DATABASE_URL: "postgres://user:pass@neon.example/app",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.poolEvents[0]?.type, "connect");
  assert.ok(result.poolEvents.some((event) => event.type === "query" && /^CREATE DATABASE "stock_test_/.test(event.sql)));
  assert.ok(result.poolEvents.some((event) => event.type === "query" && /^DROP DATABASE IF EXISTS "stock_test_/.test(event.sql)));
  assert.deepEqual(result.npxCalls, [
    "drizzle-kit push --force",
    "tsx --test tests/stock-restore-calculations.test.ts tests/refueling-restore-recalculation.test.ts tests/refueling-order-restore.test.ts tests/refueling-order-atomicity.test.ts tests/rollback-restore-atomicity.test.ts",
  ]);
});

test("does not start restoration tests when schema preparation fails", (t) => {
  const { run } = createRunnerHarness(t);
  const result = run({
    TEST_DATABASE_URL: "postgres://tester:secret@test-db.example:5432/stock_test_admin",
    DATABASE_URL: "postgres://user:pass@db.example/app",
    NEON_DATABASE_URL: "postgres://user:pass@neon.example/app",
    MOCK_FAIL_SCHEMA_PREP: "1",
  });

  assert.equal(result.status, 23, result.stderr || result.stdout);
  assert.deepEqual(result.npxCalls, ["drizzle-kit push --force"]);
  assert.ok(result.poolEvents.some((event) => event.type === "query" && /^DROP DATABASE IF EXISTS "stock_test_/.test(event.sql)));
});

test("removes only inactive databases matching the unique stock-test naming convention", (t) => {
  const { run } = createRunnerHarness(t);
  const staleDatabase = "stock_test_456_0123456789abcdef0123456789abcdef";
  const activeDatabase = "stock_test_789_abcdef0123456789abcdef0123456789";
  const malformedNames = [
    "stock_test_admin",
    "stock_test_123_ABCDEF0123456789ABCDEF0123456789",
    "stock_test_0_0123456789abcdef0123456789abcdef",
    "application",
  ];
  const result = run({
    TEST_DATABASE_URL: "postgres://tester:secret@test-db.example:5432/stock_test_admin",
    DATABASE_URL: "postgres://user:pass@db.example/app",
    NEON_DATABASE_URL: "postgres://user:pass@neon.example/app",
    MOCK_DATABASES_JSON: JSON.stringify([staleDatabase, activeDatabase, ...malformedNames]),
    MOCK_ACTIVE_DATABASES_JSON: JSON.stringify([activeDatabase]),
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const dropStatements = result.poolEvents
    .filter((event) => event.type === "query" && event.sql.startsWith("DROP DATABASE"))
    .map((event) => event.sql);
  assert.ok(dropStatements.some((sql) => sql === `DROP DATABASE IF EXISTS "${staleDatabase}"`));
  assert.ok(dropStatements.every((sql) => !sql.includes(activeDatabase)));
  assert.ok(malformedNames.every((name) => dropStatements.every((sql) => !sql.includes(name))));
  assert.match(result.stdout, new RegExp(`Leaving active test database ${activeDatabase}`));
});
