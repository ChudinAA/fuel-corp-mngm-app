BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.equipments') IS NULL
     OR to_regclass('public.equipment_transactions') IS NULL THEN
    RAISE EXCEPTION 'Required equipment tables are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'equipments'
      AND column_name = 'average_cost'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'equipments'
      AND column_name = 'pvkj_average_cost'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'equipment_transactions'
      AND column_name = 'price'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'equipment_transactions'
      AND column_name = 'average_cost_before'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'equipment_transactions'
      AND column_name = 'average_cost_after'
  ) THEN
    RAISE EXCEPTION
      'Legacy equipment cost columns are required for migration 0105';
  END IF;
END $$;

ALTER TABLE public.equipments
  ADD COLUMN IF NOT EXISTS average_cost_per_tonne numeric(22,6),
  ADD COLUMN IF NOT EXISTS pvkj_average_cost_per_tonne numeric(22,6);

ALTER TABLE public.equipment_transactions
  ADD COLUMN IF NOT EXISTS price_per_tonne numeric(22,6),
  ADD COLUMN IF NOT EXISTS average_cost_before_per_tonne numeric(22,6),
  ADD COLUMN IF NOT EXISTS average_cost_after_per_tonne numeric(22,6),
  ALTER COLUMN quantity DROP NOT NULL;

UPDATE public.equipments
SET average_cost_per_tonne = ROUND(COALESCE(average_cost, 0) * 1000, 6)
WHERE average_cost_per_tonne IS NULL;

UPDATE public.equipments
SET pvkj_average_cost_per_tonne =
      ROUND(COALESCE(pvkj_average_cost, 0) * 1000, 6)
WHERE pvkj_average_cost_per_tonne IS NULL;

UPDATE public.equipment_transactions
SET price_per_tonne = ROUND(price * 1000, 6)
WHERE price_per_tonne IS NULL
  AND price IS NOT NULL;

UPDATE public.equipment_transactions
SET average_cost_before_per_tonne =
      ROUND(average_cost_before * 1000, 6)
WHERE average_cost_before_per_tonne IS NULL
  AND average_cost_before IS NOT NULL;

UPDATE public.equipment_transactions
SET average_cost_after_per_tonne =
      ROUND(average_cost_after * 1000, 6)
WHERE average_cost_after_per_tonne IS NULL
  AND average_cost_after IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.equipments
    WHERE average_cost_per_tonne IS NULL
       OR pvkj_average_cost_per_tonne IS NULL
  ) THEN
    RAISE EXCEPTION 'Equipment per-tonne cost backfill left missing values';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.equipment_transactions
    WHERE (price IS NOT NULL AND price_per_tonne IS NULL)
       OR (average_cost_before IS NOT NULL
           AND average_cost_before_per_tonne IS NULL)
       OR (average_cost_after IS NOT NULL
           AND average_cost_after_per_tonne IS NULL)
  ) THEN
    RAISE EXCEPTION
      'Equipment transaction per-tonne cost backfill left missing values';
  END IF;
END $$;

COMMIT;
