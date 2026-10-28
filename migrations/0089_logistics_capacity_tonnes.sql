BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '2min';

DO $$
BEGIN
  IF to_regclass('public.logistics_vehicles') IS NULL
     OR to_regclass('public.logistics_trailers') IS NULL THEN
    RAISE EXCEPTION 'logistics vehicle or trailer table is missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM logistics_vehicles WHERE capacity_kg < 0
    UNION ALL
    SELECT 1 FROM logistics_trailers WHERE capacity_kg < 0
  ) THEN
    RAISE EXCEPTION 'negative logistics capacity cannot be backfilled';
  END IF;
END
$$;

ALTER TABLE logistics_vehicles
  ADD COLUMN IF NOT EXISTS capacity_tonnes numeric(15,5);
ALTER TABLE logistics_trailers
  ADD COLUMN IF NOT EXISTS capacity_tonnes numeric(15,5);

UPDATE logistics_vehicles
SET capacity_tonnes = capacity_kg / 1000
WHERE capacity_tonnes IS NULL
  AND capacity_kg IS NOT NULL;

UPDATE logistics_trailers
SET capacity_tonnes = capacity_kg / 1000
WHERE capacity_tonnes IS NULL
  AND capacity_kg IS NOT NULL;

COMMIT;
