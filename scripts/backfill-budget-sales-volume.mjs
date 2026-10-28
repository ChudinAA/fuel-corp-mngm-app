import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import pg from "pg";

const args = new Set(process.argv.slice(2));
const applyChanges = args.has("--apply");

if (!args.has("--target=development")) {
  throw new Error("Refusing to run without the explicit --target=development flag");
}
if (process.env.NODE_ENV !== "development") {
  throw new Error("This backfill only runs with NODE_ENV=development");
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  const { rows } = await client.query(`
    WITH source_sales AS (
      SELECT
        date_trunc('month', deal_date) AS month_start,
        CASE
          WHEN CAST(COALESCE(quantity_liters, '0') AS NUMERIC) > 0
            AND CAST(COALESCE(density, '0') AS NUMERIC) > 0
          THEN CAST(quantity_liters AS NUMERIC) * CAST(density AS NUMERIC) / 1000
          ELSE COALESCE(quantity_tonnes, CAST(quantity_kg AS NUMERIC) / 1000)
        END AS volume_tonnes
      FROM opt
      WHERE deleted_at IS NULL

      UNION ALL

      SELECT
        date_trunc('month', refueling_date) AS month_start,
        CASE
          WHEN CAST(COALESCE(quantity_liters, '0') AS NUMERIC) > 0
            AND CAST(COALESCE(density, '0') AS NUMERIC) > 0
          THEN CAST(quantity_liters AS NUMERIC) * CAST(density AS NUMERIC) / 1000
          ELSE COALESCE(quantity_tonnes, CAST(quantity_kg AS NUMERIC) / 1000)
        END AS volume_tonnes
      FROM aircraft_refueling
      WHERE deleted_at IS NULL
    ),
    monthly_sales AS (
      SELECT
        month_start,
        ROUND(COALESCE(SUM(volume_tonnes), 0), 5) AS total_volume_tonnes
      FROM source_sales
      GROUP BY month_start
    )
    SELECT
      budget.id::text AS id,
      budget.budget_month::text AS budget_month,
      budget.sales_volume AS old_sales_volume,
      COALESCE(monthly_sales.total_volume_tonnes, 0)::text AS new_sales_volume_tonnes,
      COALESCE(monthly_sales.total_volume_tonnes * 1000, 0)::text AS new_sales_volume_kg
    FROM budget_income_expense AS budget
    LEFT JOIN monthly_sales
      ON monthly_sales.month_start = date_trunc('month', budget.budget_month)
    WHERE budget.deleted_at IS NULL
    ORDER BY budget.budget_month
    FOR UPDATE OF budget
  `);

  let backupPath = null;
  if (applyChanges && rows.length > 0) {
    backupPath = join(
      tmpdir(),
      `budget-sales-volume-${new Date().toISOString().replaceAll(":", "-")}.json`,
    );
    await writeFile(
      backupPath,
      JSON.stringify(
        rows.map((row) => ({
          id: row.id,
          budgetMonth: row.budget_month,
          oldSalesVolume: row.old_sales_volume,
          newSalesVolumeTonnes: row.new_sales_volume_tonnes,
          newSalesVolumeKg: row.new_sales_volume_kg,
        })),
        null,
        2,
      ),
      { mode: 0o600 },
    );

    for (const row of rows) {
      await client.query(
        `UPDATE budget_income_expense
         SET sales_volume = $1,
             sales_volume_tonnes = $2
         WHERE id = $3 AND deleted_at IS NULL`,
        [row.new_sales_volume_kg, row.new_sales_volume_tonnes, row.id],
      );
    }
  }

  await client.query(applyChanges ? "COMMIT" : "ROLLBACK");
  console.log(JSON.stringify({
    target: "development",
    mode: applyChanges ? "applied" : "dry-run",
    activeBudgetRows: rows.length,
    rowsRecalculated: applyChanges ? rows.length : 0,
    backupPath,
  }));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
