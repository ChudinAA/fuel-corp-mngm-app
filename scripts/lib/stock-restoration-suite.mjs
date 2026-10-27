export async function runStockRestorationSuite(run, environment) {
  console.log("Preparing the current schema in the disposable stock database...");
  await run("npx", ["drizzle-kit", "push", "--force"], environment);
  console.log("Running stock restoration integration tests...");
  await run("npx", [
    "tsx", "--test",
    "tests/stock-restore-calculations.test.ts",
    "tests/refueling-restore-recalculation.test.ts",
    "tests/refueling-order-restore.test.ts",
    "tests/refueling-order-atomicity.test.ts",
    "tests/rollback-restore-atomicity.test.ts",
  ], environment);
}
