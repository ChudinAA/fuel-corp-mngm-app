BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opt'
      AND column_name = 'quantity_kg'
  ) THEN
    RAISE EXCEPTION 'Required column opt.quantity_kg is missing';
  END IF;

  IF EXISTS (SELECT 1 FROM public.opt WHERE quantity_kg IS NULL) THEN
    RAISE EXCEPTION 'Cannot backfill OPT tonnes: quantity_kg contains NULL';
  END IF;
END $$;

ALTER TABLE public.opt
  ADD COLUMN IF NOT EXISTS quantity_tonnes numeric(18,5),
  ADD COLUMN IF NOT EXISTS purchase_price_per_tonne numeric(22,6),
  ADD COLUMN IF NOT EXISTS sale_price_per_tonne numeric(22,6),
  ADD COLUMN IF NOT EXISTS delivery_tariff_per_tonne numeric(22,6);

-- Historical OPT deal rates are normalized to currency/kg at the API boundary.
-- Convert those rates only; preserve every stored transaction amount.
UPDATE public.opt
SET quantity_tonnes = quantity_kg / 1000
WHERE quantity_tonnes IS NULL;

UPDATE public.opt
SET purchase_price_per_tonne = purchase_price * 1000
WHERE purchase_price_per_tonne IS NULL
  AND purchase_price IS NOT NULL;

UPDATE public.opt
SET sale_price_per_tonne = sale_price * 1000
WHERE sale_price_per_tonne IS NULL
  AND sale_price IS NOT NULL;

UPDATE public.opt
SET delivery_tariff_per_tonne = delivery_tariff * 1000
WHERE delivery_tariff_per_tonne IS NULL
  AND delivery_tariff IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.opt
    WHERE quantity_tonnes IS DISTINCT FROM quantity_kg / 1000
  ) THEN
    RAISE EXCEPTION 'OPT tonne mass backfill does not match saved kilograms';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.opt
    WHERE (purchase_price_per_tonne IS NOT NULL AND purchase_price IS NOT NULL
           AND purchase_price_per_tonne IS DISTINCT FROM purchase_price * 1000)
       OR (sale_price_per_tonne IS NOT NULL AND sale_price IS NOT NULL
           AND sale_price_per_tonne IS DISTINCT FROM sale_price * 1000)
       OR (delivery_tariff_per_tonne IS NOT NULL AND delivery_tariff IS NOT NULL
           AND delivery_tariff_per_tonne IS DISTINCT FROM delivery_tariff * 1000)
  ) THEN
    RAISE EXCEPTION 'OPT per-tonne rate backfill does not match saved per-kilogram rates';
  END IF;
END $$;

ALTER TABLE public.opt
  ALTER COLUMN quantity_tonnes SET NOT NULL;

COMMENT ON COLUMN public.opt.quantity_tonnes IS
  'Authoritative deal mass in metric tonnes; quantity_kg is a compatibility mirror.';
COMMENT ON COLUMN public.opt.purchase_price_per_tonne IS
  'Purchase rate in currency/tonne; purchase_price remains a compatibility mirror in currency/kg.';
COMMENT ON COLUMN public.opt.sale_price_per_tonne IS
  'Sale rate in currency/tonne; sale_price remains a compatibility mirror in currency/kg.';
COMMENT ON COLUMN public.opt.delivery_tariff_per_tonne IS
  'Delivery tariff in currency/tonne; delivery_tariff remains a compatibility mirror in currency/kg.';

COMMIT;
