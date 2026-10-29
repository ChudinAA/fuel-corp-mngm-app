BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '2min';

-- Refuse to remove mirrors until every field consumed by the tonne-only
-- application schema exists.
DO $$
DECLARE
  required_column record;
BEGIN
  FOR required_column IN
    SELECT *
    FROM (VALUES
      ('logistics_vehicles', 'capacity_tonnes'),
      ('logistics_trailers', 'capacity_tonnes'),
      ('warehouses', 'current_balance_tonnes'),
      ('warehouses', 'pvkj_balance_tonnes'),
      ('warehouses', 'average_cost_per_tonne'),
      ('warehouses', 'pvkj_average_cost_per_tonne'),
      ('warehouses', 'limit_volume_tonnes'),
      ('warehouse_transactions', 'quantity_tonnes'),
      ('warehouse_transactions', 'balance_before_tonnes'),
      ('warehouse_transactions', 'balance_after_tonnes'),
      ('warehouse_transactions', 'price_per_tonne'),
      ('warehouse_transactions', 'average_cost_before_per_tonne'),
      ('warehouse_transactions', 'average_cost_after_per_tonne'),
      ('equipments', 'current_balance_tonnes'),
      ('equipments', 'pvkj_balance_tonnes'),
      ('equipments', 'average_cost_per_tonne'),
      ('equipments', 'pvkj_average_cost_per_tonne'),
      ('equipment_transactions', 'quantity_tonnes'),
      ('equipment_transactions', 'balance_before_tonnes'),
      ('equipment_transactions', 'balance_after_tonnes'),
      ('equipment_transactions', 'price_per_tonne'),
      ('equipment_transactions', 'average_cost_before_per_tonne'),
      ('equipment_transactions', 'average_cost_after_per_tonne'),
      ('equipment_movement', 'quantity_tonnes'),
      ('equipment_movement', 'cost_per_tonne'),
      ('movement', 'quantity_tonnes'),
      ('movement', 'purchase_price_per_tonne'),
      ('movement', 'delivery_price_per_tonne'),
      ('movement', 'cost_per_tonne'),
      ('transportation', 'quantity_tonnes'),
      ('transportation', 'purchase_price_per_tonne'),
      ('transportation', 'sale_price_per_tonne'),
      ('transportation', 'delivery_tariff_per_tonne'),
      ('aircraft_refueling', 'quantity_tonnes'),
      ('aircraft_refueling', 'purchase_price_per_tonne'),
      ('aircraft_refueling', 'sale_price_per_tonne'),
      ('aircraft_refueling', 'agent_fee_rate_per_tonne'),
      ('refueling_abroad', 'quantity_tonnes'),
      ('refueling_abroad', 'purchase_price_usd_per_tonne'),
      ('refueling_abroad', 'purchase_price_rub_per_tonne'),
      ('refueling_abroad', 'sale_price_usd_per_tonne'),
      ('refueling_abroad', 'sale_price_rub_per_tonne'),
      ('opt', 'quantity_tonnes'),
      ('opt', 'purchase_price_per_tonne'),
      ('opt', 'sale_price_per_tonne'),
      ('opt', 'delivery_tariff_per_tonne'),
      ('plan_entries', 'volume_tonnes'),
      ('plan_entries', 'balance_after_tonnes'),
      ('free_volume_allocations', 'volume_tonnes'),
      ('supplier_allocated_volumes', 'volume_tonnes'),
      ('planning_top_level_volumes', 'volume_tonnes'),
      ('budget_income_expense', 'sales_volume_tonnes'),
      ('delivery_cost', 'cost_per_tonne'),
      ('supplier_basis_prices', 'service_price_per_tonne'),
      ('supplier_basis_prices', 'pvkj_price_per_tonne'),
      ('supplier_basis_prices', 'agent_fee_per_tonne'),
      ('government_contracts', 'planned_volume_tonnes'),
      ('government_contracts', 'actual_volume_tonnes')
    ) AS required(table_name, column_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = required_column.table_name
        AND column_name = required_column.column_name
    ) THEN
      RAISE EXCEPTION
        'Required tonne column public.%.% is missing; apply earlier tonne backfills first',
        required_column.table_name,
        required_column.column_name;
    END IF;
  END LOOP;
END $$;

-- Verify the old values that are still present have corresponding tonne
-- values. Old columns are never used as the source when a tonne value exists.
DO $$
DECLARE
  backfill_check record;
  is_incomplete boolean;
BEGIN
  FOR backfill_check IN
    SELECT *
    FROM (VALUES
      ('vehicle capacity', 'SELECT EXISTS (SELECT 1 FROM public.logistics_vehicles WHERE capacity_kg IS NOT NULL AND capacity_tonnes IS NULL)'),
      ('trailer capacity', 'SELECT EXISTS (SELECT 1 FROM public.logistics_trailers WHERE capacity_kg IS NOT NULL AND capacity_tonnes IS NULL)'),
      ('warehouse balances, rates, and limits', 'SELECT EXISTS (SELECT 1 FROM public.warehouses WHERE (current_balance IS NOT NULL AND current_balance_tonnes IS NULL) OR (pvkj_balance IS NOT NULL AND pvkj_balance_tonnes IS NULL) OR (average_cost IS NOT NULL AND average_cost_per_tonne IS NULL) OR (pvkj_average_cost IS NOT NULL AND pvkj_average_cost_per_tonne IS NULL) OR (limit_volume IS NOT NULL AND limit_volume_tonnes IS NULL))'),
      ('warehouse transactions', 'SELECT EXISTS (SELECT 1 FROM public.warehouse_transactions WHERE (quantity IS NOT NULL AND quantity_tonnes IS NULL) OR (balance_before IS NOT NULL AND balance_before_tonnes IS NULL) OR (balance_after IS NOT NULL AND balance_after_tonnes IS NULL) OR (price IS NOT NULL AND price_per_tonne IS NULL) OR (average_cost_before IS NOT NULL AND average_cost_before_per_tonne IS NULL) OR (average_cost_after IS NOT NULL AND average_cost_after_per_tonne IS NULL))'),
      ('equipment balances and rates', 'SELECT EXISTS (SELECT 1 FROM public.equipments WHERE (current_balance IS NOT NULL AND current_balance_tonnes IS NULL) OR (pvkj_balance IS NOT NULL AND pvkj_balance_tonnes IS NULL) OR (average_cost IS NOT NULL AND average_cost_per_tonne IS NULL) OR (pvkj_average_cost IS NOT NULL AND pvkj_average_cost_per_tonne IS NULL))'),
      ('equipment transactions', 'SELECT EXISTS (SELECT 1 FROM public.equipment_transactions WHERE (quantity IS NOT NULL AND quantity_tonnes IS NULL) OR (balance_before IS NOT NULL AND balance_before_tonnes IS NULL) OR (balance_after IS NOT NULL AND balance_after_tonnes IS NULL) OR (price IS NOT NULL AND price_per_tonne IS NULL) OR (average_cost_before IS NOT NULL AND average_cost_before_per_tonne IS NULL) OR (average_cost_after IS NOT NULL AND average_cost_after_per_tonne IS NULL))'),
      ('equipment movements', 'SELECT EXISTS (SELECT 1 FROM public.equipment_movement WHERE (quantity_kg IS NOT NULL AND quantity_tonnes IS NULL) OR (cost_per_kg IS NOT NULL AND cost_per_tonne IS NULL))'),
      ('movements', 'SELECT EXISTS (SELECT 1 FROM public.movement WHERE (quantity_kg IS NOT NULL AND quantity_tonnes IS NULL) OR (purchase_price IS NOT NULL AND purchase_price_per_tonne IS NULL) OR (delivery_price IS NOT NULL AND delivery_price_per_tonne IS NULL) OR (cost_per_kg IS NOT NULL AND cost_per_tonne IS NULL))'),
      ('transportation', 'SELECT EXISTS (SELECT 1 FROM public.transportation WHERE (quantity_kg IS NOT NULL AND quantity_tonnes IS NULL) OR (purchase_price IS NOT NULL AND purchase_price_per_tonne IS NULL) OR (sale_price IS NOT NULL AND sale_price_per_tonne IS NULL) OR (delivery_tariff IS NOT NULL AND delivery_tariff_per_tonne IS NULL))'),
      ('aircraft refueling', 'SELECT EXISTS (SELECT 1 FROM public.aircraft_refueling WHERE (quantity_kg IS NOT NULL AND quantity_tonnes IS NULL) OR (purchase_price IS NOT NULL AND purchase_price_per_tonne IS NULL) OR (sale_price IS NOT NULL AND sale_price_per_tonne IS NULL) OR (agent_fee_rate IS NOT NULL AND agent_fee_rate_per_tonne IS NULL))'),
      ('foreign refueling', 'SELECT EXISTS (SELECT 1 FROM public.refueling_abroad WHERE (quantity_kg IS NOT NULL AND quantity_tonnes IS NULL) OR (purchase_price_usd IS NOT NULL AND purchase_price_usd_per_tonne IS NULL) OR (purchase_price_rub IS NOT NULL AND purchase_price_rub_per_tonne IS NULL) OR (sale_price_usd IS NOT NULL AND sale_price_usd_per_tonne IS NULL) OR (sale_price_rub IS NOT NULL AND sale_price_rub_per_tonne IS NULL))'),
      ('opt deals', 'SELECT EXISTS (SELECT 1 FROM public.opt WHERE (quantity_kg IS NOT NULL AND quantity_tonnes IS NULL) OR (purchase_price IS NOT NULL AND purchase_price_per_tonne IS NULL) OR (sale_price IS NOT NULL AND sale_price_per_tonne IS NULL) OR (delivery_tariff IS NOT NULL AND delivery_tariff_per_tonne IS NULL))'),
      ('planning entries', 'SELECT EXISTS (SELECT 1 FROM public.plan_entries WHERE (volume IS NOT NULL AND volume_tonnes IS NULL) OR (balance_after IS NOT NULL AND balance_after_tonnes IS NULL))'),
      ('free-volume allocations', 'SELECT EXISTS (SELECT 1 FROM public.free_volume_allocations WHERE volume IS NOT NULL AND volume_tonnes IS NULL)'),
      ('supplier allocations', 'SELECT EXISTS (SELECT 1 FROM public.supplier_allocated_volumes WHERE volume IS NOT NULL AND volume_tonnes IS NULL)'),
      ('planning top-level volumes', 'SELECT EXISTS (SELECT 1 FROM public.planning_top_level_volumes WHERE volume IS NOT NULL AND volume_tonnes IS NULL)'),
      ('budget sales volume', 'SELECT EXISTS (SELECT 1 FROM public.budget_income_expense WHERE sales_volume IS NOT NULL AND sales_volume_tonnes IS NULL)'),
      ('delivery rates', 'SELECT EXISTS (SELECT 1 FROM public.delivery_cost WHERE cost_per_kg IS NOT NULL AND cost_per_tonne IS NULL)'),
      ('supplier basis rates', 'SELECT EXISTS (SELECT 1 FROM public.supplier_basis_prices WHERE (service_price IS NOT NULL AND service_price_per_tonne IS NULL) OR (pvkj_price IS NOT NULL AND pvkj_price_per_tonne IS NULL) OR (agent_fee IS NOT NULL AND agent_fee_per_tonne IS NULL))'),
      ('government-contract volumes', 'SELECT EXISTS (SELECT 1 FROM public.government_contracts WHERE (length(btrim(planned_volume)) > 0 AND planned_volume_tonnes IS NULL) OR (length(btrim(actual_volume)) > 0 AND actual_volume_tonnes IS NULL))')
    ) AS checks(label, sql_text)
  LOOP
    EXECUTE backfill_check.sql_text INTO is_incomplete;
    IF is_incomplete THEN
      RAISE EXCEPTION
        'Cannot drop kilogram compatibility columns: tonne backfill is incomplete for %',
        backfill_check.label;
    END IF;
  END LOOP;
END $$;

-- These unit columns remain useful for tonne-versus-litre pricing, but no
-- stored value may use a unit that the tonne-only runtime no longer accepts.
DO $$
DECLARE
  has_legacy_units boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'prices'
      AND column_name IN ('price_unit', 'volume_unit')
    GROUP BY table_name
    HAVING COUNT(*) = 2
  ) THEN
    EXECUTE
      'SELECT EXISTS (
         SELECT 1
         FROM public.prices
         WHERE (price_unit IS NOT NULL AND price_unit NOT IN (''tonne'', ''liter''))
            OR (volume_unit IS NOT NULL AND volume_unit NOT IN (''tonne'', ''liter''))
       )'
      INTO has_legacy_units;
    IF has_legacy_units THEN
      RAISE EXCEPTION
        'Cannot remove kilogram compatibility: prices contain unsupported price or volume units; normalize those records first';
    END IF;
  END IF;
END $$;

ALTER TABLE IF EXISTS public.logistics_vehicles
  DROP COLUMN IF EXISTS capacity_kg;
ALTER TABLE IF EXISTS public.logistics_trailers
  DROP COLUMN IF EXISTS capacity_kg;

ALTER TABLE IF EXISTS public.warehouses
  DROP COLUMN IF EXISTS current_balance,
  DROP COLUMN IF EXISTS average_cost,
  DROP COLUMN IF EXISTS pvkj_balance,
  DROP COLUMN IF EXISTS pvkj_average_cost,
  DROP COLUMN IF EXISTS limit_volume;
ALTER TABLE IF EXISTS public.warehouse_transactions
  DROP COLUMN IF EXISTS quantity,
  DROP COLUMN IF EXISTS balance_before,
  DROP COLUMN IF EXISTS balance_after,
  DROP COLUMN IF EXISTS average_cost_before,
  DROP COLUMN IF EXISTS average_cost_after,
  DROP COLUMN IF EXISTS price;

ALTER TABLE IF EXISTS public.equipments
  DROP COLUMN IF EXISTS current_balance,
  DROP COLUMN IF EXISTS average_cost,
  DROP COLUMN IF EXISTS pvkj_balance,
  DROP COLUMN IF EXISTS pvkj_average_cost;
ALTER TABLE IF EXISTS public.equipment_transactions
  DROP COLUMN IF EXISTS quantity,
  DROP COLUMN IF EXISTS balance_before,
  DROP COLUMN IF EXISTS balance_after,
  DROP COLUMN IF EXISTS average_cost_before,
  DROP COLUMN IF EXISTS average_cost_after,
  DROP COLUMN IF EXISTS price;

ALTER TABLE IF EXISTS public.equipment_movement
  DROP COLUMN IF EXISTS quantity_kg,
  DROP COLUMN IF EXISTS cost_per_kg;
ALTER TABLE IF EXISTS public.movement
  DROP COLUMN IF EXISTS quantity_kg,
  DROP COLUMN IF EXISTS purchase_price,
  DROP COLUMN IF EXISTS delivery_price,
  DROP COLUMN IF EXISTS cost_per_kg;
ALTER TABLE IF EXISTS public.transportation
  DROP COLUMN IF EXISTS quantity_kg,
  DROP COLUMN IF EXISTS purchase_price,
  DROP COLUMN IF EXISTS sale_price,
  DROP COLUMN IF EXISTS delivery_tariff;
ALTER TABLE IF EXISTS public.aircraft_refueling
  DROP COLUMN IF EXISTS quantity_kg,
  DROP COLUMN IF EXISTS purchase_price,
  DROP COLUMN IF EXISTS sale_price,
  DROP COLUMN IF EXISTS agent_fee_rate;
ALTER TABLE IF EXISTS public.refueling_abroad
  DROP COLUMN IF EXISTS quantity_kg,
  DROP COLUMN IF EXISTS purchase_price_usd,
  DROP COLUMN IF EXISTS purchase_price_rub,
  DROP COLUMN IF EXISTS sale_price_usd,
  DROP COLUMN IF EXISTS sale_price_rub;
ALTER TABLE IF EXISTS public.opt
  DROP COLUMN IF EXISTS quantity_kg,
  DROP COLUMN IF EXISTS purchase_price,
  DROP COLUMN IF EXISTS sale_price,
  DROP COLUMN IF EXISTS delivery_tariff;

ALTER TABLE IF EXISTS public.plan_entries
  DROP COLUMN IF EXISTS volume,
  DROP COLUMN IF EXISTS balance_after;
ALTER TABLE IF EXISTS public.free_volume_allocations
  DROP COLUMN IF EXISTS volume;
ALTER TABLE IF EXISTS public.supplier_allocated_volumes
  DROP COLUMN IF EXISTS volume;
ALTER TABLE IF EXISTS public.planning_top_level_volumes
  DROP COLUMN IF EXISTS volume;

ALTER TABLE IF EXISTS public.budget_income_expense
  DROP COLUMN IF EXISTS sales_volume;
ALTER TABLE IF EXISTS public.delivery_cost
  DROP COLUMN IF EXISTS cost_per_kg;
ALTER TABLE IF EXISTS public.supplier_basis_prices
  DROP COLUMN IF EXISTS service_price,
  DROP COLUMN IF EXISTS pvkj_price,
  DROP COLUMN IF EXISTS agent_fee;
ALTER TABLE IF EXISTS public.government_contracts
  DROP COLUMN IF EXISTS planned_volume,
  DROP COLUMN IF EXISTS actual_volume;
ALTER TABLE IF EXISTS public.prices
  DROP COLUMN IF EXISTS needs_recalculation,
  DROP COLUMN IF EXISTS old_price_values;

COMMIT;
