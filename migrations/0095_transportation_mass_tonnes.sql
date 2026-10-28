BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.transportation') IS NULL THEN
    RAISE EXCEPTION 'Required table public.transportation is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transportation'
      AND column_name = 'quantity_kg'
  ) THEN
    RAISE EXCEPTION 'Required column transportation.quantity_kg is missing';
  END IF;
END $$;

ALTER TABLE public.transportation
  ADD COLUMN IF NOT EXISTS quantity_tonnes numeric(18,5),
  ADD COLUMN IF NOT EXISTS purchase_price_per_tonne numeric(22,6),
  ADD COLUMN IF NOT EXISTS sale_price_per_tonne numeric(22,6),
  ADD COLUMN IF NOT EXISTS delivery_tariff_per_tonne numeric(22,6);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.transportation
    WHERE input_mode = 'liters'
      AND (purchase_price IS NOT NULL OR sale_price IS NOT NULL)
      AND (density IS NULL OR density <= 0)
  ) THEN
    RAISE EXCEPTION 'Transportation per-liter rates require a positive deal density';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.transportation
    WHERE quantity_tonnes IS NOT NULL
      AND quantity_tonnes IS DISTINCT FROM quantity_kg / 1000
  ) THEN
    RAISE EXCEPTION 'Existing transportation tonnes disagree with saved kg values';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.transportation
    WHERE (purchase_price_per_tonne IS NOT NULL AND purchase_price IS NOT NULL
           AND abs(
             purchase_price_per_tonne -
             CASE WHEN input_mode = 'liters'
               THEN purchase_price * 1000 / NULLIF(density, 0)
               ELSE purchase_price * 1000
             END
           ) > CASE WHEN input_mode = 'liters'
               THEN 0.0005001 / NULLIF(density, 0)
               ELSE 0.0005001
             END)
       OR (sale_price_per_tonne IS NOT NULL AND sale_price IS NOT NULL
           AND abs(
             sale_price_per_tonne -
             CASE WHEN input_mode = 'liters'
               THEN sale_price * 1000 / NULLIF(density, 0)
               ELSE sale_price * 1000
             END
           ) > CASE WHEN input_mode = 'liters'
               THEN 0.0005001 / NULLIF(density, 0)
               ELSE 0.0005001
             END)
       OR (delivery_tariff_per_tonne IS NOT NULL AND delivery_tariff IS NOT NULL
           AND abs(delivery_tariff_per_tonne - delivery_tariff * 1000) > 0.0005001)
  ) THEN
    RAISE EXCEPTION 'Existing transportation rates disagree beyond legacy mirror precision';
  END IF;
END $$;

UPDATE public.transportation
SET quantity_tonnes = quantity_kg / 1000
WHERE quantity_tonnes IS NULL AND quantity_kg IS NOT NULL;

UPDATE public.transportation
SET purchase_price_per_tonne =
  CASE WHEN input_mode = 'liters'
    THEN purchase_price * 1000 / NULLIF(density, 0)
    ELSE purchase_price * 1000
  END
WHERE purchase_price_per_tonne IS NULL AND purchase_price IS NOT NULL;

UPDATE public.transportation
SET sale_price_per_tonne =
  CASE WHEN input_mode = 'liters'
    THEN sale_price * 1000 / NULLIF(density, 0)
    ELSE sale_price * 1000
  END
WHERE sale_price_per_tonne IS NULL AND sale_price IS NOT NULL;

UPDATE public.transportation
SET delivery_tariff_per_tonne = delivery_tariff * 1000
WHERE delivery_tariff_per_tonne IS NULL AND delivery_tariff IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.transportation
    WHERE quantity_tonnes IS DISTINCT FROM quantity_kg / 1000
  ) THEN
    RAISE EXCEPTION 'Transportation mass backfill verification failed';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.transportation
    WHERE (purchase_price_per_tonne IS NOT NULL AND purchase_price IS NOT NULL
           AND abs(
             purchase_price_per_tonne -
             CASE WHEN input_mode = 'liters'
               THEN purchase_price * 1000 / NULLIF(density, 0)
               ELSE purchase_price * 1000
             END
           ) > CASE WHEN input_mode = 'liters'
               THEN 0.0005001 / NULLIF(density, 0)
               ELSE 0.0005001
             END)
       OR (sale_price_per_tonne IS NOT NULL AND sale_price IS NOT NULL
           AND abs(
             sale_price_per_tonne -
             CASE WHEN input_mode = 'liters'
               THEN sale_price * 1000 / NULLIF(density, 0)
               ELSE sale_price * 1000
             END
           ) > CASE WHEN input_mode = 'liters'
               THEN 0.0005001 / NULLIF(density, 0)
               ELSE 0.0005001
             END)
       OR (delivery_tariff_per_tonne IS NOT NULL AND delivery_tariff IS NOT NULL
           AND abs(delivery_tariff_per_tonne - delivery_tariff * 1000) > 0.0005001)
  ) THEN
    RAISE EXCEPTION 'Transportation rate backfill verification failed';
  END IF;
END $$;

COMMIT;
