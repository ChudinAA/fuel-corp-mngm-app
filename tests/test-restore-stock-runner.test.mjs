import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const runnerPath = join(projectRoot, "scripts/test-restore-stock.mjs");

function createRunnerHarness(t) {
  const directory = mkdtempSync(join(tmpdir(), "local-stock-runner-test-"));
  const binDirectory = join(directory, "bin");
  const eventsPath = join(directory, "events.jsonl");
  const loaderPath = join(directory, "loader.mjs");
  const driverPath = join(directory, "mock-pg.mjs");
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(binDirectory);

  writeFileSync(loaderPath, `
import { pathToFileURL } from "node:url";
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "pg") {
    return { url: pathToFileURL(process.env.MOCK_DRIVER_PATH).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
`);
  writeFileSync(driverPath, `
import { appendFileSync } from "node:fs";
function record(event) {
  appendFileSync(process.env.MOCK_EVENTS, JSON.stringify(event) + "\\n");
}
class Pool {
  constructor(options) { record({ type: "connect", url: options.connectionString }); }
  async query(sql) { record({ type: "query", sql }); return { rows: [] }; }
  async end() { record({ type: "end" }); }
}
export default { Pool };
`);
  for (const name of ["initdb", "pg_ctl", "npx"]) {
    const path = join(binDirectory, name);
    writeFileSync(path, `#!/usr/bin/env node
const { appendFileSync } = require("node:fs");
const { basename } = require("node:path");
const command = basename(process.argv[1]);
const args = process.argv.slice(2);
appendFileSync(process.env.MOCK_EVENTS, JSON.stringify({
  type: "command", command, args,
  ...(command === "npx" ? {
    database: process.env.DATABASE_URL,
    standardPostgres: process.env.STOCK_TEST_USE_STANDARD_POSTGRES,
  } : {}),
}) + "\\n");
if (process.env.MOCK_FAIL === "initdb" && command === "initdb") process.exit(31);
if (process.env.MOCK_FAIL === "start" && command === "pg_ctl" && args.includes("start")) process.exit(32);
if (process.env.MOCK_FAIL === "stop" && command === "pg_ctl" && args.includes("stop")) process.exit(33);
if (process.env.MOCK_FAIL === "schema" && command === "npx" && args[0] === "drizzle-kit") process.exit(23);
if (process.env.MOCK_FAIL === "tests" && command === "npx" && args[0] === "tsx") process.exit(29);
if (process.env.MOCK_FAIL === "interrupt" && command === "npx" && args[0] === "drizzle-kit") {
  process.kill(process.ppid, "SIGTERM");
  setTimeout(() => process.exit(0), 5000);
}
`);
    chmodSync(path, 0o755);
  }

  return {
    run(environment = {}) {
      writeFileSync(eventsPath, "");
      const result = spawnSync(
        process.execPath,
        ["--no-warnings", "--experimental-loader", loaderPath, runnerPath],
        {
          cwd: projectRoot,
          encoding: "utf8",
          timeout: 15_000,
          env: {
            ...process.env,
            DATABASE_URL: "postgresql://unused@application.invalid/working_database",
            STOCK_TEST_USE_STANDARD_POSTGRES: "false",
            NODE_OPTIONS: "",
            PATH: `${binDirectory}:${process.env.PATH ?? ""}`,
            MOCK_DRIVER_PATH: driverPath,
            MOCK_EVENTS: eventsPath,
            ...environment,
          },
        },
      );
      assert.ifError(result.error);
      const events = readFileSync(eventsPath, "utf8").trim().split("\n")
        .filter(Boolean).map((line) => JSON.parse(line));
      const init = events.find((event) => event.command === "initdb");
      const root = dirname(init.args[init.args.indexOf("-D") + 1]);
      t.after(() => rmSync(root, { recursive: true, force: true }));
      return { ...result, events, root };
    },
  };
}

function commands(result, name) {
  return result.events.filter((event) => event.command === name);
}

function assertStoppedAndRemoved(result) {
  assert.ok(commands(result, "pg_ctl").some((event) => event.args.includes("stop")));
  assert.equal(existsSync(result.root), false);
}

test("stock tests always create a local cluster and ignore configured application databases", (t) => {
  const result = createRunnerHarness(t).run();
  assert.equal(result.status, 0, result.stderr);
  const start = commands(result, "pg_ctl").find((event) => event.args.includes("start"));
  assert.match(start.args[start.args.indexOf("-o") + 1], /-k .*socket -p \d+ -h 127\.0\.0\.1/);
  const connections = result.events.filter((event) => event.type === "connect");
  assert.equal(connections.length, 1);
  assert.match(connections[0].url, /^postgresql:\/\/postgres@127\.0\.0\.1:\d+\/postgres$/);
  assert.deepEqual(result.events.filter((event) => event.type === "query").map((event) => event.sql), [
    'CREATE DATABASE "stock_restore"',
  ]);
  const calls = commands(result, "npx");
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].args, ["drizzle-kit", "push", "--force"]);
  assert.deepEqual(calls[1].args, [
    "tsx", "--test",
    "tests/stock-restore-calculations.test.ts",
    "tests/refueling-restore-recalculation.test.ts",
    "tests/refueling-order-restore.test.ts",
    "tests/refueling-order-atomicity.test.ts",
    "tests/rollback-restore-atomicity.test.ts",
  ]);
  for (const call of calls) {
    assert.match(call.database, /^postgresql:\/\/postgres@127\.0\.0\.1:\d+\/stock_restore$/);
    assert.equal(call.standardPostgres, "true");
  }
  assertStoppedAndRemoved(result);
});

test("schema failure skips the suite and still removes the local cluster", (t) => {
  const result = createRunnerHarness(t).run({ MOCK_FAIL: "schema" });
  assert.equal(result.status, 23);
  assert.equal(commands(result, "npx").length, 1);
  assertStoppedAndRemoved(result);
});

test("suite failure preserves its exit code and removes the local cluster", (t) => {
  const result = createRunnerHarness(t).run({ MOCK_FAIL: "tests" });
  assert.equal(result.status, 29);
  assertStoppedAndRemoved(result);
});

test("interruption stops the cluster and keeps the signal exit code", (t) => {
  const result = createRunnerHarness(t).run({ MOCK_FAIL: "interrupt" });
  assert.equal(result.status, 143);
  assert.equal(commands(result, "npx").length, 1);
  assertStoppedAndRemoved(result);
});

test("initialization failure never connects to PostgreSQL or runs the suite", (t) => {
  const result = createRunnerHarness(t).run({ MOCK_FAIL: "initdb" });
  assert.equal(result.status, 31);
  assert.equal(commands(result, "pg_ctl").length, 0);
  assert.equal(commands(result, "npx").length, 0);
  assert.ok(!result.events.some((event) => event.type === "connect"));
  assert.equal(existsSync(result.root), false);
});

test("startup failure attempts cleanup without connecting to any database", (t) => {
  const result = createRunnerHarness(t).run({ MOCK_FAIL: "start" });
  assert.equal(result.status, 32);
  assert.ok(!result.events.some((event) => event.type === "connect"));
  assertStoppedAndRemoved(result);
});

test("each run owns a different temporary data directory", (t) => {
  const harness = createRunnerHarness(t);
  const first = harness.run();
  const second = harness.run();
  assert.equal(first.status, 0);
  assert.equal(second.status, 0);
  assert.notEqual(first.root, second.root);
  assertStoppedAndRemoved(first);
  assertStoppedAndRemoved(second);
});

test("shutdown failure is reported and never deletes a potentially live data directory", (t) => {
  const result = createRunnerHarness(t).run({ MOCK_FAIL: "stop" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Could not stop temporary PostgreSQL; files retained/);
  assert.equal(existsSync(result.root), true);
});
