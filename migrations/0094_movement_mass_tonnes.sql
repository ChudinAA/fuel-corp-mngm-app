BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.movement') IS NULL THEN
    RAISE EXCEPTION 'Required table public.movement is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'movement'
      AND column_name = 'quantity_kg'
  ) THEN
    RAISE EXCEPTION 'Required column movement.quantity_kg is missing';
  END IF;
END $$;

ALTER TABLE public.movement
  ADD COLUMN IF NOT EXISTS quantity_tonnes numeric(18,5),
  ADD COLUMN IF NOT EXISTS purchase_price_per_tonne numeric(22,6),
  ADD COLUMN IF NOT EXISTS delivery_price_per_tonne numeric(22,6),
  ADD COLUMN IF NOT EXISTS cost_per_tonne numeric(22,6);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.movement
    WHERE quantity_tonnes IS NOT NULL
      AND quantity_tonnes IS DISTINCT FROM quantity_kg / 1000
  ) THEN
    RAISE EXCEPTION 'Existing movement tonnes disagree with legacy kg values';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.movement
    WHERE (purchase_price_per_tonne IS NOT NULL AND purchase_price IS NOT NULL
           AND abs(purchase_price_per_tonne - purchase_price * 1000) > 0.0005001)
       OR (delivery_price_per_tonne IS NOT NULL AND delivery_price IS NOT NULL
           AND abs(delivery_price_per_tonne - delivery_price * 1000) > 0.0005001)
       OR (cost_per_tonne IS NOT NULL AND cost_per_kg IS NOT NULL
           AND abs(cost_per_tonne - cost_per_kg * 1000) > 0.0005001)
  ) THEN
    RAISE EXCEPTION 'Existing movement rates disagree beyond legacy mirror precision';
  END IF;
END $$;

UPDATE public.movement
SET quantity_tonnes = quantity_kg / 1000
WHERE quantity_tonnes IS NULL AND quantity_kg IS NOT NULL;

UPDATE public.movement
SET purchase_price_per_tonne = purchase_price * 1000
WHERE purchase_price_per_tonne IS NULL AND purchase_price IS NOT NULL;

UPDATE public.movement
SET delivery_price_per_tonne = delivery_price * 1000
WHERE delivery_price_per_tonne IS NULL AND delivery_price IS NOT NULL;

UPDATE public.movement
SET cost_per_tonne = cost_per_kg * 1000
WHERE cost_per_tonne IS NULL AND cost_per_kg IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.movement
    WHERE quantity_tonnes IS DISTINCT FROM quantity_kg / 1000
  ) THEN
    RAISE EXCEPTION 'Movement mass backfill verification failed';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.movement
    WHERE (purchase_price_per_tonne IS NOT NULL AND purchase_price IS NOT NULL
           AND abs(purchase_price_per_tonne - purchase_price * 1000) > 0.0005001)
       OR (delivery_price_per_tonne IS NOT NULL AND delivery_price IS NOT NULL
           AND abs(delivery_price_per_tonne - delivery_price * 1000) > 0.0005001)
       OR (cost_per_tonne IS NOT NULL AND cost_per_kg IS NOT NULL
           AND abs(cost_per_tonne - cost_per_kg * 1000) > 0.0005001)
  ) THEN
    RAISE EXCEPTION 'Movement rate backfill verification failed';
  END IF;
END $$;

COMMIT;
