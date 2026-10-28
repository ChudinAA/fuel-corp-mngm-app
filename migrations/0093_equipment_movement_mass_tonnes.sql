BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.equipment_movement') IS NULL THEN
    RAISE EXCEPTION 'Required table public.equipment_movement is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'equipment_movement'
      AND column_name = 'quantity_kg'
  ) THEN
    RAISE EXCEPTION 'Required column equipment_movement.quantity_kg is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'equipment_movement'
      AND column_name = 'cost_per_kg'
  ) THEN
    RAISE EXCEPTION 'Required column equipment_movement.cost_per_kg is missing';
  END IF;
END $$;

ALTER TABLE public.equipment_movement
  ADD COLUMN IF NOT EXISTS quantity_tonnes numeric(18,5),
  ADD COLUMN IF NOT EXISTS cost_per_tonne numeric(22,6);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.equipment_movement
    WHERE quantity_tonnes IS NOT NULL
      AND quantity_tonnes IS DISTINCT FROM quantity_kg / 1000
  ) THEN
    RAISE EXCEPTION 'Existing equipment movement tonnes disagree with legacy kg values';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.equipment_movement
    WHERE cost_per_tonne IS NOT NULL
      AND cost_per_kg IS NOT NULL
      AND abs(cost_per_tonne - cost_per_kg * 1000) > 0.0005001
  ) THEN
    RAISE EXCEPTION 'Existing equipment movement rates disagree beyond mirror precision';
  END IF;
END $$;

UPDATE public.equipment_movement
SET quantity_tonnes = quantity_kg / 1000
WHERE quantity_tonnes IS NULL AND quantity_kg IS NOT NULL;

UPDATE public.equipment_movement
SET cost_per_tonne = cost_per_kg * 1000
WHERE cost_per_tonne IS NULL AND cost_per_kg IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.equipment_movement
    WHERE quantity_tonnes IS DISTINCT FROM quantity_kg / 1000
  ) THEN
    RAISE EXCEPTION 'Equipment movement mass backfill verification failed';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.equipment_movement
    WHERE cost_per_tonne IS NOT NULL
      AND cost_per_kg IS NOT NULL
      AND abs(cost_per_tonne - cost_per_kg * 1000) > 0.0005001
  ) THEN
    RAISE EXCEPTION 'Equipment movement rate backfill verification failed';
  END IF;
END $$;

COMMIT;
