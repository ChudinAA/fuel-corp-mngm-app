BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.warehouses') IS NULL
     OR to_regclass('public.warehouse_transactions') IS NULL THEN
    RAISE EXCEPTION 'Required warehouse tables are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warehouses'
      AND column_name = 'average_cost_per_tonne'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warehouses'
      AND column_name = 'pvkj_average_cost_per_tonne'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warehouse_transactions'
      AND column_name = 'price_per_tonne'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warehouse_transactions'
      AND column_name = 'average_cost_before_per_tonne'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warehouse_transactions'
      AND column_name = 'average_cost_after_per_tonne'
  ) THEN
    RAISE EXCEPTION
      'Per-tonne warehouse cost columns are missing; publish the expanded schema first';
  END IF;
END $$;

UPDATE public.warehouses
SET average_cost_per_tonne =
      ROUND(COALESCE(average_cost, 0) * 1000, 6)
WHERE average_cost_per_tonne IS NULL;

UPDATE public.warehouses
SET pvkj_average_cost_per_tonne =
      ROUND(COALESCE(pvkj_average_cost, 0) * 1000, 6)
WHERE pvkj_average_cost_per_tonne IS NULL;

UPDATE public.warehouse_transactions
SET price_per_tonne = ROUND(price * 1000, 6)
WHERE price_per_tonne IS NULL
  AND price IS NOT NULL;

UPDATE public.warehouse_transactions
SET average_cost_before_per_tonne =
      ROUND(average_cost_before * 1000, 6)
WHERE average_cost_before_per_tonne IS NULL
  AND average_cost_before IS NOT NULL;

UPDATE public.warehouse_transactions
SET average_cost_after_per_tonne =
      ROUND(average_cost_after * 1000, 6)
WHERE average_cost_after_per_tonne IS NULL
  AND average_cost_after IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.warehouses
    WHERE average_cost_per_tonne IS NULL
       OR pvkj_average_cost_per_tonne IS NULL
  ) THEN
    RAISE EXCEPTION 'Warehouse per-tonne cost backfill left missing values';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.warehouse_transactions
    WHERE (price IS NOT NULL AND price_per_tonne IS NULL)
       OR (average_cost_before IS NOT NULL
           AND average_cost_before_per_tonne IS NULL)
       OR (average_cost_after IS NOT NULL
           AND average_cost_after_per_tonne IS NULL)
  ) THEN
    RAISE EXCEPTION
      'Warehouse transaction per-tonne cost backfill left missing values';
  END IF;
END $$;

COMMIT;
