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
  const mockDriverPath = join(directory, "mock-neon.mjs");
  const fakeNpxPath = join(binDirectory, "npx");

  t.after(() => rmSync(directory, { recursive: true, force: true }));

  writeFileSync(
    loaderPath,
    `import { pathToFileURL } from "node:url";
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@neondatabase/serverless") {
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
export const neonConfig = {};
export class Pool {
  constructor(options) {
    record({ type: "connect", connectionString: options.connectionString });
  }
  async query(sql) {
    record({ type: "query", sql });
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
  assert.match(result.poolEvents[1]?.sql ?? "", /^CREATE DATABASE "stock_test_/);
  assert.ok(result.poolEvents.some((event) => event.type === "query" && /^DROP DATABASE IF EXISTS "stock_test_/.test(event.sql)));
  assert.ok(result.npxCalls.some((args) => args.includes("drizzle-kit push --force")));
  assert.ok(result.npxCalls.some((args) => args.includes("tsx --test")));
});
