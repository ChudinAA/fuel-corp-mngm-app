BEGIN;

-- Keep the tonne columns nullable during the expand/backfill release.
-- Apply NOT NULL only in a later schema release after production verification.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.aircraft_refueling') IS NULL THEN
    RAISE EXCEPTION 'Required table public.aircraft_refueling is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aircraft_refueling'
      AND column_name = 'quantity_kg'
  ) THEN
    RAISE EXCEPTION 'Required column aircraft_refueling.quantity_kg is missing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.aircraft_refueling WHERE quantity_kg IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot backfill tonnes from a null saved kg value';
  END IF;
END $$;

ALTER TABLE public.aircraft_refueling
  ADD COLUMN IF NOT EXISTS quantity_tonnes numeric(18,5),
  ADD COLUMN IF NOT EXISTS purchase_price_per_tonne numeric(22,6),
  ADD COLUMN IF NOT EXISTS sale_price_per_tonne numeric(22,6),
  ADD COLUMN IF NOT EXISTS agent_fee_rate_per_tonne numeric(22,6);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.aircraft_refueling
    WHERE quantity_tonnes IS NOT NULL
      AND quantity_tonnes IS DISTINCT FROM quantity_kg / 1000
  ) THEN
    RAISE EXCEPTION 'Existing refueling tonnes disagree with saved kg values';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.aircraft_refueling
    WHERE (purchase_price_per_tonne IS NOT NULL AND purchase_price IS NOT NULL
           AND purchase_price_per_tonne IS DISTINCT FROM purchase_price * 1000)
       OR (sale_price_per_tonne IS NOT NULL AND sale_price IS NOT NULL
           AND sale_price_per_tonne IS DISTINCT FROM sale_price * 1000)
       OR (agent_fee_rate_per_tonne IS NOT NULL AND agent_fee_rate IS NOT NULL
           AND agent_fee_rate_per_tonne IS DISTINCT FROM agent_fee_rate * 1000)
  ) THEN
    RAISE EXCEPTION 'Existing refueling rates disagree with saved per-kg rates';
  END IF;
END $$;

-- Historical refueling rows store these normalized unit rates per kg.
-- The app converts liter-based source prices with deal density before saving;
-- historical mass itself always comes from quantity_kg, not liters × density.
UPDATE public.aircraft_refueling
SET quantity_tonnes = quantity_kg / 1000
WHERE quantity_tonnes IS NULL;

UPDATE public.aircraft_refueling
SET purchase_price_per_tonne = purchase_price * 1000
WHERE purchase_price_per_tonne IS NULL
  AND purchase_price IS NOT NULL;

UPDATE public.aircraft_refueling
SET sale_price_per_tonne = sale_price * 1000
WHERE sale_price_per_tonne IS NULL
  AND sale_price IS NOT NULL;

UPDATE public.aircraft_refueling
SET agent_fee_rate_per_tonne = agent_fee_rate * 1000
WHERE agent_fee_rate_per_tonne IS NULL
  AND agent_fee_rate IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.aircraft_refueling
    WHERE quantity_tonnes IS DISTINCT FROM quantity_kg / 1000
  ) THEN
    RAISE EXCEPTION 'Refueling mass backfill verification failed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.aircraft_refueling
    WHERE (purchase_price_per_tonne IS NOT NULL AND purchase_price IS NOT NULL
           AND purchase_price_per_tonne IS DISTINCT FROM purchase_price * 1000)
       OR (sale_price_per_tonne IS NOT NULL AND sale_price IS NOT NULL
           AND sale_price_per_tonne IS DISTINCT FROM sale_price * 1000)
       OR (agent_fee_rate_per_tonne IS NOT NULL AND agent_fee_rate IS NOT NULL
           AND agent_fee_rate_per_tonne IS DISTINCT FROM agent_fee_rate * 1000)
  ) THEN
    RAISE EXCEPTION 'Refueling rate backfill verification failed';
  END IF;
END $$;

COMMIT;
