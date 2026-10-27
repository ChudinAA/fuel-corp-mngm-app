import { withTemporaryPostgres } from "./lib/temporary-postgres.mjs";
import { runStockRestorationSuite } from "./lib/stock-restoration-suite.mjs";

withTemporaryPostgres(async ({ createDatabase, run }) => {
  const environment = await createDatabase("stock_restore");
  await runStockRestorationSuite(run, environment);
}).catch((error) => {
  console.error(error);
  process.exitCode = error.exitCode ?? 1;
});
