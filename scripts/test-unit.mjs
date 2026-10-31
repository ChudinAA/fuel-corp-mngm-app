import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const testRoots = ["client/src", "server/modules", "shared", "tests"];
const integrationOwnedTests = new Set([
  "tests/critical-user-flows.test.mjs",
  "tests/1c-integration-api.test.mjs",
  "tests/sse-recalculation.test.mjs",
  "tests/planning-logistics-flow.test.mjs",
  "tests/ui-core-pages.test.mjs",
  "tests/refueling-order-atomicity.test.ts",
  "tests/refueling-order-restore.test.ts",
  "tests/refueling-restore-recalculation.test.ts",
  "tests/rollback-restore-atomicity.test.ts",
  "tests/stock-restore-calculations.test.ts",
]);
const directDatabaseImport =
  /\bfrom\s*["'][^"']*(?:server\/db|server\/db\.ts)["']/;

async function listTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTestFiles(path)));
    } else if (entry.isFile() && /\.test\.(?:ts|tsx|js|mjs)$/.test(entry.name)) {
      files.push(path);
    }
  }

  return files;
}

const testFiles = [];
for (const root of testRoots) {
  testFiles.push(...(await listTestFiles(resolve(projectRoot, root))));
}

const unitFiles = [];
for (const absolutePath of testFiles.sort()) {
  const relativePath = relative(projectRoot, absolutePath).split(sep).join("/");
  if (integrationOwnedTests.has(relativePath)) continue;

  const source = await readFile(absolutePath, "utf8");
  if (directDatabaseImport.test(source)) {
    throw new Error(
      `Database-backed test is not classified into the isolated integration suite: ${relativePath}`,
    );
  }

  unitFiles.push(absolutePath);
}

if (unitFiles.length === 0) {
  throw new Error("No unit test files were discovered.");
}

console.log(`Running ${unitFiles.length} unit test files with database access disabled.`);
console.log(`Database-backed scenarios are handled by the isolated critical-flow runner.`);

const env = {
  ...process.env,
  DATABASE_URL: "postgresql://postgres@127.0.0.1:1/unit_tests_must_not_connect",
  STOCK_TEST_USE_STANDARD_POSTGRES: "true",
  NODE_ENV: "test",
};
delete env.MASS_UNIT_PROD_URL;

const child = spawn(
  process.execPath,
  [
    "--import",
    "tsx",
    "--test",
    "--test-concurrency=1",
    ...unitFiles,
  ],
  { cwd: projectRoot, env, stdio: "inherit" },
);

child.once("error", (error) => {
  console.error(`Could not start unit tests: ${error.message}`);
  process.exitCode = 1;
});

child.once("close", (code, signal) => {
  process.exitCode =
    code ?? (signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1);
});
