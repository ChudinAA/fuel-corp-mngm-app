import { existsSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { withTemporaryPostgres } from "./lib/temporary-postgres.mjs";

const { Pool } = pg;
const dumpPath = process.env.MASS_UNIT_DUMP_PATH;

if (!dumpPath || !existsSync(dumpPath)) {
  throw new Error("Set MASS_UNIT_DUMP_PATH to an existing compressed SQL dump.");
}

const expectedTables = [
  "opt",
  "aircraft_refueling",
  "transportation",
  "movement",
  "refueling_abroad",
  "equipment_movement",
  "warehouses",
  "warehouse_transactions",
  "equipments",
  "equipment_transactions",
  "plan_entries",
  "free_volume_allocations",
  "supplier_allocated_volumes",
  "planning_top_level_volumes",
  "logistics_vehicles",
  "logistics_trailers",
  "prices",
  "budget_income_expense",
];

const fields = [
  ["opt", "quantity_kg", "mass_kg"],
  ["aircraft_refueling", "quantity_kg", "mass_kg"],
  ["transportation", "quantity_kg", "mass_kg"],
  ["movement", "quantity_kg", "mass_kg"],
  ["refueling_abroad", "quantity_kg", "mass_kg"],
  ["equipment_movement", "quantity_kg", "mass_kg"],
  ["warehouse_transactions", "quantity", "mass_kg"],
  ["warehouse_transactions", "balance_before", "mass_kg"],
  ["warehouse_transactions", "balance_after", "mass_kg"],
  ["warehouses", "current_balance", "mass_kg"],
  ["warehouses", "pvkj_balance", "mass_kg"],
  ["warehouses", "limit_volume", "mass_kg"],
  ["equipment_transactions", "quantity", "mass_kg"],
  ["equipment_transactions", "balance_before", "mass_kg"],
  ["equipment_transactions", "balance_after", "mass_kg"],
  ["equipments", "current_balance", "mass_kg"],
  ["equipments", "pvkj_balance", "mass_kg"],
  ["plan_entries", "volume", "mass_kg"],
  ["plan_entries", "balance_after", "mass_kg"],
  ["free_volume_allocations", "volume", "mass_kg"],
  ["supplier_allocated_volumes", "volume", "mass_kg"],
  ["planning_top_level_volumes", "volume", "mass_kg"],
  ["logistics_vehicles", "capacity_kg", "mass_kg"],
  ["logistics_trailers", "capacity_kg", "mass_kg"],
  ["delivery_cost", "cost_per_kg", "rate_per_kg"],
  ["warehouse_transactions", "average_cost_before", "rate_per_kg"],
  ["warehouse_transactions", "average_cost_after", "rate_per_kg"],
  ["warehouse_transactions", "price", "rate_per_kg"],
  ["warehouses", "average_cost", "rate_per_kg"],
  ["warehouses", "pvkj_average_cost", "rate_per_kg"],
  ["movement", "cost_per_kg", "rate_per_kg"],
];

const conditionalFields = [
  ["prices", "volume", "legacy kg volume limit when limit_type=volume; ignored for amount limits"],
  ["prices", "sold_volume", "legacy kg consumed mass"],
];

const unmappedLegacyFields = [
  ["exchange", "quantity_kg", "legacy table not present in current app schema"],
  ["exchange", "price_per_kg", "legacy table not present in current app schema"],
];

const densitySources = [
  "opt",
  "aircraft_refueling",
  "transportation",
  "movement",
  "refueling_abroad",
  "equipment_movement",
];

const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
const qualifiedTable = (table) => `${quoteIdentifier("public")}.${quoteIdentifier(table)}`;

function hasColumns(columnMap, table, names) {
  return names.every((name) => columnMap.has(`${table}.${name}`));
}

async function profileField(client, table, column) {
  const result = await client.query(`
    SELECT
      COUNT(*)::bigint AS rows_total,
      COUNT(*) FILTER (WHERE ${quoteIdentifier(column)} IS NULL)::bigint AS null_rows,
      COUNT(*) FILTER (WHERE ${quoteIdentifier(column)} < 0)::bigint AS negative_rows,
      COUNT(*) FILTER (WHERE ${quoteIdentifier(column)} = 0)::bigint AS zero_rows,
      MIN(${quoteIdentifier(column)})::text AS min_value,
      MAX(${quoteIdentifier(column)})::text AS max_value
    FROM ${qualifiedTable(table)}
  `);
  return { field: `${table}.${column}`, ...result.rows[0] };
}

async function financialTotals(client, columnMap) {
  const relevantTables = new Set(fields.map(([table]) => table));
  const financialColumns = [...columnMap.values()].filter((column) =>
    relevantTables.has(column.table_name)
    && column.data_type === "numeric"
    && /(amount|sum|profit|revenue|total_cost|delivery_cost)$/i.test(column.column_name),
  );

  const totals = new Map();
  for (const column of financialColumns) {
    const result = await client.query(`
      SELECT COUNT(*)::bigint AS rows_total, SUM(${quoteIdentifier(column.column_name)})::text AS total
      FROM ${qualifiedTable(column.table_name)}
    `);
    totals.set(`${column.table_name}.${column.column_name}`, result.rows[0]);
  }
  return totals;
}

async function profilePriceValues(client, columnMap) {
  if (!hasColumns(columnMap, "prices", ["price_unit", "price_values"])) {
    return {
      report: {
        skipped: true,
        reason: "prices.price_unit or prices.price_values missing",
      },
      rates: [],
    };
  }

  const rows = await client.query(
    "SELECT price_unit, price_values FROM prices",
  );
  const report = {
    priceRows: rows.rowCount,
    unitRows: {},
    missingUnitRows: 0,
    nullArrays: 0,
    emptyArrays: 0,
    totalRateEntries: 0,
    malformedJsonEntries: 0,
    missingPriceEntries: 0,
    missingPriceShapes: {},
    missingPriceShapesByUnit: {},
    nonNumericPriceEntries: 0,
    unknownUnitRows: 0,
    entriesWithAdditionalProperties: 0,
    validRateEntriesByUnit: { kg: 0, tonne: 0, liter: 0 },
  };
  const rawRateEntries = [];

  for (const row of rows.rows) {
    const originalUnit = row.price_unit;
    const unit = originalUnit ?? "kg";
    const unitKey = originalUnit ?? "<null>";
    report.unitRows[unitKey] = (report.unitRows[unitKey] ?? 0) + 1;
    if (originalUnit == null) report.missingUnitRows += 1;
    if (!["kg", "tonne", "liter"].includes(unit)) {
      report.unknownUnitRows += 1;
    }

    if (row.price_values == null) {
      report.nullArrays += 1;
      continue;
    }
    if (!Array.isArray(row.price_values) || row.price_values.length === 0) {
      report.emptyArrays += 1;
      continue;
    }

    for (const rawValue of row.price_values) {
      report.totalRateEntries += 1;
      let parsed;
      try {
        parsed = JSON.parse(rawValue);
      } catch {
        report.malformedJsonEntries += 1;
        continue;
      }
      if (
        !parsed
        || typeof parsed !== "object"
        || Array.isArray(parsed)
        || !Object.prototype.hasOwnProperty.call(parsed, "price")
      ) {
        report.missingPriceEntries += 1;
        const shape = parsed === null
          ? "null"
          : Array.isArray(parsed)
            ? `array(${parsed.length})`
            : typeof parsed !== "object"
              ? typeof parsed
              : Object.keys(parsed).sort().join(",") || "{}";
        report.missingPriceShapes[shape] =
          (report.missingPriceShapes[shape] ?? 0) + 1;
        const shapesForUnit = report.missingPriceShapesByUnit[unitKey] ?? {};
        shapesForUnit[shape] = (shapesForUnit[shape] ?? 0) + 1;
        report.missingPriceShapesByUnit[unitKey] = shapesForUnit;
        continue;
      }
      if (Object.keys(parsed).length > 1) {
        report.entriesWithAdditionalProperties += 1;
      }
      rawRateEntries.push({ unit, rawValue });
    }
  }

  if (rawRateEntries.length > 0) {
    const extracted = await client.query(
      `
        SELECT source_unit, raw_value::jsonb ->> 'price' AS rate_text
        FROM unnest($1::text[], $2::text[])
          AS entries(source_unit, raw_value)
      `,
      [
        rawRateEntries.map((entry) => entry.unit),
        rawRateEntries.map((entry) => entry.rawValue),
      ],
    );
    for (const entry of extracted.rows) {
      const rateText = entry.rate_text;
      if (
        typeof rateText !== "string"
        || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(rateText.trim())
      ) {
        report.nonNumericPriceEntries += 1;
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(report.validRateEntriesByUnit, entry.source_unit)) {
        continue;
      }
      report.validRateEntriesByUnit[entry.source_unit] += 1;
    }

    const invalidCount =
      report.malformedJsonEntries
      + report.missingPriceEntries
      + report.nonNumericPriceEntries;
    let validIndex = 0;
    for (const entry of extracted.rows) {
      const rateText = entry.rate_text;
      const validNumeric =
        typeof rateText === "string"
        && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(rateText.trim());
      const knownUnit = Object.prototype.hasOwnProperty.call(
        report.validRateEntriesByUnit,
        entry.source_unit,
      );
      if (validNumeric && knownUnit) {
        rawRateEntries[validIndex] = {
          unit: entry.source_unit,
          rateText: rateText.trim(),
        };
        validIndex += 1;
      }
    }
    rawRateEntries.length = validIndex;
    report.safeForAutomaticRateConversion =
      invalidCount === 0 && report.unknownUnitRows === 0 && report.missingUnitRows === 0;
  } else {
    report.safeForAutomaticRateConversion =
      report.malformedJsonEntries === 0
      && report.missingPriceEntries === 0
      && report.nonNumericPriceEntries === 0
      && report.unknownUnitRows === 0
      && report.missingUnitRows === 0;
  }

  return { report, rates: rawRateEntries };
}

async function rehearsePriceValues(client, rates) {
  await client.query(`
    CREATE TEMP TABLE __price_value_rehearsal (
      source_unit text NOT NULL,
      source_rate numeric NOT NULL,
      target_rate numeric NOT NULL,
      round_trip_rate numeric NOT NULL
    ) ON COMMIT DROP
  `);

  if (rates.length > 0) {
    await client.query(
      `
        INSERT INTO __price_value_rehearsal
          (source_unit, source_rate, target_rate, round_trip_rate)
        SELECT
          source_unit,
          rate_text::numeric,
          CASE WHEN source_unit = 'kg' THEN rate_text::numeric * 1000
            ELSE rate_text::numeric END,
          CASE WHEN source_unit = 'kg'
            THEN (rate_text::numeric * 1000) / 1000
            ELSE rate_text::numeric END
        FROM unnest($1::text[], $2::text[])
          AS entries(source_unit, rate_text)
      `,
      [rates.map((rate) => rate.unit), rates.map((rate) => rate.rateText)],
    );
  }

  const result = await client.query(`
    SELECT
      COUNT(*)::bigint AS rate_entries,
      COUNT(*) FILTER (WHERE source_unit = 'kg')::bigint AS kg_rates_converted,
      COUNT(*) FILTER (WHERE source_unit = 'liter')::bigint AS liter_rates_preserved,
      COUNT(*) FILTER (WHERE source_unit = 'tonne')::bigint AS tonne_rates_preserved,
      COUNT(*) FILTER (WHERE source_rate <> round_trip_rate)::bigint
        AS round_trip_differences
    FROM __price_value_rehearsal
  `);
  const summary = result.rows[0];
  if (Number(summary.round_trip_differences) !== 0) {
    throw new Error("Price-rate conversion rehearsal failed.");
  }
  return {
    ...summary,
    note: "kg rates are multiplied by 1000; litre and tonne rates remain unchanged",
  };
}

await withTemporaryPostgres(async ({ run, createDatabase }) => {
  const databaseEnvironment = await createDatabase("mass_unit_rehearsal");
  const isolatedDumpPath = resolve(dumpPath);
  await run(
    "bash",
    [
      "-o",
      "pipefail",
      "-c",
      'gzip -dc -- "$MASS_UNIT_DUMP_PATH" | psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1',
    ],
    { ...databaseEnvironment, MASS_UNIT_DUMP_PATH: isolatedDumpPath },
  );

  const pool = new Pool({ connectionString: databaseEnvironment.DATABASE_URL });
  const client = await pool.connect();
  try {
    const tableResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const actualTables = tableResult.rows.map((row) => row.table_name);

    const columnResult = await client.query(`
      SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `);
    const columnMap = new Map(
      columnResult.rows.map((row) => [`${row.table_name}.${row.column_name}`, row]),
    );

    const availableFields = fields.filter(([table, column]) =>
      columnMap.has(`${table}.${column}`),
    );
    const missingFields = fields
      .filter(([table, column]) => !columnMap.has(`${table}.${column}`))
      .map(([table, column]) => `${table}.${column}`);
    const priceUnitColumns = [
      "limit_type",
      "price_unit",
      "volume",
      "sold_volume",
      "max_deal_amount",
    ].map((column) => ({
      column,
      present: columnMap.has(`prices.${column}`),
      ...(columnMap.has(`prices.${column}`)
        ? {
            data_type: columnMap.get(`prices.${column}`).data_type,
            numeric_precision: columnMap.get(`prices.${column}`).numeric_precision,
            numeric_scale: columnMap.get(`prices.${column}`).numeric_scale,
          }
        : {}),
    }));

    const profile = [];
    for (const [table, column] of availableFields) {
      const schema = columnMap.get(`${table}.${column}`);
      const stats = await profileField(client, table, column);
      profile.push({
        ...stats,
        data_type: schema.data_type,
        numeric_precision: schema.numeric_precision,
        numeric_scale: schema.numeric_scale,
      });
    }

    const conditionalProfile = [];
    for (const [table, column, note] of conditionalFields) {
      if (columnMap.has(`${table}.${column}`)) {
        conditionalProfile.push({
          ...(await profileField(client, table, column)),
          note,
        });
      } else {
        conditionalProfile.push({ field: `${table}.${column}`, missing: true, note });
      }
    }

    const legacyProfile = [];
    for (const [table, column, note] of unmappedLegacyFields) {
      if (columnMap.has(`${table}.${column}`)) {
        legacyProfile.push({
          ...(await profileField(client, table, column)),
          note,
        });
      } else {
        legacyProfile.push({ field: `${table}.${column}`, missing: true, note });
      }
    }

    const densityComparison = [];
    for (const table of densitySources) {
      if (!hasColumns(columnMap, table, ["quantity_kg", "quantity_liters", "density"])) {
        densityComparison.push({ table, skipped: true, reason: "one or more columns missing" });
        continue;
      }
      const hasDraft = columnMap.has(`${table}.is_draft`);
      const hasDeleted = columnMap.has(`${table}.deleted_at`);
      const draftExpr = hasDraft ? "COALESCE(is_draft, false)" : "false";
      const deletedExpr = hasDeleted ? "deleted_at IS NOT NULL" : "false";
      const result = await client.query(`
        SELECT
          COUNT(*)::bigint AS comparable_rows,
          COUNT(*) FILTER (
            WHERE ABS(quantity_kg - quantity_liters * density) > 0.005
          )::bigint AS over_half_step_kg,
          MAX(ABS(quantity_kg - quantity_liters * density))::text AS max_delta_kg,
          COUNT(*) FILTER (
            WHERE ABS(quantity_kg - quantity_liters * density) > 0.005
              AND ${draftExpr}
          )::bigint AS draft_discrepancies,
          COUNT(*) FILTER (
            WHERE ABS(quantity_kg - quantity_liters * density) > 0.005
              AND ${deletedExpr}
          )::bigint AS deleted_discrepancies,
          COUNT(*) FILTER (
            WHERE ABS(quantity_kg - quantity_liters * density) > 0.005
              AND NOT ${draftExpr}
              AND NOT ${deletedExpr}
          )::bigint AS active_discrepancies,
          MAX(ABS(quantity_kg - quantity_liters * density)) FILTER (
            WHERE NOT ${draftExpr} AND NOT ${deletedExpr}
          )::text AS max_active_delta_kg
        FROM ${qualifiedTable(table)}
        WHERE quantity_kg IS NOT NULL
          AND quantity_liters > 0
          AND density > 0
      `);
      densityComparison.push({
        table,
        hasDraftFlag: hasDraft,
        hasDeletedFlag: hasDeleted,
        ...result.rows[0],
      });
    }

    const perLiterDealDensityCoverage = [];
    for (const table of densitySources) {
      if (
        !hasColumns(columnMap, table, [
          "id", "quantity_kg", "quantity_liters", "density", "deleted_at",
        ])
        || !hasColumns(columnMap, "prices", ["id", "price_unit"])
      ) {
        perLiterDealDensityCoverage.push({
          table,
          skipped: true,
          reason: "transaction or price-unit columns missing",
        });
        continue;
      }
      const draftFilter = columnMap.has(`${table}.is_draft`)
        ? "AND COALESCE(t.is_draft, false) = false"
        : "";
      const priceLinkColumns = ["sale_price_id", "purchase_price_id"]
        .filter((column) => columnMap.has(`${table}.${column}`));
      if (priceLinkColumns.length === 0) {
        perLiterDealDensityCoverage.push({
          table,
          skipped: true,
          reason: "price reference columns missing",
        });
        continue;
      }
      for (const priceColumn of priceLinkColumns) {
        const result = await client.query(`
          SELECT
            COUNT(DISTINCT t.id)::bigint AS active_liter_price_rows,
            COUNT(DISTINCT t.id) FILTER (
              WHERE t.quantity_liters > 0 AND t.density > 0
            )::bigint AS rows_with_density,
            COUNT(DISTINCT t.id) FILTER (
              WHERE t.quantity_kg IS NOT NULL
                AND t.quantity_liters > 0
                AND t.density > 0
                AND ABS(t.quantity_kg - t.quantity_liters * t.density) > 0.005
            )::bigint AS rows_over_half_step,
            MAX(ABS(t.quantity_kg - t.quantity_liters * t.density))::text
              AS max_delta_kg
          FROM ${qualifiedTable(table)} t
          INNER JOIN ${qualifiedTable("prices")} p
            ON p.id = t.${quoteIdentifier(priceColumn)}
          WHERE t.deleted_at IS NULL
            ${draftFilter}
            AND p.price_unit = 'liter'
        `);
        perLiterDealDensityCoverage.push({
          table,
          priceReference: priceColumn,
          ...result.rows[0],
        });
      }
    }

    const zeroMassStatus = [];
    for (const table of [
      "opt",
      "aircraft_refueling",
      "transportation",
      "movement",
      "refueling_abroad",
      "equipment_movement",
    ]) {
      if (!columnMap.has(`${table}.quantity_kg`)) {
        zeroMassStatus.push({ table, skipped: true, reason: "quantity_kg missing" });
        continue;
      }
      const hasDraft = columnMap.has(`${table}.is_draft`);
      const hasDeleted = columnMap.has(`${table}.deleted_at`);
      const draftExpr = hasDraft ? "COALESCE(is_draft, false)" : "false";
      const deletedExpr = hasDeleted ? "deleted_at IS NOT NULL" : "false";
      const result = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE quantity_kg = 0)::bigint AS zero_rows,
          COUNT(*) FILTER (
            WHERE quantity_kg = 0 AND ${draftExpr}
          )::bigint AS draft_zero_rows,
          COUNT(*) FILTER (
            WHERE quantity_kg = 0 AND ${deletedExpr}
          )::bigint AS deleted_zero_rows,
          COUNT(*) FILTER (
            WHERE quantity_kg = 0
              AND NOT ${draftExpr}
              AND NOT ${deletedExpr}
          )::bigint AS active_zero_rows
        FROM ${qualifiedTable(table)}
      `);
      zeroMassStatus.push({
        table,
        hasDraftFlag: hasDraft,
        hasDeletedFlag: hasDeleted,
        ...result.rows[0],
      });
    }

    let warehouseBalanceReconciliation = {
      skipped: true,
      reason: "required warehouse/history columns missing",
    };
    if (
      hasColumns(columnMap, "warehouses", ["id", "current_balance", "pvkj_balance", "deleted_at"])
      && hasColumns(columnMap, "warehouse_transactions", [
        "warehouse_id", "product_type", "balance_after", "transaction_date", "created_at", "id", "deleted_at",
      ])
    ) {
      const result = await client.query(`
        WITH balance_slots AS (
          SELECT id AS warehouse_id, 'kerosene'::text AS product_type, current_balance AS snapshot
          FROM warehouses
          WHERE deleted_at IS NULL
          UNION ALL
          SELECT id, 'pvkj'::text, pvkj_balance
          FROM warehouses
          WHERE deleted_at IS NULL
        ),
        latest AS (
          SELECT DISTINCT ON (warehouse_id, product_type)
            warehouse_id, product_type, balance_after
          FROM warehouse_transactions
          WHERE deleted_at IS NULL
          ORDER BY
            warehouse_id,
            product_type,
            transaction_date DESC NULLS LAST,
            created_at DESC NULLS LAST,
            id DESC
        )
        SELECT
          COUNT(*)::bigint AS balance_slots,
          COUNT(*) FILTER (WHERE latest.warehouse_id IS NULL)::bigint AS without_history,
          COUNT(*) FILTER (
            WHERE latest.warehouse_id IS NOT NULL
              AND balance_slots.snapshot IS NOT NULL
              AND latest.balance_after IS NOT NULL
              AND ABS(balance_slots.snapshot - latest.balance_after) > 0.01
          )::bigint AS mismatched_slots,
          MAX(ABS(balance_slots.snapshot - latest.balance_after))::text AS max_abs_difference_kg
        FROM balance_slots
        LEFT JOIN latest USING (warehouse_id, product_type)
      `);
      warehouseBalanceReconciliation = result.rows[0];
    }

    let priceUnits = { skipped: true, reason: "unit/limit columns missing" };
    if (hasColumns(columnMap, "prices", [
      "limit_type", "price_unit", "volume", "sold_volume", "max_deal_amount",
    ])) {
      const result = await client.query(`
        SELECT
          limit_type,
          price_unit,
          COUNT(*)::bigint AS price_rows,
          COUNT(*) FILTER (WHERE volume IS NOT NULL)::bigint AS rows_with_volume,
          MIN(volume)::text AS min_volume,
          MAX(volume)::text AS max_volume,
          COUNT(*) FILTER (WHERE sold_volume IS NOT NULL)::bigint AS rows_with_sold_volume,
          COUNT(*) FILTER (WHERE max_deal_amount IS NOT NULL)::bigint AS rows_with_amount_limit
        FROM prices
        GROUP BY limit_type, price_unit
        ORDER BY limit_type, price_unit
      `);
      priceUnits = result.rows;
    }

    let budgetVolume = { skipped: true, reason: "table or column missing" };
    if (columnMap.has("budget_income_expense.sales_volume")) {
      const result = await client.query(`
        SELECT
          COUNT(*)::bigint AS budget_rows,
          COUNT(*) FILTER (WHERE sales_volume IS NOT NULL)::bigint AS populated,
          COUNT(*) FILTER (
            WHERE sales_volume IS NOT NULL
              AND BTRIM(sales_volume) !~ '^-?[0-9]+([.][0-9]+)?$'
          )::bigint AS non_numeric
        FROM budget_income_expense
      `);
      budgetVolume = result.rows[0];
    }

    let productTypeDistribution = { skipped: true, reason: "column missing" };
    if (columnMap.has("warehouse_transactions.product_type")) {
      const result = await client.query(`
        SELECT product_type, COUNT(*)::bigint AS rows_total
        FROM warehouse_transactions
        GROUP BY product_type
        ORDER BY product_type
      `);
      productTypeDistribution = result.rows;
    }

    const priceValues = await profilePriceValues(client, columnMap);

    const migrationColumnResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
      ORDER BY ordinal_position
    `);
    let migrationTracking = { skipped: true, reason: "drizzle migration table absent" };
    if (migrationColumnResult.rows.length) {
      const names = migrationColumnResult.rows.map((row) => row.column_name);
      const createdAt = names.includes("created_at") ? '"created_at"' : null;
      const result = await client.query(`
        SELECT COUNT(*)::bigint AS applied_rows
        ${createdAt ? `, MIN(${createdAt})::text AS first_migration, MAX(${createdAt})::text AS last_migration` : ""}
        FROM drizzle.__drizzle_migrations
      `);
      migrationTracking = { columns: names, ...result.rows[0] };
    }

    const report = {
      source: "restored dump; isolated temporary PostgreSQL only",
      schema: {
        publicTableCount: actualTables.length,
        missingExpectedTables: expectedTables.filter((table) => !actualTables.includes(table)),
        availableMassAndRateFields: availableFields.length,
        missingMassAndRateFields: missingFields,
        priceUnitClassificationColumns: priceUnitColumns,
      },
      fields: profile,
      unitConditionalFields: conditionalProfile,
      unmappedLegacyFields: legacyProfile,
      litersDensityComparison: densityComparison,
      perLiterDealDensityCoverage,
      zeroMassStatus,
      warehouseBalanceReconciliation,
      priceLimitUnits: priceUnits,
      budgetSalesVolume: budgetVolume,
      warehouseProductTypeDistribution: productTypeDistribution,
      priceValues: priceValues.report,
      migrationTracking,
      rehearsal: null,
    };

    const sourceFinancialTotals = await financialTotals(client, columnMap);
    await client.query("BEGIN");
    try {
      const rehearsal = [];
      for (const [table, column, unit] of availableFields) {
        const schema = columnMap.get(`${table}.${column}`);
        if (schema.data_type !== "numeric") {
          rehearsal.push({
            field: `${table}.${column}`,
            skipped: true,
            reason: `unsupported data type: ${schema.data_type}`,
          });
          continue;
        }

        const isMass = unit === "mass_kg";
        const destination = `__rehearsal_${column}_${isMass ? "tonnes" : "per_tonne"}`;
        if (columnMap.has(`${table}.${destination}`)) {
          rehearsal.push({
            field: `${table}.${column}`,
            skipped: true,
            reason: "temporary destination column already exists",
          });
          continue;
        }

        await client.query(`
          ALTER TABLE ${qualifiedTable(table)}
          ADD COLUMN ${quoteIdentifier(destination)} ${isMass ? "numeric(18,5)" : "numeric(22,6)"}
        `);
        await client.query(`
          UPDATE ${qualifiedTable(table)}
          SET ${quoteIdentifier(destination)} =
            ${quoteIdentifier(column)} ${isMass ? "/ 1000" : "* 1000"}
        `);
        const comparison = await client.query(`
          SELECT
            COUNT(*) FILTER (
              WHERE ${quoteIdentifier(column)} IS NOT NULL
                AND ${quoteIdentifier(destination)} IS NULL
            )::bigint AS lost_non_nulls,
            COUNT(*) FILTER (
              WHERE ${quoteIdentifier(column)} IS NOT NULL
                AND ${quoteIdentifier(destination)} ${isMass ? "* 1000" : "/ 1000"}
                    <> ${quoteIdentifier(column)}
            )::bigint AS round_trip_differences,
            COUNT(*) FILTER (
              WHERE ${quoteIdentifier(column)} IS NOT NULL
                AND SIGN(${quoteIdentifier(destination)}) <> SIGN(${quoteIdentifier(column)})
            )::bigint AS sign_differences
          FROM ${qualifiedTable(table)}
        `);
        const result = {
          field: `${table}.${column}`,
          converted_rows: profile.find((item) => item.field === `${table}.${column}`)?.rows_total,
          destination_type: isMass ? "numeric(18,5) tonnes" : "numeric(22,6) per tonne",
          ...comparison.rows[0],
        };
        rehearsal.push(result);
        if (
          Number(result.lost_non_nulls) !== 0
          || Number(result.round_trip_differences) !== 0
          || Number(result.sign_differences) !== 0
        ) {
          throw new Error(`Conversion rehearsal failed for ${table}.${column}`);
        }
      }

      const priceValueRehearsal = await rehearsePriceValues(
        client,
        priceValues.rates,
      );

      const afterFinancialTotals = await financialTotals(client, columnMap);
      const changedFinancialTotals = [];
      for (const [field, before] of sourceFinancialTotals) {
        const after = afterFinancialTotals.get(field);
        if (!after || before.rows_total !== after.rows_total || before.total !== after.total) {
          changedFinancialTotals.push({ field, before, after: after ?? null });
        }
      }
      if (changedFinancialTotals.length) {
        throw new Error("Financial aggregates changed during additive rehearsal.");
      }

      report.rehearsal = {
        convertedFields: rehearsal,
        priceValues: priceValueRehearsal,
        financialAggregateColumnsCompared: sourceFinancialTotals.size,
        financialAggregateChanges: changedFinancialTotals.length,
        note: "Temporary columns and updates are rolled back after the checks.",
      };
    } finally {
      await client.query("ROLLBACK");
    }

    console.log(JSON.stringify(report, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
});
