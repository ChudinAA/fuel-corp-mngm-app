import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
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
  ["equipment_movement", "quantity_tonnes", "mass_tonne"],
  ["equipment_movement", "cost_per_tonne", "price_per_tonne"],
  ["movement", "quantity_tonnes", "mass_tonne"],
  ["movement", "purchase_price_per_tonne", "price_per_tonne"],
  ["movement", "delivery_price_per_tonne", "price_per_tonne"],
  ["movement", "cost_per_tonne", "price_per_tonne"],
  ["transportation", "quantity_tonnes", "mass_tonne"],
  ["transportation", "purchase_price_per_tonne", "price_per_tonne"],
  ["transportation", "sale_price_per_tonne", "price_per_tonne"],
  ["transportation", "delivery_tariff_per_tonne", "price_per_tonne"],
  ["warehouse_transactions", "quantity", "mass_kg"],
  ["warehouse_transactions", "quantity_tonnes", "mass_tonne"],
  ["warehouse_transactions", "balance_before", "mass_kg"],
  ["warehouse_transactions", "balance_before_tonnes", "mass_tonne"],
  ["warehouse_transactions", "balance_after", "mass_kg"],
  ["warehouse_transactions", "balance_after_tonnes", "mass_tonne"],
  ["warehouses", "current_balance", "mass_kg"],
  ["warehouses", "current_balance_tonnes", "mass_tonne"],
  ["warehouses", "pvkj_balance", "mass_kg"],
  ["warehouses", "pvkj_balance_tonnes", "mass_tonne"],
  ["warehouses", "limit_volume", "mass_kg"],
  ["equipment_transactions", "quantity", "mass_kg"],
  ["equipment_transactions", "quantity_tonnes", "mass_tonne"],
  ["equipment_transactions", "balance_before", "mass_kg"],
  ["equipment_transactions", "balance_before_tonnes", "mass_tonne"],
  ["equipment_transactions", "balance_after", "mass_kg"],
  ["equipment_transactions", "balance_after_tonnes", "mass_tonne"],
  ["equipments", "current_balance", "mass_kg"],
  ["equipments", "current_balance_tonnes", "mass_tonne"],
  ["equipments", "pvkj_balance", "mass_kg"],
  ["equipments", "pvkj_balance_tonnes", "mass_tonne"],
  ["plan_entries", "volume", "mass_kg"],
  ["plan_entries", "volume_tonnes", "mass_tonne"],
  ["plan_entries", "balance_after", "mass_kg"],
  ["plan_entries", "balance_after_tonnes", "mass_tonne"],
  ["free_volume_allocations", "volume", "mass_kg"],
  ["free_volume_allocations", "volume_tonnes", "mass_tonne"],
  ["supplier_allocated_volumes", "volume", "mass_kg"],
  ["supplier_allocated_volumes", "volume_tonnes", "mass_tonne"],
  ["planning_top_level_volumes", "volume", "mass_kg"],
  ["planning_top_level_volumes", "volume_tonnes", "mass_tonne"],
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
  ["prices", "volume", "contract mass limit only for limit_type=volume; unit is volume_unit"],
  ["prices", "sold_volume", "consumed contract mass; unit is volume_unit"],
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

async function rehearsePriceVolumes(client, columnMap) {
  const hasVolume = columnMap.has("prices.volume");
  const hasSoldVolume = columnMap.has("prices.sold_volume");
  const hasLimitType = columnMap.has("prices.limit_type");
  const hasVolumeUnit = columnMap.has("prices.volume_unit");
  if (!hasVolume && !hasSoldVolume) {
    return { skipped: true, reason: "contract mass columns missing" };
  }

  const unitExpression = hasVolumeUnit ? "volume_unit" : "'kg'::text";
  await client.query(`
    CREATE TEMP TABLE __price_volume_rehearsal (
      source_field text NOT NULL,
      source_unit text,
      source_value numeric NOT NULL,
      tonne_value numeric,
      round_trip_value numeric
    ) ON COMMIT DROP
  `);

  if (hasVolume && hasLimitType) {
    await client.query(`
      INSERT INTO __price_volume_rehearsal
        (source_field, source_unit, source_value, tonne_value, round_trip_value)
      SELECT
        'volume',
        ${unitExpression},
        volume::numeric,
        CASE
          WHEN ${unitExpression} = 'kg' THEN volume::numeric / 1000
          WHEN ${unitExpression} = 'tonne' THEN volume::numeric
          ELSE NULL
        END,
        CASE
          WHEN ${unitExpression} = 'kg' THEN (volume::numeric / 1000) * 1000
          WHEN ${unitExpression} = 'tonne' THEN volume::numeric
          ELSE NULL
        END
      FROM prices
      WHERE volume IS NOT NULL
        AND COALESCE(limit_type, 'volume') <> 'amount'
    `);
  }

  if (hasSoldVolume) {
    await client.query(`
      INSERT INTO __price_volume_rehearsal
        (source_field, source_unit, source_value, tonne_value, round_trip_value)
      SELECT
        'sold_volume',
        ${unitExpression},
        sold_volume::numeric,
        CASE
          WHEN ${unitExpression} = 'kg' THEN sold_volume::numeric / 1000
          WHEN ${unitExpression} = 'tonne' THEN sold_volume::numeric
          ELSE NULL
        END,
        CASE
          WHEN ${unitExpression} = 'kg' THEN (sold_volume::numeric / 1000) * 1000
          WHEN ${unitExpression} = 'tonne' THEN sold_volume::numeric
          ELSE NULL
        END
      FROM prices
      WHERE sold_volume IS NOT NULL
    `);
  }

  let amountLimitVolumesIgnored = 0;
  if (hasVolume && hasLimitType) {
    const ignored = await client.query(`
      SELECT COUNT(*)::bigint AS rows_total
      FROM prices
      WHERE COALESCE(limit_type, 'volume') = 'amount'
        AND volume IS NOT NULL
    `);
    amountLimitVolumesIgnored = Number(ignored.rows[0].rows_total);
  }

  const result = await client.query(`
    SELECT
      COUNT(*)::bigint AS mass_values,
      COUNT(*) FILTER (WHERE source_unit = 'kg')::bigint AS kg_values_converted,
      COUNT(*) FILTER (WHERE source_unit = 'tonne')::bigint AS tonne_values_preserved,
      COUNT(*) FILTER (
        WHERE source_unit IS NULL OR source_unit NOT IN ('kg', 'tonne')
      )::bigint AS unknown_unit_values,
      COUNT(*) FILTER (
        WHERE source_unit IN ('kg', 'tonne')
          AND source_value <> round_trip_value
      )::bigint AS round_trip_differences
    FROM __price_volume_rehearsal
  `);
  const summary = result.rows[0];
  if (
    Number(summary.unknown_unit_values) !== 0
    || Number(summary.round_trip_differences) !== 0
  ) {
    throw new Error("Contract-volume conversion rehearsal failed.");
  }

  return {
    ...summary,
    amountLimitVolumesIgnored,
    volumeUnitColumnPresent: hasVolumeUnit,
    missingVolumeUnitAssumption: hasVolumeUnit
      ? null
      : "Existing legacy contract mass is interpreted as kg.",
  };
}

async function rehearsePriceVolumeSchemaMigration(client, columnMap) {
  const requiredColumns = [
    "id",
    "volume",
    "sold_volume",
    "max_deal_amount",
    "price_unit",
    "price_values",
    "limit_type",
    "sold_amount",
  ];
  if (!hasColumns(columnMap, "prices", requiredColumns)) {
    return {
      skipped: true,
      reason: "required price columns missing",
    };
  }

  const sourceSchema = ["volume", "sold_volume", "volume_unit"].map((column) => {
    if (!columnMap.has(`prices.${column}`)) {
      return { column, present: false };
    }
    const schema = columnMap.get(`prices.${column}`);
    return {
      column,
      present: true,
      data_type: schema.data_type,
      numeric_precision: schema.numeric_precision,
      numeric_scale: schema.numeric_scale,
    };
  });

  const sourceVolumeUnit = columnMap.has("prices.volume_unit")
    ? "volume_unit"
    : "NULL::text";
  await client.query(`
    CREATE TEMP TABLE __price_schema_source AS
    SELECT
      id,
      volume,
      sold_volume,
      max_deal_amount,
      sold_amount,
      limit_type,
      price_unit,
      price_values,
      ${sourceVolumeUnit} AS volume_unit
    FROM prices
  `);

  const migrationSql = readFileSync(
    resolve("migrations/0087_prices_mass_volume_unit.sql"),
    "utf8",
  );
  await client.query(migrationSql);

  const afterSchemaResult = await client.query(`
    SELECT column_name, data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'prices'
      AND column_name IN ('volume', 'sold_volume', 'volume_unit')
    ORDER BY column_name
  `);
  const afterSchema = afterSchemaResult.rows;

  const comparison = await client.query(`
    SELECT
      (SELECT COUNT(*)::bigint FROM __price_schema_source) AS source_rows,
      COUNT(*)::bigint AS price_rows,
      COUNT(*) FILTER (
        WHERE source.id IS NULL
          OR prices.volume IS DISTINCT FROM source.volume
          OR prices.sold_volume IS DISTINCT FROM source.sold_volume
          OR prices.max_deal_amount IS DISTINCT FROM source.max_deal_amount
          OR prices.sold_amount IS DISTINCT FROM source.sold_amount
          OR prices.limit_type IS DISTINCT FROM source.limit_type
          OR prices.price_unit IS DISTINCT FROM source.price_unit
          OR prices.price_values IS DISTINCT FROM source.price_values
          OR prices.volume_unit IS DISTINCT FROM COALESCE(source.volume_unit, 'kg')
      )::bigint AS changed_value_rows,
      COUNT(*) FILTER (
        WHERE prices.volume_unit IS NULL
          OR prices.volume_unit NOT IN ('kg', 'tonne')
      )::bigint AS invalid_volume_units,
      COUNT(*) FILTER (WHERE prices.volume_unit IS NULL)::bigint
        AS null_volume_units
    FROM prices
    LEFT JOIN __price_schema_source AS source USING (id)
  `);
  const result = comparison.rows[0];
  const volumeColumns = new Map(afterSchema.map((row) => [row.column_name, row]));
  const targetPrecision = ["volume", "sold_volume"].every((column) => {
    const schema = volumeColumns.get(column);
    return schema?.data_type === "numeric"
      && Number(schema.numeric_precision) === 18
      && Number(schema.numeric_scale) === 5;
  });
  const volumeUnitColumn = volumeColumns.get("volume_unit");
  if (
    Number(result.source_rows) !== Number(result.price_rows)
    || Number(result.changed_value_rows) !== 0
    || Number(result.invalid_volume_units) !== 0
    || Number(result.null_volume_units) !== 0
    || !targetPrecision
    || volumeUnitColumn?.data_type !== "text"
  ) {
    throw new Error("Price-volume schema migration rehearsal failed.");
  }

  return {
    sourceSchema,
    targetSchema: afterSchema,
    ...result,
    targetPrecision18_5: targetPrecision,
    note: "existing prices remain unchanged and are explicitly marked as kg",
  };
}

async function rehearsePriceMassBackfill(client) {
  const schemaResult = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prices'
  `);
  const availableColumns = new Set(
    schemaResult.rows.map((row) => row.column_name),
  );
  const requiredColumns = [
    "id",
    "price_unit",
    "price_values",
    "volume_unit",
    "limit_type",
    "volume",
    "sold_volume",
    "max_deal_amount",
    "sold_amount",
  ];
  const missingColumns = requiredColumns.filter(
    (column) => !availableColumns.has(column),
  );
  if (missingColumns.length) {
    return { skipped: true, missingColumns };
  }

  await client.query(`
    CREATE TEMP TABLE __price_backfill_source AS
    SELECT
      id,
      price_unit,
      price_values,
      volume_unit,
      limit_type,
      volume,
      sold_volume,
      max_deal_amount,
      sold_amount
    FROM prices
  `);

  const convertibleRateRow = `
    price.price_unit = 'kg'
    AND price.price_values IS NOT NULL
    AND cardinality(price.price_values) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(price.price_values) AS element(value)
      WHERE jsonb_typeof(element.value::jsonb) IS DISTINCT FROM 'object'
         OR NOT (element.value::jsonb ? 'price')
         OR jsonb_typeof(element.value::jsonb -> 'price')
              NOT IN ('number', 'string')
         OR btrim(element.value::jsonb ->> 'price')
              !~ '^[+-]?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$'
    )
  `;
  await client.query(`
    CREATE TEMP TABLE __price_backfill_expected AS
    SELECT
      price.id,
      CASE WHEN ${convertibleRateRow}
        THEN 'tonne' ELSE price.price_unit END AS price_unit,
      CASE WHEN ${convertibleRateRow} THEN ARRAY(
        SELECT jsonb_set(
          element.value::jsonb,
          '{price}',
          CASE
            WHEN jsonb_typeof(element.value::jsonb -> 'price') = 'string'
              THEN to_jsonb(
                ((element.value::jsonb ->> 'price')::numeric * 1000)::text
              )
            ELSE to_jsonb(
              (element.value::jsonb ->> 'price')::numeric * 1000
            )
          END,
          false
        )::text
        FROM unnest(price.price_values) WITH ORDINALITY
          AS element(value, position)
        ORDER BY element.position
      ) ELSE price.price_values END AS price_values,
      CASE WHEN price.volume_unit = 'kg'
        THEN 'tonne' ELSE price.volume_unit END AS volume_unit,
      CASE WHEN price.volume_unit = 'kg' AND price.limit_type = 'volume'
        THEN price.volume / 1000 ELSE price.volume END AS volume,
      CASE WHEN price.volume_unit = 'kg'
        THEN price.sold_volume / 1000 ELSE price.sold_volume END AS sold_volume,
      price.max_deal_amount,
      price.sold_amount
    FROM __price_backfill_source AS price
  `);

  const migrationSql = readFileSync(
    resolve("migrations/0088_prices_mass_unit_backfill.sql"),
    "utf8",
  );
  await client.query(migrationSql);

  const comparison = await client.query(`
    SELECT
      (SELECT COUNT(*)::bigint FROM __price_backfill_source) AS source_rows,
      COUNT(*)::bigint AS price_rows,
      COUNT(*) FILTER (
        WHERE expected.id IS NULL
          OR prices.price_unit IS DISTINCT FROM expected.price_unit
          OR prices.price_values IS DISTINCT FROM expected.price_values
          OR prices.volume_unit IS DISTINCT FROM expected.volume_unit
          OR prices.volume IS DISTINCT FROM expected.volume
          OR prices.sold_volume IS DISTINCT FROM expected.sold_volume
          OR prices.max_deal_amount IS DISTINCT FROM expected.max_deal_amount
          OR prices.sold_amount IS DISTINCT FROM expected.sold_amount
      )::bigint AS changed_value_rows,
      COUNT(*) FILTER (
        WHERE source.price_unit = 'kg'
          AND expected.price_unit = 'tonne'
      )::bigint AS rate_rows_converted,
      COALESCE(SUM(cardinality(source.price_values)) FILTER (
        WHERE source.price_unit = 'kg'
          AND expected.price_unit = 'tonne'
      ), 0)::bigint AS rate_values_converted,
      COUNT(*) FILTER (
        WHERE source.price_unit = 'kg'
          AND expected.price_unit = 'kg'
      )::bigint AS legacy_rate_rows_preserved,
      COUNT(*) FILTER (
        WHERE source.volume_unit = 'kg'
      )::bigint AS mass_rows_converted,
      COUNT(*) FILTER (
        WHERE source.limit_type = 'amount'
          AND source.volume IS NOT NULL
      )::bigint AS amount_limit_volumes_left_untouched
    FROM prices
    LEFT JOIN __price_backfill_expected AS expected USING (id)
    LEFT JOIN __price_backfill_source AS source USING (id)
  `);
  const result = comparison.rows[0];
  if (
    Number(result.source_rows) !== Number(result.price_rows)
    || Number(result.changed_value_rows) !== 0
  ) {
    throw new Error("Price mass backfill rehearsal failed.");
  }

  const unitsResult = await client.query(`
    SELECT
      price_unit,
      volume_unit,
      COUNT(*)::bigint AS price_rows
    FROM prices
    GROUP BY price_unit, volume_unit
    ORDER BY price_unit, volume_unit
  `);
  return {
    ...result,
    priceUnitsAfterMigration: unitsResult.rows,
    note: "replayed on the disposable restored database; raw or malformed rate rows remain in kg",
  };
}

async function rehearseKnownScalarPriceRateNormalization(client) {
  await client.query(`
    CREATE TEMP TABLE __known_scalar_price_rate_source AS
    SELECT id, price_unit, price_values, to_jsonb(prices) AS original_row
    FROM prices
  `);
  const candidates = await client.query(`
    SELECT COUNT(*)::int AS rows
    FROM __known_scalar_price_rate_source
    WHERE price_unit = 'kg'
      AND price_values IS NOT NULL
      AND cardinality(price_values) = 1
      AND btrim(price_values[1]) = '75'
  `);
  if (Number(candidates.rows[0].rows) !== 1) {
    throw new Error(
      `Expected exactly one approved scalar price row in rehearsal; found ${candidates.rows[0].rows}`,
    );
  }

  await client.query(
    readFileSync(
      resolve("migrations/0103_normalize_known_scalar_price_rate.sql"),
      "utf8",
    ),
  );
  const comparison = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM __known_scalar_price_rate_source) AS source_rows,
      (SELECT COUNT(*)::int FROM prices) AS actual_rows,
      (SELECT COUNT(*)::int
       FROM __known_scalar_price_rate_source source
       JOIN prices target USING (id)
       WHERE source.price_unit = 'kg'
         AND cardinality(source.price_values) = 1
         AND btrim(source.price_values[1]) = '75'
         AND target.price_unit = 'tonne'
         AND cardinality(target.price_values) = 1
         AND jsonb_typeof(target.price_values[1]::jsonb) = 'object'
         AND target.price_values[1]::jsonb ->> 'price' = '75000')
         AS normalized_rows,
      (SELECT COUNT(*)::int
       FROM __known_scalar_price_rate_source source
       JOIN prices target USING (id)
       WHERE NOT (
         source.price_unit = 'kg'
         AND cardinality(source.price_values) = 1
         AND btrim(source.price_values[1]) = '75'
       )
         AND (target.price_unit IS DISTINCT FROM source.price_unit
           OR target.price_values IS DISTINCT FROM source.price_values))
         AS changed_other_rate_rows,
      (SELECT COUNT(*)::int
       FROM __known_scalar_price_rate_source source
       JOIN prices target USING (id)
       WHERE (to_jsonb(target) - 'price_unit' - 'price_values')
         IS DISTINCT FROM
         (source.original_row - 'price_unit' - 'price_values'))
         AS changed_non_rate_rows
  `);
  const result = comparison.rows[0];
  const passed =
    Number(result.source_rows) === Number(result.actual_rows) &&
    Number(result.normalized_rows) === 1 &&
    Number(result.changed_other_rate_rows) === 0 &&
    Number(result.changed_non_rate_rows) === 0;
  if (!passed) {
    throw new Error(
      `Known scalar price rate rehearsal failed: ${JSON.stringify(result)}`,
    );
  }
  return {
    ...result,
    candidate_rows: Number(candidates.rows[0].rows),
    passed,
    note: "Only the single approved raw numeric kg rate of 75 is wrapped as a standard price object and converted to 75000 per tonne.",
  };
}

async function rehearseLogisticsCapacityBackfill(client) {
  const tables = ["logistics_vehicles", "logistics_trailers"];
  const schemaResult = await client.query(`
    SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
  `, [tables]);
  const columns = new Map(
    schemaResult.rows.map((row) => [`${row.table_name}.${row.column_name}`, row]),
  );
  const missing = tables.flatMap((table) =>
    ["id", "capacity_kg"].filter((column) => !columns.has(`${table}.${column}`))
      .map((column) => `${table}.${column}`),
  );
  if (missing.length) return { skipped: true, missingColumns: missing };

  const sourceQueries = tables.map((table) => {
    const tonneColumn = columns.has(`${table}.capacity_tonnes`)
      ? "capacity_tonnes"
      : "NULL::numeric";
    return `
      SELECT
        '${table}'::text AS table_name,
        id,
        capacity_kg,
        ${tonneColumn} AS capacity_tonnes
      FROM ${table}
    `;
  });
  await client.query(`
    CREATE TEMP TABLE __logistics_capacity_source AS
    ${sourceQueries.join("\nUNION ALL\n")}
  `);
  await client.query(`
    CREATE TEMP TABLE __logistics_capacity_expected AS
    SELECT
      table_name,
      id,
      capacity_kg,
      COALESCE(capacity_tonnes, capacity_kg / 1000) AS capacity_tonnes
    FROM __logistics_capacity_source
  `);

  const migrationSql = readFileSync(
    resolve("migrations/0089_logistics_capacity_tonnes.sql"),
    "utf8",
  );
  await client.query(migrationSql);

  const actualQueries = tables.map((table) => `
    SELECT
      '${table}'::text AS table_name,
      id,
      capacity_kg,
      capacity_tonnes
    FROM ${table}
  `);
  const comparison = await client.query(`
    SELECT
      (SELECT COUNT(*)::bigint FROM __logistics_capacity_source) AS source_rows,
      COUNT(*)::bigint AS actual_rows,
      COUNT(*) FILTER (
        WHERE expected.id IS NULL
          OR actual.capacity_kg IS DISTINCT FROM expected.capacity_kg
          OR actual.capacity_tonnes IS DISTINCT FROM expected.capacity_tonnes
      )::bigint AS changed_value_rows,
      COUNT(*) FILTER (
        WHERE source.capacity_kg IS NOT NULL
          AND source.capacity_tonnes IS NULL
      )::bigint AS capacity_rows_backfilled,
      COUNT(*) FILTER (
        WHERE source.capacity_kg IS NOT NULL
      )::bigint AS populated_legacy_capacity_rows
    FROM (${actualQueries.join("\nUNION ALL\n")}) AS actual
    LEFT JOIN __logistics_capacity_expected AS expected
      USING (table_name, id)
    LEFT JOIN __logistics_capacity_source AS source
      USING (table_name, id)
  `);
  const result = comparison.rows[0];
  const targetColumns = await client.query(`
    SELECT table_name, data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'capacity_tonnes'
      AND table_name = ANY($1::text[])
    ORDER BY table_name
  `, [tables]);
  const correctTargetTypes = targetColumns.rows.length === tables.length
    && targetColumns.rows.every((row) =>
      row.data_type === "numeric"
      && Number(row.numeric_precision) === 15
      && Number(row.numeric_scale) === 5,
    );
  if (
    Number(result.source_rows) !== Number(result.actual_rows)
    || Number(result.changed_value_rows) !== 0
    || !correctTargetTypes
  ) {
    throw new Error("Logistics capacity backfill rehearsal failed.");
  }
  return {
    ...result,
    targetColumns: targetColumns.rows,
    note: "kg legacy columns remain synchronized; capacity_tonnes is the new read/write unit",
  };
}

async function rehearseWarehouseLimitBackfill(client) {
  const schemaResult = await client.query(`
    SELECT column_name, data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warehouses'
  `);
  const columns = new Map(schemaResult.rows.map((row) => [row.column_name, row]));
  const missing = ["id", "limit_volume"].filter((column) => !columns.has(column));
  if (missing.length) return { skipped: true, missingColumns: missing };

  const tonneColumn = columns.has("limit_volume_tonnes")
    ? "limit_volume_tonnes"
    : "NULL::numeric";
  await client.query(`
    CREATE TEMP TABLE __warehouse_limit_source AS
    SELECT
      id,
      limit_volume,
      limit_product_type,
      limit_expires_at,
      ${tonneColumn} AS limit_volume_tonnes
    FROM warehouses
  `);
  await client.query(`
    CREATE TEMP TABLE __warehouse_limit_expected AS
    SELECT
      id,
      limit_volume,
      limit_product_type,
      limit_expires_at,
      COALESCE(limit_volume_tonnes, limit_volume / 1000) AS limit_volume_tonnes
    FROM __warehouse_limit_source
  `);

  const migrationSql = readFileSync(
    resolve("migrations/0090_warehouse_limit_volume_tonnes.sql"),
    "utf8",
  );
  await client.query(migrationSql);

  const comparison = await client.query(`
    SELECT
      (SELECT COUNT(*)::bigint FROM __warehouse_limit_source) AS source_rows,
      COUNT(*)::bigint AS actual_rows,
      COUNT(*) FILTER (
        WHERE expected.id IS NULL
          OR actual.limit_volume IS DISTINCT FROM expected.limit_volume
          OR actual.limit_product_type IS DISTINCT FROM expected.limit_product_type
          OR actual.limit_expires_at IS DISTINCT FROM expected.limit_expires_at
          OR actual.limit_volume_tonnes IS DISTINCT FROM expected.limit_volume_tonnes
      )::bigint AS changed_value_rows,
      COUNT(*) FILTER (
        WHERE source.limit_volume IS NOT NULL
          AND source.limit_volume_tonnes IS NULL
      )::bigint AS limit_rows_backfilled,
      COUNT(*) FILTER (
        WHERE source.limit_volume IS NOT NULL
      )::bigint AS populated_legacy_limit_rows
    FROM warehouses AS actual
    LEFT JOIN __warehouse_limit_expected AS expected USING (id)
    LEFT JOIN __warehouse_limit_source AS source USING (id)
  `);
  const targetColumn = await client.query(`
    SELECT data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warehouses'
      AND column_name = 'limit_volume_tonnes'
  `);
  const correctTargetType = targetColumn.rows.length === 1
    && targetColumn.rows[0].data_type === "numeric"
    && Number(targetColumn.rows[0].numeric_precision) === 18
    && Number(targetColumn.rows[0].numeric_scale) === 5;
  const result = comparison.rows[0];
  if (
    Number(result.source_rows) !== Number(result.actual_rows)
    || Number(result.changed_value_rows) !== 0
    || !correctTargetType
  ) {
    throw new Error("Warehouse limit backfill rehearsal failed.");
  }
  return {
    ...result,
    targetColumn: targetColumn.rows[0],
    note: "limit_volume remains a synchronized kg compatibility mirror; limit_volume_tonnes is authoritative",
  };
}

async function rehearseWarehouseStockMassBackfill(client) {
  const [warehouseSchema, transactionSchema] = await Promise.all([
    client.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'warehouses'
    `),
    client.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'warehouse_transactions'
    `),
  ]);
  const warehouseColumns = new Map(
    warehouseSchema.rows.map((row) => [row.column_name, row]),
  );
  const transactionColumns = new Map(
    transactionSchema.rows.map((row) => [row.column_name, row]),
  );
  const missing = [
    ...["id", "current_balance", "pvkj_balance"]
      .filter((column) => !warehouseColumns.has(column))
      .map((column) => `warehouses.${column}`),
    ...[
      "id",
      "warehouse_id",
      "transaction_type",
      "product_type",
      "quantity",
      "balance_before",
      "balance_after",
      "sum",
      "price",
      "deleted_at",
      "source_type",
      "source_id",
      "transaction_date",
      "created_at",
    ]
      .filter((column) => !transactionColumns.has(column))
      .map((column) => `warehouse_transactions.${column}`),
  ];
  if (missing.length) return { skipped: true, missingColumns: missing };

  const sourceColumn = (columns, name) =>
    columns.has(name) ? name : "NULL::numeric";
  await client.query(`
    CREATE TEMP TABLE __warehouse_stock_warehouse_source AS
    SELECT
      id,
      current_balance,
      pvkj_balance,
      ${sourceColumn(warehouseColumns, "current_balance_tonnes")} AS current_balance_tonnes,
      ${sourceColumn(warehouseColumns, "pvkj_balance_tonnes")} AS pvkj_balance_tonnes
    FROM warehouses
  `);
  await client.query(`
    CREATE TEMP TABLE __warehouse_stock_transaction_source AS
    SELECT
      id,
      warehouse_id,
      transaction_type,
      product_type,
      quantity,
      balance_before,
      balance_after,
      sum,
      price,
      deleted_at,
      source_type,
      source_id,
      transaction_date,
      created_at,
      ${sourceColumn(transactionColumns, "quantity_tonnes")} AS quantity_tonnes,
      ${sourceColumn(transactionColumns, "balance_before_tonnes")} AS balance_before_tonnes,
      ${sourceColumn(transactionColumns, "balance_after_tonnes")} AS balance_after_tonnes
    FROM warehouse_transactions
  `);
  await client.query(`
    CREATE TEMP TABLE __warehouse_stock_expected AS
    SELECT
      id,
      current_balance,
      pvkj_balance,
      CASE WHEN current_balance IS NULL THEN NULL ELSE current_balance / 1000 END
        AS current_balance_tonnes,
      CASE WHEN pvkj_balance IS NULL THEN NULL ELSE pvkj_balance / 1000 END
        AS pvkj_balance_tonnes
    FROM __warehouse_stock_warehouse_source
  `);
  await client.query(`
    CREATE TEMP TABLE __warehouse_stock_transactions_expected AS
    SELECT
      id,
      warehouse_id,
      transaction_type,
      product_type,
      quantity,
      balance_before,
      balance_after,
      sum,
      price,
      deleted_at,
      source_type,
      source_id,
      transaction_date,
      created_at,
      CASE WHEN quantity IS NULL THEN NULL ELSE quantity / 1000 END
        AS quantity_tonnes,
      CASE WHEN balance_before IS NULL THEN NULL ELSE balance_before / 1000 END
        AS balance_before_tonnes,
      CASE WHEN balance_after IS NULL THEN NULL ELSE balance_after / 1000 END
        AS balance_after_tonnes
    FROM __warehouse_stock_transaction_source
  `);

  const migrationSql = readFileSync(
    resolve("migrations/0091_warehouse_stock_mass_tonnes.sql"),
    "utf8",
  );
  await client.query(migrationSql);

  const [warehouseComparison, transactionComparison, targetColumns] =
    await Promise.all([
      client.query(`
        SELECT
          (SELECT COUNT(*)::bigint FROM __warehouse_stock_warehouse_source) AS source_rows,
          COUNT(*)::bigint AS actual_rows,
          COUNT(*) FILTER (
            WHERE expected.id IS NULL
              OR actual.current_balance IS DISTINCT FROM expected.current_balance
              OR actual.pvkj_balance IS DISTINCT FROM expected.pvkj_balance
              OR actual.current_balance_tonnes IS DISTINCT FROM expected.current_balance_tonnes
              OR actual.pvkj_balance_tonnes IS DISTINCT FROM expected.pvkj_balance_tonnes
          )::bigint AS changed_value_rows,
          COUNT(*) FILTER (
            WHERE source.current_balance_tonnes IS NULL
              AND source.current_balance IS NOT NULL
          )::bigint AS current_balance_rows_backfilled,
          COUNT(*) FILTER (
            WHERE source.pvkj_balance_tonnes IS NULL
              AND source.pvkj_balance IS NOT NULL
          )::bigint AS pvkj_balance_rows_backfilled
        FROM warehouses AS actual
        LEFT JOIN __warehouse_stock_expected AS expected USING (id)
        LEFT JOIN __warehouse_stock_warehouse_source AS source USING (id)
      `),
      client.query(`
        SELECT
          (SELECT COUNT(*)::bigint FROM __warehouse_stock_transaction_source) AS source_rows,
          COUNT(*)::bigint AS actual_rows,
          COUNT(*) FILTER (
            WHERE expected.id IS NULL
              OR actual.warehouse_id IS DISTINCT FROM expected.warehouse_id
              OR actual.transaction_type IS DISTINCT FROM expected.transaction_type
              OR actual.product_type IS DISTINCT FROM expected.product_type
              OR actual.quantity IS DISTINCT FROM expected.quantity
              OR actual.balance_before IS DISTINCT FROM expected.balance_before
              OR actual.balance_after IS DISTINCT FROM expected.balance_after
              OR actual.sum IS DISTINCT FROM expected.sum
              OR actual.price IS DISTINCT FROM expected.price
              OR actual.deleted_at IS DISTINCT FROM expected.deleted_at
              OR actual.source_type IS DISTINCT FROM expected.source_type
              OR actual.source_id IS DISTINCT FROM expected.source_id
              OR actual.transaction_date IS DISTINCT FROM expected.transaction_date
              OR actual.created_at IS DISTINCT FROM expected.created_at
              OR actual.quantity_tonnes IS DISTINCT FROM expected.quantity_tonnes
              OR actual.balance_before_tonnes IS DISTINCT FROM expected.balance_before_tonnes
              OR actual.balance_after_tonnes IS DISTINCT FROM expected.balance_after_tonnes
          )::bigint AS changed_value_rows,
          COUNT(*) FILTER (WHERE source.quantity < 0)::bigint AS negative_legacy_quantity_rows,
          COUNT(*) FILTER (WHERE actual.quantity_tonnes < 0)::bigint AS negative_tonne_quantity_rows,
          COUNT(*) FILTER (
            WHERE source.quantity_tonnes IS NULL
              AND source.quantity IS NOT NULL
          )::bigint AS quantity_rows_backfilled,
          COUNT(*) FILTER (
            WHERE source.balance_before_tonnes IS NULL
              AND source.balance_before IS NOT NULL
          )::bigint AS balance_before_rows_backfilled,
          COUNT(*) FILTER (
            WHERE source.balance_after_tonnes IS NULL
              AND source.balance_after IS NOT NULL
          )::bigint AS balance_after_rows_backfilled
        FROM warehouse_transactions AS actual
        LEFT JOIN __warehouse_stock_transactions_expected AS expected USING (id)
        LEFT JOIN __warehouse_stock_transaction_source AS source USING (id)
      `),
      client.query(`
        SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (
            (table_name = 'warehouses' AND column_name IN (
              'current_balance_tonnes', 'pvkj_balance_tonnes'
            ))
            OR
            (table_name = 'warehouse_transactions' AND column_name IN (
              'quantity_tonnes', 'balance_before_tonnes', 'balance_after_tonnes'
            ))
          )
      `),
    ]);

  const correctTargetTypes =
    targetColumns.rows.length === 5 &&
    targetColumns.rows.every(
      (column) =>
        column.data_type === "numeric" &&
        Number(column.numeric_precision) === 18 &&
        Number(column.numeric_scale) === 5,
    );
  const warehouseResult = warehouseComparison.rows[0];
  const transactionResult = transactionComparison.rows[0];
  if (
    Number(warehouseResult.source_rows) !== Number(warehouseResult.actual_rows) ||
    Number(warehouseResult.changed_value_rows) !== 0 ||
    Number(transactionResult.source_rows) !== Number(transactionResult.actual_rows) ||
    Number(transactionResult.changed_value_rows) !== 0 ||
    Number(transactionResult.negative_legacy_quantity_rows) !==
      Number(transactionResult.negative_tonne_quantity_rows) ||
    !correctTargetTypes
  ) {
    throw new Error("Warehouse stock mass backfill rehearsal failed.");
  }

  return {
    warehouses: warehouseResult,
    transactions: transactionResult,
    targetColumns: targetColumns.rows,
    note: "Tonne balances and ledger quantities are authoritative; legacy kg balances, signed quantities, snapshots, and money remain unchanged",
  };
}

async function rehearseEquipmentMovementMassBackfill(client) {
  const schema = await client.query(`
    SELECT column_name, data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'equipment_movement'
  `);
  const columns = new Map(schema.rows.map((row) => [row.column_name, row]));
  const required = [
    "id",
    "quantity_kg",
    "cost_per_kg",
    "total_cost",
    "quantity_liters",
    "density",
  ];
  const missing = required.filter((column) => !columns.has(column));
  if (missing.length) return { skipped: true, missingColumns: missing };

  const sourceColumn = (name) =>
    columns.has(name) ? name : "NULL::numeric";
  await client.query(`
    CREATE TEMP TABLE __equipment_movement_mass_source AS
    SELECT
      id,
      quantity_kg,
      cost_per_kg,
      total_cost,
      quantity_liters,
      density,
      ${sourceColumn("quantity_tonnes")} AS quantity_tonnes,
      ${sourceColumn("cost_per_tonne")} AS cost_per_tonne
    FROM equipment_movement
  `);
  await client.query(`
    CREATE TEMP TABLE __equipment_movement_mass_expected AS
    SELECT
      id,
      quantity_kg,
      cost_per_kg,
      total_cost,
      quantity_liters,
      density,
      COALESCE(quantity_tonnes, quantity_kg / 1000) AS quantity_tonnes,
      COALESCE(cost_per_tonne, cost_per_kg * 1000) AS cost_per_tonne
    FROM __equipment_movement_mass_source
  `);

  const migrationSql = readFileSync(
    resolve("migrations/0093_equipment_movement_mass_tonnes.sql"),
    "utf8",
  );
  await client.query(migrationSql);

  const [comparison, targetColumns] = await Promise.all([
    client.query(`
      SELECT
        (SELECT COUNT(*)::bigint FROM __equipment_movement_mass_source) AS source_rows,
        COUNT(*)::bigint AS actual_rows,
        COUNT(*) FILTER (
          WHERE expected.id IS NULL
            OR actual.quantity_kg IS DISTINCT FROM expected.quantity_kg
            OR actual.cost_per_kg IS DISTINCT FROM expected.cost_per_kg
            OR actual.total_cost IS DISTINCT FROM expected.total_cost
            OR actual.quantity_liters IS DISTINCT FROM expected.quantity_liters
            OR actual.density IS DISTINCT FROM expected.density
            OR actual.quantity_tonnes IS DISTINCT FROM expected.quantity_tonnes
            OR actual.cost_per_tonne IS DISTINCT FROM expected.cost_per_tonne
        )::bigint AS changed_value_rows,
        COUNT(*) FILTER (
          WHERE source.quantity_tonnes IS NULL
            AND source.quantity_kg IS NOT NULL
        )::bigint AS quantity_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.cost_per_tonne IS NULL
            AND source.cost_per_kg IS NOT NULL
        )::bigint AS rate_rows_backfilled
      FROM equipment_movement AS actual
      LEFT JOIN __equipment_movement_mass_expected AS expected USING (id)
      LEFT JOIN __equipment_movement_mass_source AS source USING (id)
    `),
    client.query(`
      SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'equipment_movement'
        AND column_name IN ('quantity_tonnes', 'cost_per_tonne')
      ORDER BY column_name
    `),
  ]);
  const typesAreValid =
    targetColumns.rows.length === 2 &&
    targetColumns.rows.some(
      (row) =>
        row.column_name === "quantity_tonnes" &&
        row.data_type === "numeric" &&
        Number(row.numeric_precision) === 18 &&
        Number(row.numeric_scale) === 5,
    ) &&
    targetColumns.rows.some(
      (row) =>
        row.column_name === "cost_per_tonne" &&
        row.data_type === "numeric" &&
        Number(row.numeric_precision) === 22 &&
        Number(row.numeric_scale) === 6,
    );
  const result = comparison.rows[0];
  if (
    Number(result.source_rows) !== Number(result.actual_rows) ||
    Number(result.changed_value_rows) !== 0 ||
    !typesAreValid
  ) {
    throw new Error("Equipment movement mass backfill rehearsal failed.");
  }

  return {
    ...result,
    targetColumns: targetColumns.rows,
    note: "Tonne mass and per-tonne cost are authoritative; kg mirrors and historical totals remain unchanged",
  };
}

async function rehearseMovementMassBackfill(client) {
  const schema = await client.query(`
    SELECT column_name, data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'movement'
  `);
  const columns = new Map(schema.rows.map((row) => [row.column_name, row]));
  const required = [
    "id",
    "quantity_kg",
    "purchase_price",
    "delivery_price",
    "delivery_cost",
    "storage_cost",
    "warehouse_services_cost",
    "total_cost",
    "cost_per_kg",
    "quantity_liters",
    "density",
    "input_mode",
    "deleted_at",
  ];
  const missing = required.filter((column) => !columns.has(column));
  if (missing.length) return { skipped: true, missingColumns: missing };

  const sourceColumn = (name) =>
    columns.has(name) ? name : "NULL::numeric";
  await client.query(`
    CREATE TEMP TABLE __movement_mass_source AS
    SELECT
      id,
      quantity_kg,
      purchase_price,
      delivery_price,
      delivery_cost,
      storage_cost,
      warehouse_services_cost,
      total_cost,
      cost_per_kg,
      quantity_liters,
      density,
      input_mode,
      deleted_at,
      ${sourceColumn("quantity_tonnes")} AS quantity_tonnes,
      ${sourceColumn("purchase_price_per_tonne")} AS purchase_price_per_tonne,
      ${sourceColumn("delivery_price_per_tonne")} AS delivery_price_per_tonne,
      ${sourceColumn("cost_per_tonne")} AS cost_per_tonne
    FROM movement
  `);
  await client.query(`
    CREATE TEMP TABLE __movement_mass_expected AS
    SELECT
      id,
      quantity_kg,
      purchase_price,
      delivery_price,
      delivery_cost,
      storage_cost,
      warehouse_services_cost,
      total_cost,
      cost_per_kg,
      quantity_liters,
      density,
      input_mode,
      deleted_at,
      COALESCE(quantity_tonnes, quantity_kg / 1000) AS quantity_tonnes,
      COALESCE(purchase_price_per_tonne, purchase_price * 1000)
        AS purchase_price_per_tonne,
      COALESCE(delivery_price_per_tonne, delivery_price * 1000)
        AS delivery_price_per_tonne,
      COALESCE(cost_per_tonne, cost_per_kg * 1000) AS cost_per_tonne
    FROM __movement_mass_source
  `);

  await client.query(
    readFileSync(resolve("migrations/0094_movement_mass_tonnes.sql"), "utf8"),
  );

  const [comparison, targetColumns] = await Promise.all([
    client.query(`
      SELECT
        (SELECT COUNT(*)::bigint FROM __movement_mass_source) AS source_rows,
        COUNT(*)::bigint AS actual_rows,
        COUNT(*) FILTER (
          WHERE expected.id IS NULL
            OR actual.quantity_kg IS DISTINCT FROM expected.quantity_kg
            OR actual.purchase_price IS DISTINCT FROM expected.purchase_price
            OR actual.delivery_price IS DISTINCT FROM expected.delivery_price
            OR actual.delivery_cost IS DISTINCT FROM expected.delivery_cost
            OR actual.storage_cost IS DISTINCT FROM expected.storage_cost
            OR actual.warehouse_services_cost IS DISTINCT FROM expected.warehouse_services_cost
            OR actual.total_cost IS DISTINCT FROM expected.total_cost
            OR actual.cost_per_kg IS DISTINCT FROM expected.cost_per_kg
            OR actual.quantity_liters IS DISTINCT FROM expected.quantity_liters
            OR actual.density IS DISTINCT FROM expected.density
            OR actual.input_mode IS DISTINCT FROM expected.input_mode
            OR actual.deleted_at IS DISTINCT FROM expected.deleted_at
            OR actual.quantity_tonnes IS DISTINCT FROM expected.quantity_tonnes
            OR actual.purchase_price_per_tonne IS DISTINCT FROM expected.purchase_price_per_tonne
            OR actual.delivery_price_per_tonne IS DISTINCT FROM expected.delivery_price_per_tonne
            OR actual.cost_per_tonne IS DISTINCT FROM expected.cost_per_tonne
        )::bigint AS changed_value_rows,
        COUNT(*) FILTER (
          WHERE source.quantity_tonnes IS NULL AND source.quantity_kg IS NOT NULL
        )::bigint AS mass_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.purchase_price_per_tonne IS NULL
            AND source.purchase_price IS NOT NULL
        )::bigint AS purchase_rate_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.delivery_price_per_tonne IS NULL
            AND source.delivery_price IS NOT NULL
        )::bigint AS delivery_rate_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.cost_per_tonne IS NULL AND source.cost_per_kg IS NOT NULL
        )::bigint AS cost_rate_rows_backfilled
      FROM movement AS actual
      LEFT JOIN __movement_mass_expected AS expected USING (id)
      LEFT JOIN __movement_mass_source AS source USING (id)
    `),
    client.query(`
      SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'movement'
        AND column_name IN (
          'quantity_tonnes',
          'purchase_price_per_tonne',
          'delivery_price_per_tonne',
          'cost_per_tonne'
        )
      ORDER BY column_name
    `),
  ]);
  const targetFields = [
    ["quantity_tonnes", 18, 5],
    ["purchase_price_per_tonne", 22, 6],
    ["delivery_price_per_tonne", 22, 6],
    ["cost_per_tonne", 22, 6],
  ];
  const typesAreValid =
    targetColumns.rows.length === targetFields.length &&
    targetFields.every(([name, precision, scale]) =>
      targetColumns.rows.some(
        (row) =>
          row.column_name === name &&
          row.data_type === "numeric" &&
          Number(row.numeric_precision) === precision &&
          Number(row.numeric_scale) === scale,
      ),
    );
  const result = comparison.rows[0];
  if (
    Number(result.source_rows) !== Number(result.actual_rows) ||
    Number(result.changed_value_rows) !== 0 ||
    !typesAreValid
  ) {
    throw new Error("Movement mass backfill rehearsal failed.");
  }
  return {
    ...result,
    targetColumns: targetColumns.rows,
    note: "Mass and per-tonne rates backfilled from saved kg values; money and historical liters/density remain unchanged",
  };
}

async function rehearseTransportationMassBackfill(client) {
  const schema = await client.query(`
    SELECT column_name, data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transportation'
  `);
  const columns = new Map(schema.rows.map((row) => [row.column_name, row]));
  const required = [
    "id",
    "quantity_kg",
    "purchase_price",
    "sale_price",
    "delivery_tariff",
    "purchase_amount",
    "sale_amount",
    "delivery_cost",
    "profit",
    "quantity_liters",
    "density",
    "input_mode",
    "deleted_at",
  ];
  const missing = required.filter((column) => !columns.has(column));
  if (missing.length) return { skipped: true, missingColumns: missing };

  const sourceColumn = (name) =>
    columns.has(name) ? name : "NULL::numeric";
  await client.query(`
    CREATE TEMP TABLE __transportation_mass_source AS
    SELECT
      id,
      quantity_kg,
      purchase_price,
      sale_price,
      delivery_tariff,
      purchase_amount,
      sale_amount,
      delivery_cost,
      profit,
      quantity_liters,
      density,
      input_mode,
      deleted_at,
      ${sourceColumn("quantity_tonnes")} AS quantity_tonnes,
      ${sourceColumn("purchase_price_per_tonne")} AS purchase_price_per_tonne,
      ${sourceColumn("sale_price_per_tonne")} AS sale_price_per_tonne,
      ${sourceColumn("delivery_tariff_per_tonne")} AS delivery_tariff_per_tonne
    FROM transportation
  `);
  await client.query(`
    CREATE TEMP TABLE __transportation_mass_expected AS
    SELECT
      id,
      quantity_kg,
      purchase_price,
      sale_price,
      delivery_tariff,
      purchase_amount,
      sale_amount,
      delivery_cost,
      profit,
      quantity_liters,
      density,
      input_mode,
      deleted_at,
      COALESCE(quantity_tonnes, quantity_kg / 1000) AS quantity_tonnes,
      COALESCE(
        purchase_price_per_tonne,
        CASE WHEN input_mode = 'liters'
          THEN purchase_price * 1000 / NULLIF(density, 0)
          ELSE purchase_price * 1000
        END
      ) AS purchase_price_per_tonne,
      COALESCE(
        sale_price_per_tonne,
        CASE WHEN input_mode = 'liters'
          THEN sale_price * 1000 / NULLIF(density, 0)
          ELSE sale_price * 1000
        END
      ) AS sale_price_per_tonne,
      COALESCE(delivery_tariff_per_tonne, delivery_tariff * 1000)
        AS delivery_tariff_per_tonne
    FROM __transportation_mass_source
  `);

  await client.query(
    readFileSync(
      resolve("migrations/0095_transportation_mass_tonnes.sql"),
      "utf8",
    ),
  );

  const [comparison, targetColumns] = await Promise.all([
    client.query(`
      SELECT
        (SELECT COUNT(*)::bigint FROM __transportation_mass_source) AS source_rows,
        COUNT(*)::bigint AS actual_rows,
        COUNT(*) FILTER (
          WHERE expected.id IS NULL
            OR actual.quantity_kg IS DISTINCT FROM expected.quantity_kg
            OR actual.purchase_price IS DISTINCT FROM expected.purchase_price
            OR actual.sale_price IS DISTINCT FROM expected.sale_price
            OR actual.delivery_tariff IS DISTINCT FROM expected.delivery_tariff
            OR actual.purchase_amount IS DISTINCT FROM expected.purchase_amount
            OR actual.sale_amount IS DISTINCT FROM expected.sale_amount
            OR actual.delivery_cost IS DISTINCT FROM expected.delivery_cost
            OR actual.profit IS DISTINCT FROM expected.profit
            OR actual.quantity_liters IS DISTINCT FROM expected.quantity_liters
            OR actual.density IS DISTINCT FROM expected.density
            OR actual.input_mode IS DISTINCT FROM expected.input_mode
            OR actual.deleted_at IS DISTINCT FROM expected.deleted_at
            OR actual.quantity_tonnes IS DISTINCT FROM expected.quantity_tonnes
            OR actual.purchase_price_per_tonne IS DISTINCT FROM expected.purchase_price_per_tonne
            OR actual.sale_price_per_tonne IS DISTINCT FROM expected.sale_price_per_tonne
            OR actual.delivery_tariff_per_tonne IS DISTINCT FROM expected.delivery_tariff_per_tonne
        )::bigint AS changed_value_rows,
        COUNT(*) FILTER (
          WHERE source.quantity_tonnes IS NULL AND source.quantity_kg IS NOT NULL
        )::bigint AS mass_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.purchase_price_per_tonne IS NULL
            AND source.purchase_price IS NOT NULL
        )::bigint AS purchase_rate_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.sale_price_per_tonne IS NULL AND source.sale_price IS NOT NULL
        )::bigint AS sale_rate_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.delivery_tariff_per_tonne IS NULL
            AND source.delivery_tariff IS NOT NULL
        )::bigint AS delivery_rate_rows_backfilled
      FROM transportation AS actual
      LEFT JOIN __transportation_mass_expected AS expected USING (id)
      LEFT JOIN __transportation_mass_source AS source USING (id)
    `),
    client.query(`
      SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'transportation'
        AND column_name IN (
          'quantity_tonnes',
          'purchase_price_per_tonne',
          'sale_price_per_tonne',
          'delivery_tariff_per_tonne'
        )
      ORDER BY column_name
    `),
  ]);
  const targetFields = [
    ["quantity_tonnes", 18, 5],
    ["purchase_price_per_tonne", 22, 6],
    ["sale_price_per_tonne", 22, 6],
    ["delivery_tariff_per_tonne", 22, 6],
  ];
  const typesAreValid =
    targetColumns.rows.length === targetFields.length &&
    targetFields.every(([name, precision, scale]) =>
      targetColumns.rows.some(
        (row) =>
          row.column_name === name &&
          row.data_type === "numeric" &&
          Number(row.numeric_precision) === precision &&
          Number(row.numeric_scale) === scale,
      ),
    );
  const result = comparison.rows[0];
  if (
    Number(result.source_rows) !== Number(result.actual_rows) ||
    Number(result.changed_value_rows) !== 0 ||
    !typesAreValid
  ) {
    throw new Error("Transportation mass backfill rehearsal failed.");
  }
  return {
    ...result,
    targetColumns: targetColumns.rows,
    note: "Historical mass uses saved kg; per-liter rates use deal density; saved money and source fields remain unchanged",
  };
}

async function rehearseEquipmentStockMassBackfill(client) {
  const [equipmentSchema, transactionSchema] = await Promise.all([
    client.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'equipments'
    `),
    client.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'equipment_transactions'
    `),
  ]);
  const equipmentColumns = new Map(
    equipmentSchema.rows.map((row) => [row.column_name, row]),
  );
  const transactionColumns = new Map(
    transactionSchema.rows.map((row) => [row.column_name, row]),
  );
  const missing = [
    ...["id", "current_balance", "pvkj_balance"]
      .filter((column) => !equipmentColumns.has(column))
      .map((column) => `equipments.${column}`),
    ...[
      "id",
      "equipment_id",
      "transaction_type",
      "product_type",
      "quantity",
      "balance_before",
      "balance_after",
      "sum",
      "price",
      "deleted_at",
      "source_type",
      "source_id",
      "transaction_date",
      "created_at",
    ]
      .filter((column) => !transactionColumns.has(column))
      .map((column) => `equipment_transactions.${column}`),
  ];
  if (missing.length) return { skipped: true, missingColumns: missing };

  const sourceColumn = (columns, name) =>
    columns.has(name) ? name : "NULL::numeric";
  await client.query(`
    CREATE TEMP TABLE __equipment_stock_equipment_source AS
    SELECT
      id,
      current_balance,
      pvkj_balance,
      ${sourceColumn(equipmentColumns, "current_balance_tonnes")} AS current_balance_tonnes,
      ${sourceColumn(equipmentColumns, "pvkj_balance_tonnes")} AS pvkj_balance_tonnes
    FROM equipments
  `);
  await client.query(`
    CREATE TEMP TABLE __equipment_stock_transaction_source AS
    SELECT
      id,
      equipment_id,
      transaction_type,
      product_type,
      quantity,
      balance_before,
      balance_after,
      sum,
      price,
      deleted_at,
      source_type,
      source_id,
      transaction_date,
      created_at,
      ${sourceColumn(transactionColumns, "quantity_tonnes")} AS quantity_tonnes,
      ${sourceColumn(transactionColumns, "balance_before_tonnes")} AS balance_before_tonnes,
      ${sourceColumn(transactionColumns, "balance_after_tonnes")} AS balance_after_tonnes
    FROM equipment_transactions
  `);
  await client.query(`
    CREATE TEMP TABLE __equipment_stock_expected AS
    SELECT
      id,
      current_balance,
      pvkj_balance,
      CASE WHEN current_balance IS NULL THEN NULL ELSE current_balance / 1000 END
        AS current_balance_tonnes,
      CASE WHEN pvkj_balance IS NULL THEN NULL ELSE pvkj_balance / 1000 END
        AS pvkj_balance_tonnes
    FROM __equipment_stock_equipment_source
  `);
  await client.query(`
    CREATE TEMP TABLE __equipment_stock_transactions_expected AS
    SELECT
      id,
      equipment_id,
      transaction_type,
      product_type,
      quantity,
      balance_before,
      balance_after,
      sum,
      price,
      deleted_at,
      source_type,
      source_id,
      transaction_date,
      created_at,
      CASE WHEN quantity IS NULL THEN NULL ELSE quantity / 1000 END
        AS quantity_tonnes,
      CASE WHEN balance_before IS NULL THEN NULL ELSE balance_before / 1000 END
        AS balance_before_tonnes,
      CASE WHEN balance_after IS NULL THEN NULL ELSE balance_after / 1000 END
        AS balance_after_tonnes
    FROM __equipment_stock_transaction_source
  `);

  const migrationSql = readFileSync(
    resolve("migrations/0092_equipment_stock_mass_tonnes.sql"),
    "utf8",
  );
  await client.query(migrationSql);

  const [equipmentComparison, transactionComparison, targetColumns] =
    await Promise.all([
      client.query(`
        SELECT
          (SELECT COUNT(*)::bigint FROM __equipment_stock_equipment_source) AS source_rows,
          COUNT(*)::bigint AS actual_rows,
          COUNT(*) FILTER (
            WHERE expected.id IS NULL
              OR actual.current_balance IS DISTINCT FROM expected.current_balance
              OR actual.pvkj_balance IS DISTINCT FROM expected.pvkj_balance
              OR actual.current_balance_tonnes IS DISTINCT FROM expected.current_balance_tonnes
              OR actual.pvkj_balance_tonnes IS DISTINCT FROM expected.pvkj_balance_tonnes
          )::bigint AS changed_value_rows,
          COUNT(*) FILTER (
            WHERE source.current_balance_tonnes IS NULL
              AND source.current_balance IS NOT NULL
          )::bigint AS current_balance_rows_backfilled,
          COUNT(*) FILTER (
            WHERE source.pvkj_balance_tonnes IS NULL
              AND source.pvkj_balance IS NOT NULL
          )::bigint AS pvkj_balance_rows_backfilled
        FROM equipments AS actual
        LEFT JOIN __equipment_stock_expected AS expected USING (id)
        LEFT JOIN __equipment_stock_equipment_source AS source USING (id)
      `),
      client.query(`
        SELECT
          (SELECT COUNT(*)::bigint FROM __equipment_stock_transaction_source) AS source_rows,
          COUNT(*)::bigint AS actual_rows,
          COUNT(*) FILTER (
            WHERE expected.id IS NULL
              OR actual.equipment_id IS DISTINCT FROM expected.equipment_id
              OR actual.transaction_type IS DISTINCT FROM expected.transaction_type
              OR actual.product_type IS DISTINCT FROM expected.product_type
              OR actual.quantity IS DISTINCT FROM expected.quantity
              OR actual.balance_before IS DISTINCT FROM expected.balance_before
              OR actual.balance_after IS DISTINCT FROM expected.balance_after
              OR actual.sum IS DISTINCT FROM expected.sum
              OR actual.price IS DISTINCT FROM expected.price
              OR actual.deleted_at IS DISTINCT FROM expected.deleted_at
              OR actual.source_type IS DISTINCT FROM expected.source_type
              OR actual.source_id IS DISTINCT FROM expected.source_id
              OR actual.transaction_date IS DISTINCT FROM expected.transaction_date
              OR actual.created_at IS DISTINCT FROM expected.created_at
              OR actual.quantity_tonnes IS DISTINCT FROM expected.quantity_tonnes
              OR actual.balance_before_tonnes IS DISTINCT FROM expected.balance_before_tonnes
              OR actual.balance_after_tonnes IS DISTINCT FROM expected.balance_after_tonnes
          )::bigint AS changed_value_rows,
          COUNT(*) FILTER (WHERE source.quantity < 0)::bigint AS negative_legacy_quantity_rows,
          COUNT(*) FILTER (WHERE actual.quantity_tonnes < 0)::bigint AS negative_tonne_quantity_rows,
          COUNT(*) FILTER (
            WHERE source.quantity_tonnes IS NULL
              AND source.quantity IS NOT NULL
          )::bigint AS quantity_rows_backfilled,
          COUNT(*) FILTER (
            WHERE source.balance_before_tonnes IS NULL
              AND source.balance_before IS NOT NULL
          )::bigint AS balance_before_rows_backfilled,
          COUNT(*) FILTER (
            WHERE source.balance_after_tonnes IS NULL
              AND source.balance_after IS NOT NULL
          )::bigint AS balance_after_rows_backfilled
        FROM equipment_transactions AS actual
        LEFT JOIN __equipment_stock_transactions_expected AS expected USING (id)
        LEFT JOIN __equipment_stock_transaction_source AS source USING (id)
      `),
      client.query(`
        SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (
            (table_name = 'equipments' AND column_name IN (
              'current_balance_tonnes', 'pvkj_balance_tonnes'
            ))
            OR
            (table_name = 'equipment_transactions' AND column_name IN (
              'quantity_tonnes', 'balance_before_tonnes', 'balance_after_tonnes'
            ))
          )
      `),
    ]);

  const correctTargetTypes =
    targetColumns.rows.length === 5 &&
    targetColumns.rows.every(
      (column) =>
        column.data_type === "numeric" &&
        Number(column.numeric_precision) === 18 &&
        Number(column.numeric_scale) === 5,
    );
  const equipmentResult = equipmentComparison.rows[0];
  const transactionResult = transactionComparison.rows[0];
  if (
    Number(equipmentResult.source_rows) !== Number(equipmentResult.actual_rows) ||
    Number(equipmentResult.changed_value_rows) !== 0 ||
    Number(transactionResult.source_rows) !== Number(transactionResult.actual_rows) ||
    Number(transactionResult.changed_value_rows) !== 0 ||
    Number(transactionResult.negative_legacy_quantity_rows) !==
      Number(transactionResult.negative_tonne_quantity_rows) ||
    !correctTargetTypes
  ) {
    throw new Error("Equipment stock mass backfill rehearsal failed.");
  }

  return {
    equipments: equipmentResult,
    transactions: transactionResult,
    targetColumns: targetColumns.rows,
    note: "Tonne balances and ledger quantities are authoritative; legacy kg balances, signed quantities, snapshots, and money remain unchanged",
  };
}

async function rehearseAircraftRefuelingMassBackfill(client) {
  const schema = await client.query(`
    SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_refueling'
  `);
  const columns = new Map(schema.rows.map((row) => [row.column_name, row]));
  const required = [
    "id",
    "quantity_kg",
    "purchase_price",
    "sale_price",
    "agent_fee_rate",
    "purchase_amount",
    "sale_amount",
    "agent_fee",
    "other_service_fee",
    "profit",
    "quantity_liters",
    "density",
    "input_mode",
    "deleted_at",
  ];
  const missing = required.filter((column) => !columns.has(column));
  if (missing.length) return { skipped: true, missingColumns: missing };

  const sourceColumn = (name) =>
    columns.has(name) ? name : "NULL::numeric";
  await client.query(`
    CREATE TEMP TABLE __aircraft_refueling_mass_source AS
    SELECT
      id,
      quantity_kg,
      purchase_price,
      sale_price,
      agent_fee_rate,
      purchase_amount,
      sale_amount,
      agent_fee,
      other_service_fee,
      profit,
      quantity_liters,
      density,
      input_mode,
      deleted_at,
      ${sourceColumn("quantity_tonnes")} AS quantity_tonnes,
      ${sourceColumn("purchase_price_per_tonne")} AS purchase_price_per_tonne,
      ${sourceColumn("sale_price_per_tonne")} AS sale_price_per_tonne,
      ${sourceColumn("agent_fee_rate_per_tonne")} AS agent_fee_rate_per_tonne
    FROM aircraft_refueling
  `);
  await client.query(`
    CREATE TEMP TABLE __aircraft_refueling_mass_expected AS
    SELECT
      id,
      quantity_kg,
      purchase_price,
      sale_price,
      agent_fee_rate,
      purchase_amount,
      sale_amount,
      agent_fee,
      other_service_fee,
      profit,
      quantity_liters,
      density,
      input_mode,
      deleted_at,
      COALESCE(quantity_tonnes, quantity_kg / 1000) AS quantity_tonnes,
      COALESCE(purchase_price_per_tonne, purchase_price * 1000)
        AS purchase_price_per_tonne,
      COALESCE(sale_price_per_tonne, sale_price * 1000)
        AS sale_price_per_tonne,
      COALESCE(agent_fee_rate_per_tonne, agent_fee_rate * 1000)
        AS agent_fee_rate_per_tonne
    FROM __aircraft_refueling_mass_source
  `);

  await client.query(
    readFileSync(
      resolve("migrations/0096_aircraft_refueling_mass_tonnes.sql"),
      "utf8",
    ),
  );

  const [comparison, targetColumns] = await Promise.all([
    client.query(`
      SELECT
        (SELECT COUNT(*)::bigint FROM __aircraft_refueling_mass_source) AS source_rows,
        COUNT(*)::bigint AS actual_rows,
        COUNT(*) FILTER (
          WHERE expected.id IS NULL
            OR actual.quantity_kg IS DISTINCT FROM expected.quantity_kg
            OR actual.purchase_price IS DISTINCT FROM expected.purchase_price
            OR actual.sale_price IS DISTINCT FROM expected.sale_price
            OR actual.agent_fee_rate IS DISTINCT FROM expected.agent_fee_rate
            OR actual.purchase_amount IS DISTINCT FROM expected.purchase_amount
            OR actual.sale_amount IS DISTINCT FROM expected.sale_amount
            OR actual.agent_fee IS DISTINCT FROM expected.agent_fee
            OR actual.other_service_fee IS DISTINCT FROM expected.other_service_fee
            OR actual.profit IS DISTINCT FROM expected.profit
            OR actual.quantity_liters IS DISTINCT FROM expected.quantity_liters
            OR actual.density IS DISTINCT FROM expected.density
            OR actual.input_mode IS DISTINCT FROM expected.input_mode
            OR actual.deleted_at IS DISTINCT FROM expected.deleted_at
            OR actual.quantity_tonnes IS DISTINCT FROM expected.quantity_tonnes
            OR actual.purchase_price_per_tonne IS DISTINCT FROM expected.purchase_price_per_tonne
            OR actual.sale_price_per_tonne IS DISTINCT FROM expected.sale_price_per_tonne
            OR actual.agent_fee_rate_per_tonne IS DISTINCT FROM expected.agent_fee_rate_per_tonne
        )::bigint AS changed_value_rows,
        COUNT(*) FILTER (
          WHERE source.quantity_tonnes IS NULL AND source.quantity_kg IS NOT NULL
        )::bigint AS mass_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.purchase_price_per_tonne IS NULL
            AND source.purchase_price IS NOT NULL
        )::bigint AS purchase_rate_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.sale_price_per_tonne IS NULL
            AND source.sale_price IS NOT NULL
        )::bigint AS sale_rate_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.agent_fee_rate_per_tonne IS NULL
            AND source.agent_fee_rate IS NOT NULL
        )::bigint AS agent_fee_rate_rows_backfilled
      FROM aircraft_refueling AS actual
      LEFT JOIN __aircraft_refueling_mass_expected AS expected USING (id)
      LEFT JOIN __aircraft_refueling_mass_source AS source USING (id)
    `),
    client.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'aircraft_refueling'
        AND column_name IN (
          'quantity_tonnes',
          'purchase_price_per_tonne',
          'sale_price_per_tonne',
          'agent_fee_rate_per_tonne'
        )
      ORDER BY column_name
    `),
  ]);
  const targetFields = [
    ["quantity_tonnes", 18, 5, "NO"],
    ["purchase_price_per_tonne", 22, 6, "YES"],
    ["sale_price_per_tonne", 22, 6, "YES"],
    ["agent_fee_rate_per_tonne", 22, 6, "YES"],
  ];
  const typesAreValid =
    targetColumns.rows.length === targetFields.length &&
    targetFields.every(([name, precision, scale, nullable]) =>
      targetColumns.rows.some(
        (row) =>
          row.column_name === name &&
          row.data_type === "numeric" &&
          Number(row.numeric_precision) === precision &&
          Number(row.numeric_scale) === scale &&
          row.is_nullable === nullable,
      ),
    );
  const result = comparison.rows[0];
  return {
    ...result,
    passed:
      Number(result.source_rows) === Number(result.actual_rows) &&
      Number(result.changed_value_rows) === 0 &&
      typesAreValid,
    typesAreValid,
    targetColumns: targetColumns.rows,
    note: "Refueling tonnes use saved kg; per-kg deal rates are scaled by 1000; amounts, fees, liters, and density remain unchanged",
  };
}

async function rehearseOptMassBackfill(client) {
  const schema = await client.query(`
    SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'opt'
  `);
  const columns = new Map(schema.rows.map((row) => [row.column_name, row]));
  const requiredColumns = [
    "id",
    "quantity_kg",
    "purchase_price",
    "sale_price",
    "delivery_tariff",
  ];
  const missing = requiredColumns.filter((column) => !columns.has(column));
  if (missing.length) return { skipped: true, missingColumns: missing };

  const sourceColumn = (name) =>
    columns.has(name) ? name : "NULL::numeric";
  await client.query(`
    CREATE TEMP TABLE __opt_mass_source AS
    SELECT
      id,
      to_jsonb(opt) AS original_row,
      quantity_kg,
      purchase_price,
      sale_price,
      delivery_tariff,
      ${sourceColumn("quantity_tonnes")} AS quantity_tonnes,
      ${sourceColumn("purchase_price_per_tonne")} AS purchase_price_per_tonne,
      ${sourceColumn("sale_price_per_tonne")} AS sale_price_per_tonne,
      ${sourceColumn("delivery_tariff_per_tonne")} AS delivery_tariff_per_tonne
    FROM opt
  `);
  await client.query(`
    CREATE TEMP TABLE __opt_mass_expected AS
    SELECT
      id,
      original_row,
      quantity_kg,
      purchase_price,
      sale_price,
      delivery_tariff,
      COALESCE(quantity_tonnes, quantity_kg / 1000) AS quantity_tonnes,
      COALESCE(purchase_price_per_tonne, purchase_price * 1000)
        AS purchase_price_per_tonne,
      COALESCE(sale_price_per_tonne, sale_price * 1000)
        AS sale_price_per_tonne,
      COALESCE(delivery_tariff_per_tonne, delivery_tariff * 1000)
        AS delivery_tariff_per_tonne
    FROM __opt_mass_source
  `);

  await client.query(
    readFileSync(resolve("migrations/0097_opt_mass_tonnes.sql"), "utf8"),
  );

  const [comparison, targetColumns] = await Promise.all([
    client.query(`
      SELECT
        (SELECT COUNT(*)::bigint FROM __opt_mass_source) AS source_rows,
        COUNT(*)::bigint AS actual_rows,
        COUNT(*) FILTER (
          WHERE expected.id IS NULL
            OR (to_jsonb(actual)
                - 'quantity_tonnes'
                - 'purchase_price_per_tonne'
                - 'sale_price_per_tonne'
                - 'delivery_tariff_per_tonne')
               IS DISTINCT FROM
               (source.original_row
                - 'quantity_tonnes'
                - 'purchase_price_per_tonne'
                - 'sale_price_per_tonne'
                - 'delivery_tariff_per_tonne')
            OR actual.quantity_tonnes IS DISTINCT FROM expected.quantity_tonnes
            OR actual.purchase_price_per_tonne IS DISTINCT FROM expected.purchase_price_per_tonne
            OR actual.sale_price_per_tonne IS DISTINCT FROM expected.sale_price_per_tonne
            OR actual.delivery_tariff_per_tonne IS DISTINCT FROM expected.delivery_tariff_per_tonne
        )::bigint AS changed_value_rows,
        COUNT(*) FILTER (
          WHERE source.quantity_tonnes IS NULL AND source.quantity_kg IS NOT NULL
        )::bigint AS mass_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.purchase_price_per_tonne IS NULL
            AND source.purchase_price IS NOT NULL
        )::bigint AS purchase_rate_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.sale_price_per_tonne IS NULL
            AND source.sale_price IS NOT NULL
        )::bigint AS sale_rate_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.delivery_tariff_per_tonne IS NULL
            AND source.delivery_tariff IS NOT NULL
        )::bigint AS delivery_rate_rows_backfilled
      FROM opt AS actual
      LEFT JOIN __opt_mass_expected AS expected USING (id)
      LEFT JOIN __opt_mass_source AS source USING (id)
    `),
    client.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'opt'
        AND column_name IN (
          'quantity_tonnes',
          'purchase_price_per_tonne',
          'sale_price_per_tonne',
          'delivery_tariff_per_tonne'
        )
      ORDER BY column_name
    `),
  ]);
  const targetFields = [
    ["quantity_tonnes", 18, 5, "NO"],
    ["purchase_price_per_tonne", 22, 6, "YES"],
    ["sale_price_per_tonne", 22, 6, "YES"],
    ["delivery_tariff_per_tonne", 22, 6, "YES"],
  ];
  const typesAreValid =
    targetColumns.rows.length === targetFields.length &&
    targetFields.every(([name, precision, scale, nullable]) =>
      targetColumns.rows.some(
        (row) =>
          row.column_name === name &&
          row.data_type === "numeric" &&
          Number(row.numeric_precision) === precision &&
          Number(row.numeric_scale) === scale &&
          row.is_nullable === nullable,
      ),
    );
  const result = comparison.rows[0];
  return {
    ...result,
    passed:
      Number(result.source_rows) === Number(result.actual_rows) &&
      Number(result.changed_value_rows) === 0 &&
      typesAreValid,
    typesAreValid,
    targetColumns: targetColumns.rows,
    note: "OPT mass uses saved kg only; per-kg deal rates are scaled by 1000; money, deal rates in their original columns, liters, density, links, and statuses remain unchanged",
  };
}

async function rehearseRefuelingAbroadMassBackfill(client) {
  const schema = await client.query(`
    SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'refueling_abroad'
  `);
  const columns = new Map(schema.rows.map((row) => [row.column_name, row]));
  const requiredColumns = [
    "id",
    "quantity_kg",
    "input_mode",
    "density",
    "purchase_price_usd",
    "purchase_price_rub",
    "sale_price_usd",
    "sale_price_rub",
    "purchase_amount_usd",
    "purchase_amount_rub",
    "sale_amount_usd",
    "sale_amount_rub",
  ];
  const missing = requiredColumns.filter((column) => !columns.has(column));
  if (missing.length) return { skipped: true, missingColumns: missing };

  const sourceColumn = (name) =>
    columns.has(name) ? name : "NULL::numeric";
  await client.query(`
    CREATE TEMP TABLE __refueling_abroad_mass_source AS
    SELECT
      id,
      to_jsonb(deal) AS original_row,
      quantity_kg,
      input_mode,
      density,
      purchase_price_usd,
      purchase_price_rub,
      sale_price_usd,
      sale_price_rub,
      purchase_amount_usd,
      purchase_amount_rub,
      sale_amount_usd,
      sale_amount_rub,
      ${sourceColumn("quantity_tonnes")} AS quantity_tonnes,
      ${sourceColumn("purchase_price_usd_per_tonne")} AS purchase_price_usd_per_tonne,
      ${sourceColumn("purchase_price_rub_per_tonne")} AS purchase_price_rub_per_tonne,
      ${sourceColumn("sale_price_usd_per_tonne")} AS sale_price_usd_per_tonne,
      ${sourceColumn("sale_price_rub_per_tonne")} AS sale_price_rub_per_tonne
    FROM refueling_abroad AS deal
  `);
  await client.query(`
    CREATE TEMP TABLE __refueling_abroad_mass_expected AS
    SELECT
      id,
      original_row,
      quantity_kg,
      COALESCE(quantity_tonnes, quantity_kg / 1000) AS quantity_tonnes,
      COALESCE(
        purchase_price_usd_per_tonne,
        CASE
          WHEN purchase_amount_usd IS NOT NULL AND quantity_kg > 0
            THEN ROUND(purchase_amount_usd / (quantity_kg / 1000), 6)
          WHEN purchase_price_usd IS NOT NULL AND input_mode = 'liters'
            THEN ROUND(purchase_price_usd * 1000 / NULLIF(density, 0), 6)
          WHEN purchase_price_usd IS NOT NULL
            THEN ROUND(purchase_price_usd * 1000, 6)
        END
      ) AS purchase_price_usd_per_tonne,
      COALESCE(
        purchase_price_rub_per_tonne,
        CASE
          WHEN purchase_amount_rub IS NOT NULL AND quantity_kg > 0
            THEN ROUND(purchase_amount_rub / (quantity_kg / 1000), 6)
          WHEN purchase_price_rub IS NOT NULL AND input_mode = 'liters'
            THEN ROUND(purchase_price_rub * 1000 / NULLIF(density, 0), 6)
          WHEN purchase_price_rub IS NOT NULL
            THEN ROUND(purchase_price_rub * 1000, 6)
        END
      ) AS purchase_price_rub_per_tonne,
      COALESCE(
        sale_price_usd_per_tonne,
        CASE
          WHEN sale_amount_usd IS NOT NULL AND quantity_kg > 0
            THEN ROUND(sale_amount_usd / (quantity_kg / 1000), 6)
          WHEN sale_price_usd IS NOT NULL AND input_mode = 'liters'
            THEN ROUND(sale_price_usd * 1000 / NULLIF(density, 0), 6)
          WHEN sale_price_usd IS NOT NULL
            THEN ROUND(sale_price_usd * 1000, 6)
        END
      ) AS sale_price_usd_per_tonne,
      COALESCE(
        sale_price_rub_per_tonne,
        CASE
          WHEN sale_amount_rub IS NOT NULL AND quantity_kg > 0
            THEN ROUND(sale_amount_rub / (quantity_kg / 1000), 6)
          WHEN sale_price_rub IS NOT NULL AND input_mode = 'liters'
            THEN ROUND(sale_price_rub * 1000 / NULLIF(density, 0), 6)
          WHEN sale_price_rub IS NOT NULL
            THEN ROUND(sale_price_rub * 1000, 6)
        END
      ) AS sale_price_rub_per_tonne
    FROM __refueling_abroad_mass_source
  `);

  await client.query(
    readFileSync(
      resolve("migrations/0098_refueling_abroad_mass_tonnes.sql"),
      "utf8",
    ),
  );

  const [comparison, targetColumns] = await Promise.all([
    client.query(`
      SELECT
        (SELECT COUNT(*)::bigint FROM __refueling_abroad_mass_source)
          AS source_rows,
        COUNT(*)::bigint AS actual_rows,
        COUNT(*) FILTER (
          WHERE expected.id IS NULL
            OR (to_jsonb(actual)
                - 'quantity_tonnes'
                - 'purchase_price_usd_per_tonne'
                - 'purchase_price_rub_per_tonne'
                - 'sale_price_usd_per_tonne'
                - 'sale_price_rub_per_tonne')
               IS DISTINCT FROM
               (source.original_row
                - 'quantity_tonnes'
                - 'purchase_price_usd_per_tonne'
                - 'purchase_price_rub_per_tonne'
                - 'sale_price_usd_per_tonne'
                - 'sale_price_rub_per_tonne')
            OR actual.quantity_tonnes IS DISTINCT FROM expected.quantity_tonnes
            OR actual.purchase_price_usd_per_tonne
               IS DISTINCT FROM expected.purchase_price_usd_per_tonne
            OR actual.purchase_price_rub_per_tonne
               IS DISTINCT FROM expected.purchase_price_rub_per_tonne
            OR actual.sale_price_usd_per_tonne
               IS DISTINCT FROM expected.sale_price_usd_per_tonne
            OR actual.sale_price_rub_per_tonne
               IS DISTINCT FROM expected.sale_price_rub_per_tonne
        )::bigint AS changed_value_rows,
        COUNT(*) FILTER (
          WHERE source.quantity_tonnes IS NULL
        )::bigint AS mass_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.purchase_price_usd_per_tonne IS NULL
            AND expected.purchase_price_usd_per_tonne IS NOT NULL
        )::bigint AS purchase_usd_rate_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.purchase_price_rub_per_tonne IS NULL
            AND expected.purchase_price_rub_per_tonne IS NOT NULL
        )::bigint AS purchase_rub_rate_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.sale_price_usd_per_tonne IS NULL
            AND expected.sale_price_usd_per_tonne IS NOT NULL
        )::bigint AS sale_usd_rate_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.sale_price_rub_per_tonne IS NULL
            AND expected.sale_price_rub_per_tonne IS NOT NULL
        )::bigint AS sale_rub_rate_rows_backfilled
      FROM refueling_abroad AS actual
      LEFT JOIN __refueling_abroad_mass_expected AS expected USING (id)
      LEFT JOIN __refueling_abroad_mass_source AS source USING (id)
    `),
    client.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'refueling_abroad'
        AND column_name IN (
          'quantity_tonnes',
          'purchase_price_usd_per_tonne',
          'purchase_price_rub_per_tonne',
          'sale_price_usd_per_tonne',
          'sale_price_rub_per_tonne'
        )
      ORDER BY column_name
    `),
  ]);
  const targetFields = [
    ["quantity_tonnes", 18, 5, "NO"],
    ["purchase_price_usd_per_tonne", 22, 6, "YES"],
    ["purchase_price_rub_per_tonne", 22, 6, "YES"],
    ["sale_price_usd_per_tonne", 22, 6, "YES"],
    ["sale_price_rub_per_tonne", 22, 6, "YES"],
  ];
  const typesAreValid =
    targetColumns.rows.length === targetFields.length &&
    targetFields.every(([name, precision, scale, nullable]) =>
      targetColumns.rows.some(
        (row) =>
          row.column_name === name &&
          row.data_type === "numeric" &&
          Number(row.numeric_precision) === precision &&
          Number(row.numeric_scale) === scale &&
          row.is_nullable === nullable,
      ),
    );
  const result = comparison.rows[0];
  return {
    ...result,
    passed:
      Number(result.source_rows) === Number(result.actual_rows) &&
      Number(result.changed_value_rows) === 0 &&
      typesAreValid,
    typesAreValid,
    targetColumns: targetColumns.rows,
    note: "Historical mass uses saved kg; rates retain the current total/mass display when totals exist, otherwise per-litre rates use deal density; all saved amounts and other source fields remain unchanged",
  };
}

async function rehearsePlanningMassBackfill(client) {
  const schema = await client.query(`
    SELECT table_name, column_name, data_type, numeric_precision, numeric_scale, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'plan_entries',
        'free_volume_allocations',
        'supplier_allocated_volumes',
        'planning_top_level_volumes'
      )
  `);
  const columns = new Set(
    schema.rows.map((row) => `${row.table_name}.${row.column_name}`),
  );
  const legacyRequirements = [
    "plan_entries.id",
    "plan_entries.volume",
    "plan_entries.balance_after",
    "free_volume_allocations.id",
    "free_volume_allocations.volume",
    "supplier_allocated_volumes.id",
    "supplier_allocated_volumes.volume",
    "planning_top_level_volumes.id",
    "planning_top_level_volumes.volume",
  ];
  const missingColumns = legacyRequirements.filter((column) => !columns.has(column));
  if (missingColumns.length) return { skipped: true, missingColumns };

  const savedField = (table, column, alias) =>
    columns.has(`${table}.${column}`) ? `${alias}.${column}` : "NULL::numeric";
  await client.query(`
    CREATE TEMP TABLE __planning_mass_source AS
    SELECT
      'plan_entries'::text AS table_name,
      pe.id,
      to_jsonb(pe) AS original_row,
      pe.volume AS volume_kg,
      pe.balance_after AS balance_after_kg,
      ${savedField("plan_entries", "volume_tonnes", "pe")} AS volume_tonnes,
      ${savedField("plan_entries", "balance_after_tonnes", "pe")} AS balance_after_tonnes
    FROM plan_entries pe
    UNION ALL
    SELECT
      'free_volume_allocations',
      fa.id,
      to_jsonb(fa),
      fa.volume,
      NULL::numeric,
      ${savedField("free_volume_allocations", "volume_tonnes", "fa")},
      NULL::numeric
    FROM free_volume_allocations fa
    UNION ALL
    SELECT
      'supplier_allocated_volumes',
      sa.id,
      to_jsonb(sa),
      sa.volume,
      NULL::numeric,
      ${savedField("supplier_allocated_volumes", "volume_tonnes", "sa")},
      NULL::numeric
    FROM supplier_allocated_volumes sa
    UNION ALL
    SELECT
      'planning_top_level_volumes',
      tl.id,
      to_jsonb(tl),
      tl.volume,
      NULL::numeric,
      ${savedField("planning_top_level_volumes", "volume_tonnes", "tl")},
      NULL::numeric
    FROM planning_top_level_volumes tl
  `);

  await client.query(`
    CREATE TEMP TABLE __planning_mass_expected AS
    SELECT
      table_name,
      id,
      original_row,
      volume_kg,
      balance_after_kg,
      COALESCE(volume_tonnes, ROUND(volume_kg::numeric / 1000, 5))
        AS volume_tonnes,
      CASE
        WHEN table_name <> 'plan_entries' THEN NULL::numeric
        WHEN balance_after_kg IS NULL THEN balance_after_tonnes
        ELSE COALESCE(
          balance_after_tonnes,
          ROUND(balance_after_kg::numeric / 1000, 5)
        )
      END AS balance_after_tonnes
    FROM __planning_mass_source
  `);

  await client.query(
    readFileSync(resolve("migrations/0099_planning_mass_tonnes.sql"), "utf8"),
  );

  const [comparison, targetColumns] = await Promise.all([
    client.query(`
      WITH actual AS (
        SELECT 'plan_entries'::text AS table_name, id, to_jsonb(pe) AS row_data,
          volume_tonnes, balance_after_tonnes
        FROM plan_entries pe
        UNION ALL
        SELECT 'free_volume_allocations', id, to_jsonb(fa),
          volume_tonnes, NULL::numeric
        FROM free_volume_allocations fa
        UNION ALL
        SELECT 'supplier_allocated_volumes', id, to_jsonb(sa),
          volume_tonnes, NULL::numeric
        FROM supplier_allocated_volumes sa
        UNION ALL
        SELECT 'planning_top_level_volumes', id, to_jsonb(tl),
          volume_tonnes, NULL::numeric
        FROM planning_top_level_volumes tl
      )
      SELECT
        (SELECT COUNT(*)::bigint FROM __planning_mass_source) AS source_rows,
        (SELECT COUNT(*)::bigint FROM actual) AS actual_rows,
        COUNT(*) FILTER (
          WHERE actual.id IS NULL
            OR (actual.row_data - 'volume_tonnes' - 'balance_after_tonnes')
               IS DISTINCT FROM
               (expected.original_row - 'volume_tonnes' - 'balance_after_tonnes')
            OR actual.volume_tonnes IS DISTINCT FROM expected.volume_tonnes
            OR actual.balance_after_tonnes
               IS DISTINCT FROM expected.balance_after_tonnes
        )::bigint AS changed_value_rows,
        COUNT(*) FILTER (
          WHERE source.volume_tonnes IS NULL
            AND expected.volume_tonnes IS NOT NULL
        )::bigint AS volume_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.table_name = 'plan_entries'
            AND source.balance_after_tonnes IS NULL
            AND expected.balance_after_tonnes IS NOT NULL
        )::bigint AS balance_rows_backfilled,
        COUNT(*) FILTER (
          WHERE expected.balance_after_tonnes IS NULL
        )::bigint AS null_balance_rows_preserved
      FROM __planning_mass_expected expected
      LEFT JOIN __planning_mass_source source
        ON source.table_name = expected.table_name AND source.id = expected.id
      LEFT JOIN actual
        ON actual.table_name = expected.table_name AND actual.id = expected.id
    `),
    client.query(`
      SELECT table_name, column_name, data_type, numeric_precision, numeric_scale, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'plan_entries'
            AND column_name IN ('volume_tonnes', 'balance_after_tonnes'))
          OR (table_name IN (
            'free_volume_allocations',
            'supplier_allocated_volumes',
            'planning_top_level_volumes'
          ) AND column_name = 'volume_tonnes')
        )
      ORDER BY table_name, column_name
    `),
  ]);

  const targetFields = [
    ["plan_entries", "volume_tonnes", 18, 5, "NO"],
    ["plan_entries", "balance_after_tonnes", 18, 5, "YES"],
    ["free_volume_allocations", "volume_tonnes", 18, 5, "NO"],
    ["supplier_allocated_volumes", "volume_tonnes", 18, 5, "NO"],
    ["planning_top_level_volumes", "volume_tonnes", 18, 5, "NO"],
  ];
  const typesAreValid =
    targetColumns.rows.length === targetFields.length &&
    targetFields.every(([table, column, precision, scale, nullable]) =>
      targetColumns.rows.some(
        (row) =>
          row.table_name === table &&
          row.column_name === column &&
          row.data_type === "numeric" &&
          Number(row.numeric_precision) === precision &&
          Number(row.numeric_scale) === scale &&
          row.is_nullable === nullable,
      ),
    );
  const result = comparison.rows[0];
  const passed =
    Number(result.source_rows) === Number(result.actual_rows) &&
    Number(result.changed_value_rows) === 0 &&
    typesAreValid;
  if (!passed) {
    throw new Error(
      `Planning mass rehearsal failed: ${JSON.stringify({
        sourceRows: result.source_rows,
        actualRows: result.actual_rows,
        changedRows: result.changed_value_rows,
        typesAreValid,
      })}`,
    );
  }
  return {
    ...result,
    passed,
    typesAreValid,
    targetColumns: targetColumns.rows,
    note: "All planning rows, including soft-deleted and scenario rows, are preserved; tonnes come only from saved kg; planned balances keep nullability; original kg fields and all other row values remain unchanged",
  };
}

async function rehearseBudgetSalesVolumeBackfill(client, databaseUrl) {
  const existingTonneColumn = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'budget_income_expense'
        AND column_name = 'sales_volume_tonnes'
    ) AS present
  `);
  const savedTonnes = existingTonneColumn.rows[0].present
    ? "sales_volume_tonnes"
    : "NULL::numeric";

  await client.query(`
    CREATE TEMP TABLE __budget_sales_volume_source AS
    SELECT
      id,
      to_jsonb(budget) AS original_row,
      sales_volume AS sales_volume_kg,
      ${savedTonnes} AS sales_volume_tonnes,
      deleted_at
    FROM budget_income_expense AS budget
  `);

  await client.query(
    readFileSync(resolve("migrations/0100_budget_sales_volume_tonnes.sql"), "utf8"),
  );

  const script = spawnSync(
    process.execPath,
    [
      resolve("scripts/backfill-budget-sales-volume.mjs"),
      "--target=development",
      "--apply",
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        NODE_ENV: "development",
      },
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    },
  );
  if (script.error || script.status !== 0) {
    throw new Error(
      `BDR backfill rehearsal script failed: ${script.error?.message ?? script.stderr}`,
    );
  }
  const scriptReport = JSON.parse(script.stdout);

  const [comparison, targetColumn] = await Promise.all([
    client.query(`
      WITH source_sales AS (
        SELECT
          date_trunc('month', deal_date) AS month_start,
          CASE
            WHEN CAST(COALESCE(quantity_liters, '0') AS NUMERIC) > 0
              AND CAST(COALESCE(density, '0') AS NUMERIC) > 0
            THEN CAST(quantity_liters AS NUMERIC)
              * CAST(density AS NUMERIC) / 1000
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
            THEN CAST(quantity_liters AS NUMERIC)
              * CAST(density AS NUMERIC) / 1000
            ELSE COALESCE(quantity_tonnes, CAST(quantity_kg AS NUMERIC) / 1000)
          END AS volume_tonnes
        FROM aircraft_refueling
        WHERE deleted_at IS NULL
      ),
      monthly_sales AS (
        SELECT month_start,
          ROUND(COALESCE(SUM(volume_tonnes), 0), 5) AS total_volume_tonnes
        FROM source_sales
        GROUP BY month_start
      ),
      expected AS (
        SELECT
          source.id,
          CASE
            WHEN source.deleted_at IS NULL
              THEN COALESCE(monthly_sales.total_volume_tonnes, 0)
            ELSE COALESCE(
              source.sales_volume_tonnes,
              CASE
                WHEN source.sales_volume_kg IS NULL
                  OR BTRIM(source.sales_volume_kg) = '' THEN NULL
                ELSE ROUND(source.sales_volume_kg::numeric / 1000, 5)
              END
            )
          END AS sales_volume_tonnes,
          CASE
            WHEN source.deleted_at IS NULL
              THEN (COALESCE(monthly_sales.total_volume_tonnes, 0) * 1000)::text
            ELSE source.sales_volume_kg
          END AS sales_volume_kg
        FROM __budget_sales_volume_source AS source
        LEFT JOIN budget_income_expense AS budget
          ON budget.id = source.id
        LEFT JOIN monthly_sales
          ON monthly_sales.month_start = date_trunc('month', budget.budget_month)
      ),
      actual AS (
        SELECT id, to_jsonb(budget) AS row_data,
          sales_volume, sales_volume_tonnes
        FROM budget_income_expense AS budget
      )
      SELECT
        (SELECT COUNT(*)::bigint FROM __budget_sales_volume_source) AS source_rows,
        (SELECT COUNT(*)::bigint FROM actual) AS actual_rows,
        COUNT(*) FILTER (
          WHERE actual.id IS NULL
            OR (actual.row_data - 'sales_volume' - 'sales_volume_tonnes')
              IS DISTINCT FROM
              (source.original_row - 'sales_volume' - 'sales_volume_tonnes')
        )::bigint AS changed_non_volume_rows,
        COUNT(*) FILTER (
          WHERE actual.sales_volume_tonnes IS DISTINCT FROM expected.sales_volume_tonnes
            OR actual.sales_volume IS DISTINCT FROM expected.sales_volume_kg
        )::bigint AS volume_mismatches,
        COUNT(*) FILTER (
          WHERE source.sales_volume_tonnes IS NULL
            AND expected.sales_volume_tonnes IS NOT NULL
        )::bigint AS tonne_rows_backfilled,
        COUNT(*) FILTER (
          WHERE source.deleted_at IS NOT NULL
        )::bigint AS soft_deleted_rows_preserved
      FROM __budget_sales_volume_source AS source
      LEFT JOIN expected ON expected.id = source.id
      LEFT JOIN actual ON actual.id = source.id
    `),
    client.query(`
      SELECT data_type, numeric_precision, numeric_scale, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'budget_income_expense'
        AND column_name = 'sales_volume_tonnes'
    `),
  ]);

  const column = targetColumn.rows[0];
  const typesAreValid =
    targetColumn.rows.length === 1
    && column.data_type === "numeric"
    && Number(column.numeric_precision) === 18
    && Number(column.numeric_scale) === 5
    && column.is_nullable === "YES";
  const result = comparison.rows[0];
  const passed =
    Number(result.source_rows) === Number(result.actual_rows)
    && Number(result.changed_non_volume_rows) === 0
    && Number(result.volume_mismatches) === 0
    && Number(scriptReport.activeBudgetRows)
      === Number(result.source_rows) - Number(result.soft_deleted_rows_preserved)
    && Number(scriptReport.rowsRecalculated) === Number(result.source_rows) - Number(result.soft_deleted_rows_preserved)
    && typesAreValid;
  if (!passed) {
    throw new Error(
      `BDR sales volume rehearsal failed: ${JSON.stringify({
        sourceRows: result.source_rows,
        actualRows: result.actual_rows,
        changedNonVolumeRows: result.changed_non_volume_rows,
        volumeMismatches: result.volume_mismatches,
        scriptReport,
        typesAreValid,
      })}`,
    );
  }

  return {
    ...result,
    ...scriptReport,
    passed,
    typesAreValid,
    targetColumn: column,
    note: "Legacy kg values are preserved for soft-deleted entries; active BDR rows are recalculated from non-deleted OPT and refueling deals, with money and other fields unchanged.",
  };
}

async function rehearseDeliveryCostRateBackfill(client) {
  const existingTonneColumn = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'delivery_cost'
        AND column_name = 'cost_per_tonne'
    ) AS present
  `);
  const savedTonnes = existingTonneColumn.rows[0].present
    ? "cost_per_tonne"
    : "NULL::numeric";

  await client.query(`
    CREATE TEMP TABLE __delivery_cost_rate_source AS
    SELECT
      id,
      to_jsonb(delivery) AS original_row,
      cost_per_kg,
      ${savedTonnes} AS cost_per_tonne
    FROM delivery_cost AS delivery
  `);
  await client.query(
    readFileSync(resolve("migrations/0101_delivery_cost_per_tonne.sql"), "utf8"),
  );

  const [comparison, targetColumn] = await Promise.all([
    client.query(`
      SELECT
        (SELECT COUNT(*) FROM __delivery_cost_rate_source)::int AS source_rows,
        (SELECT COUNT(*) FROM delivery_cost)::int AS actual_rows,
        (SELECT COUNT(*) FROM delivery_cost WHERE cost_per_tonne IS NOT NULL)::int
          AS tonne_rows,
        (SELECT COUNT(*) FROM __delivery_cost_rate_source source
         JOIN delivery_cost delivery USING (id)
         WHERE delivery.cost_per_tonne IS DISTINCT FROM
               ROUND(source.cost_per_kg * 1000, 6))::int AS rate_mismatches,
        (SELECT COUNT(*) FROM __delivery_cost_rate_source source
         JOIN delivery_cost delivery USING (id)
         WHERE (to_jsonb(delivery) - 'cost_per_tonne')
             IS DISTINCT FROM (source.original_row - 'cost_per_tonne'))::int
          AS changed_legacy_rows,
        (SELECT COUNT(*) FROM __delivery_cost_rate_source source
         JOIN delivery_cost delivery USING (id)
         WHERE source.cost_per_tonne IS NOT NULL
           AND delivery.cost_per_tonne IS DISTINCT FROM source.cost_per_tonne)::int
          AS changed_existing_tonne_rows
    `),
    client.query(`
      SELECT data_type, numeric_precision, numeric_scale, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'delivery_cost'
        AND column_name = 'cost_per_tonne'
    `),
  ]);

  const result = {
    ...comparison.rows[0],
    targetColumn: targetColumn.rows[0] ?? null,
  };
  const targetIsValid =
    result.targetColumn?.data_type === "numeric" &&
    Number(result.targetColumn?.numeric_precision) === 22 &&
    Number(result.targetColumn?.numeric_scale) === 6 &&
    result.targetColumn?.is_nullable === "YES";
  const passed =
    Number(result.source_rows) === Number(result.actual_rows) &&
    Number(result.tonne_rows) === Number(result.source_rows) &&
    Number(result.rate_mismatches) === 0 &&
    Number(result.changed_legacy_rows) === 0 &&
    Number(result.changed_existing_tonne_rows) === 0 &&
    targetIsValid;

  if (!passed) {
    throw new Error(
      `Delivery tariff rate rehearsal failed: ${JSON.stringify({
        ...result,
        passed,
      })}`,
    );
  }

  return { ...result, passed, targetIsValid };
}

async function rehearseSupplierBasisRatesBackfill(client) {
  const existingColumns = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'supplier_basis_prices'
      AND column_name IN (
        'service_price_per_tonne',
        'pvkj_price_per_tonne',
        'agent_fee_per_tonne'
      )
  `);
  const presentColumns = new Set(
    existingColumns.rows.map((row) => row.column_name),
  );
  const sourceField = (column) =>
    presentColumns.has(column) ? column : "NULL::numeric";

  await client.query(`
    CREATE TEMP TABLE __supplier_basis_rate_source AS
    SELECT
      id,
      to_jsonb(prices) AS original_row,
      service_price,
      pvkj_price,
      agent_fee,
      ${sourceField("service_price_per_tonne")} AS service_price_per_tonne,
      ${sourceField("pvkj_price_per_tonne")} AS pvkj_price_per_tonne,
      ${sourceField("agent_fee_per_tonne")} AS agent_fee_per_tonne
    FROM supplier_basis_prices AS prices
  `);
  await client.query(
    readFileSync(
      resolve("migrations/0102_supplier_basis_rates_per_tonne.sql"),
      "utf8",
    ),
  );

  const [comparison, targetColumns] = await Promise.all([
    client.query(`
      SELECT
        (SELECT COUNT(*) FROM __supplier_basis_rate_source)::int AS source_rows,
        (SELECT COUNT(*) FROM supplier_basis_prices)::int AS actual_rows,
        (SELECT COUNT(*) FROM supplier_basis_prices
         WHERE service_price_per_tonne IS NOT NULL
            OR pvkj_price_per_tonne IS NOT NULL
            OR agent_fee_per_tonne IS NOT NULL)::int AS tonne_rows,
        (SELECT COUNT(*) FROM __supplier_basis_rate_source source
         JOIN supplier_basis_prices target USING (id)
         WHERE (source.service_price_per_tonne IS NULL
                AND source.service_price IS NOT NULL AND
                target.service_price_per_tonne IS DISTINCT FROM
                  ROUND(source.service_price * 1000, 6))
            OR (source.pvkj_price_per_tonne IS NULL
                AND source.pvkj_price IS NOT NULL AND
                target.pvkj_price_per_tonne IS DISTINCT FROM
                  ROUND(source.pvkj_price * 1000, 6))
            OR (source.agent_fee_per_tonne IS NULL
                AND source.agent_fee IS NOT NULL AND
                target.agent_fee_per_tonne IS DISTINCT FROM
                  ROUND(source.agent_fee * 1000, 6)))::int AS backfill_mismatches,
        (SELECT COUNT(*) FROM __supplier_basis_rate_source source
         JOIN supplier_basis_prices target USING (id)
         WHERE (to_jsonb(target) - 'service_price_per_tonne'
                              - 'pvkj_price_per_tonne'
                              - 'agent_fee_per_tonne')
             IS DISTINCT FROM (source.original_row - 'service_price_per_tonne'
                                                - 'pvkj_price_per_tonne'
                                                - 'agent_fee_per_tonne'))::int
          AS changed_legacy_rows,
        (SELECT COUNT(*) FROM __supplier_basis_rate_source source
         JOIN supplier_basis_prices target USING (id)
         WHERE (source.service_price_per_tonne IS NOT NULL AND
                target.service_price_per_tonne IS DISTINCT FROM
                  source.service_price_per_tonne)
            OR (source.pvkj_price_per_tonne IS NOT NULL AND
                target.pvkj_price_per_tonne IS DISTINCT FROM
                  source.pvkj_price_per_tonne)
            OR (source.agent_fee_per_tonne IS NOT NULL AND
                target.agent_fee_per_tonne IS DISTINCT FROM
                  source.agent_fee_per_tonne))::int AS changed_existing_tonne_rows
    `),
    client.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'supplier_basis_prices'
        AND column_name IN (
          'service_price_per_tonne',
          'pvkj_price_per_tonne',
          'agent_fee_per_tonne'
        )
    `),
  ]);

  const expectedColumns = [
    "service_price_per_tonne",
    "pvkj_price_per_tonne",
    "agent_fee_per_tonne",
  ];
  const validColumns =
    targetColumns.rows.length === expectedColumns.length &&
    expectedColumns.every((column) => {
      const target = targetColumns.rows.find((row) => row.column_name === column);
      return (
        target?.data_type === "numeric" &&
        Number(target.numeric_precision) === 22 &&
        Number(target.numeric_scale) === 6 &&
        target.is_nullable === "YES"
      );
    });
  const result = {
    ...comparison.rows[0],
    targetColumns: targetColumns.rows,
  };
  const passed =
    Number(result.source_rows) === Number(result.actual_rows) &&
    Number(result.backfill_mismatches) === 0 &&
    Number(result.changed_legacy_rows) === 0 &&
    Number(result.changed_existing_tonne_rows) === 0 &&
    validColumns;
  if (!passed) {
    throw new Error(
      `Supplier basis rate rehearsal failed: ${JSON.stringify({
        ...result,
        passed,
        validColumns,
      })}`,
    );
  }
  return { ...result, passed, validColumns };
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
      "volume_unit",
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
      const volumeUnitExpression = columnMap.has("prices.volume_unit")
        ? "volume_unit"
        : "'kg'::text";
      const result = await client.query(`
        SELECT
          limit_type,
          price_unit,
          ${volumeUnitExpression} AS volume_unit,
          COUNT(*)::bigint AS price_rows,
          COUNT(*) FILTER (WHERE volume IS NOT NULL)::bigint AS rows_with_volume,
          MIN(volume)::text AS min_volume,
          MAX(volume)::text AS max_volume,
          COUNT(*) FILTER (WHERE sold_volume IS NOT NULL)::bigint AS rows_with_sold_volume,
          COUNT(*) FILTER (WHERE max_deal_amount IS NOT NULL)::bigint AS rows_with_amount_limit
        FROM prices
        GROUP BY limit_type, price_unit, ${volumeUnitExpression}
        ORDER BY limit_type, price_unit, volume_unit
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
    let priceVolumeRehearsal;
    try {
      priceVolumeRehearsal = await rehearsePriceVolumes(client, columnMap);
    } finally {
      await client.query("ROLLBACK");
    }
    const priceVolumeSchemaMigration =
      await rehearsePriceVolumeSchemaMigration(client, columnMap);
    const priceMassBackfill = await rehearsePriceMassBackfill(client);
    const knownScalarPriceRateNormalization =
      await rehearseKnownScalarPriceRateNormalization(client);
    const logisticsCapacityBackfill =
      await rehearseLogisticsCapacityBackfill(client);
    const warehouseLimitBackfill =
      await rehearseWarehouseLimitBackfill(client);
    const warehouseStockMassBackfill =
      await rehearseWarehouseStockMassBackfill(client);
    const equipmentStockMassBackfill =
      await rehearseEquipmentStockMassBackfill(client);
    const equipmentMovementMassBackfill =
      await rehearseEquipmentMovementMassBackfill(client);
    const movementMassBackfill = await rehearseMovementMassBackfill(client);
    const transportationMassBackfill =
      await rehearseTransportationMassBackfill(client);
    const refuelingMassBackfill =
      await rehearseAircraftRefuelingMassBackfill(client);
    const optMassBackfill = await rehearseOptMassBackfill(client);
    const refuelingAbroadMassBackfill =
      await rehearseRefuelingAbroadMassBackfill(client);
    const planningMassBackfill =
      await rehearsePlanningMassBackfill(client);
    const budgetSalesVolumeBackfill =
      await rehearseBudgetSalesVolumeBackfill(client, databaseEnvironment.DATABASE_URL);
    const deliveryCostRateBackfill =
      await rehearseDeliveryCostRateBackfill(client);
    const supplierBasisRatesBackfill =
      await rehearseSupplierBasisRatesBackfill(client);

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
        priceVolumes: priceVolumeRehearsal,
        priceVolumeSchemaMigration,
        priceMassBackfill,
        knownScalarPriceRateNormalization,
        logisticsCapacityBackfill,
        warehouseLimitBackfill,
        warehouseStockMassBackfill,
        equipmentStockMassBackfill,
        equipmentMovementMassBackfill,
        movementMassBackfill,
        transportationMassBackfill,
        refuelingMassBackfill,
        optMassBackfill,
        refuelingAbroadMassBackfill,
        planningMassBackfill,
        budgetSalesVolumeBackfill,
        deliveryCostRateBackfill,
        supplierBasisRatesBackfill,
        financialAggregateColumnsCompared: sourceFinancialTotals.size,
        financialAggregateChanges: changedFinancialTotals.length,
        note: "Schema/backfill migrations run only on the disposable restored database; temporary rehearsal columns are rolled back.",
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
