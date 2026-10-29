BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '2min';

DO $$
BEGIN
  IF to_regclass('public.government_contracts') IS NULL THEN
    RAISE EXCEPTION 'Required table public.government_contracts is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'government_contracts'
      AND column_name = 'planned_volume'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'government_contracts'
      AND column_name = 'actual_volume'
  ) THEN
    RAISE EXCEPTION 'Required legacy government-contract volume fields are missing';
  END IF;
END $$;

ALTER TABLE public.government_contracts
  ADD COLUMN IF NOT EXISTS planned_volume_tonnes numeric(18,5),
  ADD COLUMN IF NOT EXISTS actual_volume_tonnes numeric(18,5);

UPDATE public.government_contracts
SET planned_volume_tonnes =
      ROUND(NULLIF(BTRIM(planned_volume), '')::numeric / 1000, 5)
WHERE planned_volume_tonnes IS NULL
  AND NULLIF(BTRIM(planned_volume), '') IS NOT NULL;

UPDATE public.government_contracts
SET actual_volume_tonnes =
      ROUND(NULLIF(BTRIM(actual_volume), '')::numeric / 1000, 5)
WHERE actual_volume_tonnes IS NULL
  AND NULLIF(BTRIM(actual_volume), '') IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.government_contracts
    WHERE (NULLIF(BTRIM(planned_volume), '') IS NOT NULL
           AND planned_volume_tonnes IS NULL)
       OR (NULLIF(BTRIM(actual_volume), '') IS NOT NULL
           AND actual_volume_tonnes IS NULL)
  ) THEN
    RAISE EXCEPTION 'Government-contract tonne-volume backfill verification failed';
  END IF;
END $$;

COMMENT ON COLUMN public.government_contracts.planned_volume_tonnes IS
  'Authoritative planned contract volume in metric tonnes.';
COMMENT ON COLUMN public.government_contracts.actual_volume_tonnes IS
  'Authoritative actual contract volume in metric tonnes.';

COMMIT;
