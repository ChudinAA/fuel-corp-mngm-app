BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

DO $$
BEGIN
  IF to_regclass('public.warehouses') IS NULL THEN
    RAISE EXCEPTION 'warehouses table is required for migration 0090';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warehouses'
      AND column_name = 'limit_volume'
  ) THEN
    RAISE EXCEPTION 'warehouses.limit_volume is required for migration 0090';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.warehouses
    WHERE limit_volume < 0
  ) THEN
    RAISE EXCEPTION 'Negative warehouse monthly limits require manual review';
  END IF;
END
$$;

ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS limit_volume_tonnes numeric(18,5);

UPDATE public.warehouses
SET limit_volume_tonnes = limit_volume / 1000
WHERE limit_volume_tonnes IS NULL
  AND limit_volume IS NOT NULL;

COMMIT;
