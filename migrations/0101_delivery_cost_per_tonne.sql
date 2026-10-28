BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.delivery_cost') IS NULL THEN
    RAISE EXCEPTION 'Required table public.delivery_cost is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'delivery_cost'
      AND column_name = 'cost_per_kg'
  ) THEN
    RAISE EXCEPTION 'Required column delivery_cost.cost_per_kg is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.delivery_cost
    WHERE cost_per_kg IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot backfill per-tonne delivery rates from NULL legacy rates';
  END IF;
END $$;

ALTER TABLE public.delivery_cost
  ADD COLUMN IF NOT EXISTS cost_per_tonne numeric(22,6);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.delivery_cost
    WHERE cost_per_tonne IS NOT NULL
      AND cost_per_tonne IS DISTINCT FROM ROUND(cost_per_kg * 1000, 6)
  ) THEN
    RAISE EXCEPTION 'Existing delivery per-tonne rates disagree with per-kilogram rates';
  END IF;
END $$;

UPDATE public.delivery_cost
SET cost_per_tonne = ROUND(cost_per_kg * 1000, 6)
WHERE cost_per_tonne IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.delivery_cost
    WHERE cost_per_tonne IS NULL
       OR cost_per_tonne IS DISTINCT FROM ROUND(cost_per_kg * 1000, 6)
  ) THEN
    RAISE EXCEPTION 'Delivery per-tonne rate backfill verification failed';
  END IF;
END $$;

COMMENT ON COLUMN public.delivery_cost.cost_per_tonne IS
  'Authoritative delivery tariff in currency per metric tonne; cost_per_kg remains a compatibility mirror.';

COMMIT;
