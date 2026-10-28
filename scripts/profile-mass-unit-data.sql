\set ON_ERROR_STOP on

-- Read-only preflight for an isolated, restored PostgreSQL copy.
-- Run with: psql "$ISOLATED_DATABASE_URL" -X -f scripts/profile-mass-unit-data.sql
-- This script intentionally returns aggregates only; it does not emit names or deal rows.
BEGIN TRANSACTION READ ONLY;

-- Mass fields currently stored in kilograms (and planning/stock snapshots).
SELECT *
FROM (
  SELECT 'opt.quantity_kg' AS field, COUNT(*) AS rows_total,
    COUNT(*) FILTER (WHERE quantity_kg IS NULL) AS null_rows,
    COUNT(*) FILTER (WHERE quantity_kg < 0) AS negative_rows,
    COUNT(*) FILTER (WHERE quantity_kg = 0) AS zero_rows,
    MIN(quantity_kg)::text AS min_value, MAX(quantity_kg)::text AS max_value
  FROM opt
  UNION ALL
  SELECT 'aircraft_refueling.quantity_kg', COUNT(*),
    COUNT(*) FILTER (WHERE quantity_kg IS NULL),
    COUNT(*) FILTER (WHERE quantity_kg < 0),
    COUNT(*) FILTER (WHERE quantity_kg = 0),
    MIN(quantity_kg)::text, MAX(quantity_kg)::text
  FROM aircraft_refueling
  UNION ALL
  SELECT 'transportation.quantity_kg', COUNT(*),
    COUNT(*) FILTER (WHERE quantity_kg IS NULL),
    COUNT(*) FILTER (WHERE quantity_kg < 0),
    COUNT(*) FILTER (WHERE quantity_kg = 0),
    MIN(quantity_kg)::text, MAX(quantity_kg)::text
  FROM transportation
  UNION ALL
  SELECT 'movement.quantity_kg', COUNT(*),
    COUNT(*) FILTER (WHERE quantity_kg IS NULL),
    COUNT(*) FILTER (WHERE quantity_kg < 0),
    COUNT(*) FILTER (WHERE quantity_kg = 0),
    MIN(quantity_kg)::text, MAX(quantity_kg)::text
  FROM movement
  UNION ALL
  SELECT 'refueling_abroad.quantity_kg', COUNT(*),
    COUNT(*) FILTER (WHERE quantity_kg IS NULL),
    COUNT(*) FILTER (WHERE quantity_kg < 0),
    COUNT(*) FILTER (WHERE quantity_kg = 0),
    MIN(quantity_kg)::text, MAX(quantity_kg)::text
  FROM refueling_abroad
  UNION ALL
  SELECT 'equipment_movement.quantity_kg', COUNT(*),
    COUNT(*) FILTER (WHERE quantity_kg IS NULL),
    COUNT(*) FILTER (WHERE quantity_kg < 0),
    COUNT(*) FILTER (WHERE quantity_kg = 0),
    MIN(quantity_kg)::text, MAX(quantity_kg)::text
  FROM equipment_movement
  UNION ALL
  SELECT 'warehouse_transactions.quantity', COUNT(*),
    COUNT(*) FILTER (WHERE quantity IS NULL),
    COUNT(*) FILTER (WHERE quantity < 0),
    COUNT(*) FILTER (WHERE quantity = 0),
    MIN(quantity)::text, MAX(quantity)::text
  FROM warehouse_transactions
  UNION ALL
  SELECT 'warehouse_transactions.balance_before', COUNT(*),
    COUNT(*) FILTER (WHERE balance_before IS NULL),
    COUNT(*) FILTER (WHERE balance_before < 0),
    COUNT(*) FILTER (WHERE balance_before = 0),
    MIN(balance_before)::text, MAX(balance_before)::text
  FROM warehouse_transactions
  UNION ALL
  SELECT 'warehouse_transactions.balance_after', COUNT(*),
    COUNT(*) FILTER (WHERE balance_after IS NULL),
    COUNT(*) FILTER (WHERE balance_after < 0),
    COUNT(*) FILTER (WHERE balance_after = 0),
    MIN(balance_after)::text, MAX(balance_after)::text
  FROM warehouse_transactions
  UNION ALL
  SELECT 'equipment_transactions.quantity', COUNT(*),
    COUNT(*) FILTER (WHERE quantity IS NULL),
    COUNT(*) FILTER (WHERE quantity < 0),
    COUNT(*) FILTER (WHERE quantity = 0),
    MIN(quantity)::text, MAX(quantity)::text
  FROM equipment_transactions
  UNION ALL
  SELECT 'equipment_transactions.balance_before', COUNT(*),
    COUNT(*) FILTER (WHERE balance_before IS NULL),
    COUNT(*) FILTER (WHERE balance_before < 0),
    COUNT(*) FILTER (WHERE balance_before = 0),
    MIN(balance_before)::text, MAX(balance_before)::text
  FROM equipment_transactions
  UNION ALL
  SELECT 'equipment_transactions.balance_after', COUNT(*),
    COUNT(*) FILTER (WHERE balance_after IS NULL),
    COUNT(*) FILTER (WHERE balance_after < 0),
    COUNT(*) FILTER (WHERE balance_after = 0),
    MIN(balance_after)::text, MAX(balance_after)::text
  FROM equipment_transactions
  UNION ALL
  SELECT 'warehouses.current_balance', COUNT(*),
    COUNT(*) FILTER (WHERE current_balance IS NULL),
    COUNT(*) FILTER (WHERE current_balance < 0),
    COUNT(*) FILTER (WHERE current_balance = 0),
    MIN(current_balance)::text, MAX(current_balance)::text
  FROM warehouses
  UNION ALL
  SELECT 'warehouses.pvkj_balance', COUNT(*),
    COUNT(*) FILTER (WHERE pvkj_balance IS NULL),
    COUNT(*) FILTER (WHERE pvkj_balance < 0),
    COUNT(*) FILTER (WHERE pvkj_balance = 0),
    MIN(pvkj_balance)::text, MAX(pvkj_balance)::text
  FROM warehouses
  UNION ALL
  SELECT 'equipments.current_balance', COUNT(*),
    COUNT(*) FILTER (WHERE current_balance IS NULL),
    COUNT(*) FILTER (WHERE current_balance < 0),
    COUNT(*) FILTER (WHERE current_balance = 0),
    MIN(current_balance)::text, MAX(current_balance)::text
  FROM equipments
  UNION ALL
  SELECT 'equipments.pvkj_balance', COUNT(*),
    COUNT(*) FILTER (WHERE pvkj_balance IS NULL),
    COUNT(*) FILTER (WHERE pvkj_balance < 0),
    COUNT(*) FILTER (WHERE pvkj_balance = 0),
    MIN(pvkj_balance)::text, MAX(pvkj_balance)::text
  FROM equipments
  UNION ALL
  SELECT 'plan_entries.volume', COUNT(*),
    COUNT(*) FILTER (WHERE volume IS NULL),
    COUNT(*) FILTER (WHERE volume < 0),
    COUNT(*) FILTER (WHERE volume = 0),
    MIN(volume)::text, MAX(volume)::text
  FROM plan_entries
  UNION ALL
  SELECT 'plan_entries.balance_after', COUNT(*),
    COUNT(*) FILTER (WHERE balance_after IS NULL),
    COUNT(*) FILTER (WHERE balance_after < 0),
    COUNT(*) FILTER (WHERE balance_after = 0),
    MIN(balance_after)::text, MAX(balance_after)::text
  FROM plan_entries
  UNION ALL
  SELECT 'free_volume_allocations.volume', COUNT(*),
    COUNT(*) FILTER (WHERE volume IS NULL),
    COUNT(*) FILTER (WHERE volume < 0),
    COUNT(*) FILTER (WHERE volume = 0),
    MIN(volume)::text, MAX(volume)::text
  FROM free_volume_allocations
  UNION ALL
  SELECT 'supplier_allocated_volumes.volume', COUNT(*),
    COUNT(*) FILTER (WHERE volume IS NULL),
    COUNT(*) FILTER (WHERE volume < 0),
    COUNT(*) FILTER (WHERE volume = 0),
    MIN(volume)::text, MAX(volume)::text
  FROM supplier_allocated_volumes
  UNION ALL
  SELECT 'planning_top_level_volumes.volume', COUNT(*),
    COUNT(*) FILTER (WHERE volume IS NULL),
    COUNT(*) FILTER (WHERE volume < 0),
    COUNT(*) FILTER (WHERE volume = 0),
    MIN(volume)::text, MAX(volume)::text
  FROM planning_top_level_volumes
  UNION ALL
  SELECT 'logistics_vehicles.capacity_kg', COUNT(*),
    COUNT(*) FILTER (WHERE capacity_kg IS NULL),
    COUNT(*) FILTER (WHERE capacity_kg < 0),
    COUNT(*) FILTER (WHERE capacity_kg = 0),
    MIN(capacity_kg)::text, MAX(capacity_kg)::text
  FROM logistics_vehicles
  UNION ALL
  SELECT 'logistics_trailers.capacity_kg', COUNT(*),
    COUNT(*) FILTER (WHERE capacity_kg IS NULL),
    COUNT(*) FILTER (WHERE capacity_kg < 0),
    COUNT(*) FILTER (WHERE capacity_kg = 0),
    MIN(capacity_kg)::text, MAX(capacity_kg)::text
  FROM logistics_trailers
  UNION ALL
  SELECT 'warehouses.limit_volume', COUNT(*),
    COUNT(*) FILTER (WHERE limit_volume IS NULL),
    COUNT(*) FILTER (WHERE limit_volume < 0),
    COUNT(*) FILTER (WHERE limit_volume = 0),
    MIN(limit_volume)::text, MAX(limit_volume)::text
  FROM warehouses
) AS mass_profile
ORDER BY field;

-- Measure discrepancies between stored kg and liters × density.
-- Differences greater than 0.005 kg exceed half the stored numeric(15,2) step.
WITH deal_mass AS (
  SELECT 'opt' AS source, quantity_kg, quantity_liters, density FROM opt
  UNION ALL
  SELECT 'aircraft_refueling', quantity_kg, quantity_liters, density FROM aircraft_refueling
  UNION ALL
  SELECT 'transportation', quantity_kg, quantity_liters, density FROM transportation
  UNION ALL
  SELECT 'movement', quantity_kg, quantity_liters, density FROM movement
  UNION ALL
  SELECT 'refueling_abroad', quantity_kg, quantity_liters, density FROM refueling_abroad
  UNION ALL
  SELECT 'equipment_movement', quantity_kg, quantity_liters, density FROM equipment_movement
),
measured AS (
  SELECT source, ABS(quantity_kg - quantity_liters * density) AS delta_kg
  FROM deal_mass
  WHERE quantity_kg IS NOT NULL
    AND quantity_liters IS NOT NULL
    AND quantity_liters > 0
    AND density IS NOT NULL
    AND density > 0
)
SELECT
  source,
  COUNT(*) AS comparable_rows,
  COUNT(*) FILTER (WHERE delta_kg > 0.005) AS over_rounding_tolerance,
  MAX(delta_kg)::text AS max_delta_kg
FROM measured
GROUP BY source
ORDER BY source;

-- Price limits can be mass, liters, or money; keep their unit categories visible.
SELECT
  limit_type,
  price_unit,
  COUNT(*) AS price_rows,
  COUNT(*) FILTER (WHERE volume IS NOT NULL) AS rows_with_volume,
  MIN(volume)::text AS min_volume,
  MAX(volume)::text AS max_volume,
  COUNT(*) FILTER (WHERE max_deal_amount IS NOT NULL) AS rows_with_amount_limit
FROM prices
GROUP BY limit_type, price_unit
ORDER BY limit_type, price_unit;

-- sales_volume is text; identify values that cannot be parsed as a decimal.
SELECT
  COUNT(*) AS budget_rows,
  COUNT(*) FILTER (WHERE sales_volume IS NOT NULL) AS populated_sales_volume,
  COUNT(*) FILTER (
    WHERE sales_volume IS NOT NULL
      AND BTRIM(sales_volume) !~ '^-?[0-9]+([.][0-9]+)?$'
  ) AS non_numeric_sales_volume
FROM budget_income_expense;

ROLLBACK;
