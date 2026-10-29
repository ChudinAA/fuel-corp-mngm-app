BEGIN;

-- Keep the tonne columns nullable during the expand/backfill release.
-- Apply NOT NULL only in a later schema release after production verification.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.refueling_abroad') IS NULL THEN
    RAISE EXCEPTION 'Required table public.refueling_abroad is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'refueling_abroad'
      AND column_name = 'quantity_kg'
  ) THEN
    RAISE EXCEPTION 'Required column refueling_abroad.quantity_kg is missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.refueling_abroad WHERE quantity_kg IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot backfill foreign-refueling tonnes from null kg values';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.refueling_abroad
    WHERE input_mode = 'liters'
      AND (
        (purchase_price_usd IS NOT NULL AND purchase_amount_usd IS NULL)
        OR (purchase_price_rub IS NOT NULL AND purchase_amount_rub IS NULL)
        OR (sale_price_usd IS NOT NULL AND sale_amount_usd IS NULL)
        OR (sale_price_rub IS NOT NULL AND sale_amount_rub IS NULL)
      )
      AND (density IS NULL OR density <= 0)
  ) THEN
    RAISE EXCEPTION 'Cannot convert a per-litre foreign-refueling rate without positive deal density';
  END IF;
END $$;

ALTER TABLE public.refueling_abroad
  ADD COLUMN IF NOT EXISTS quantity_tonnes numeric(18,5),
  ADD COLUMN IF NOT EXISTS purchase_price_usd_per_tonne numeric(22,6),
  ADD COLUMN IF NOT EXISTS purchase_price_rub_per_tonne numeric(22,6),
  ADD COLUMN IF NOT EXISTS sale_price_usd_per_tonne numeric(22,6),
  ADD COLUMN IF NOT EXISTS sale_price_rub_per_tonne numeric(22,6);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.refueling_abroad
    WHERE quantity_tonnes IS NOT NULL
      AND quantity_tonnes IS DISTINCT FROM quantity_kg / 1000
  ) THEN
    RAISE EXCEPTION 'Existing foreign-refueling tonnes disagree with saved kg values';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.refueling_abroad
    WHERE
      (purchase_price_usd_per_tonne IS NOT NULL
        AND purchase_price_usd_per_tonne IS DISTINCT FROM
          CASE
            WHEN purchase_amount_usd IS NOT NULL AND quantity_kg > 0
              THEN ROUND(purchase_amount_usd / (quantity_kg / 1000), 6)
            WHEN purchase_price_usd IS NOT NULL AND input_mode = 'liters'
              THEN ROUND(purchase_price_usd * 1000 / NULLIF(density, 0), 6)
            WHEN purchase_price_usd IS NOT NULL
              THEN ROUND(purchase_price_usd * 1000, 6)
          END)
      OR (purchase_price_rub_per_tonne IS NOT NULL
        AND purchase_price_rub_per_tonne IS DISTINCT FROM
          CASE
            WHEN purchase_amount_rub IS NOT NULL AND quantity_kg > 0
              THEN ROUND(purchase_amount_rub / (quantity_kg / 1000), 6)
            WHEN purchase_price_rub IS NOT NULL AND input_mode = 'liters'
              THEN ROUND(purchase_price_rub * 1000 / NULLIF(density, 0), 6)
            WHEN purchase_price_rub IS NOT NULL
              THEN ROUND(purchase_price_rub * 1000, 6)
          END)
      OR (sale_price_usd_per_tonne IS NOT NULL
        AND sale_price_usd_per_tonne IS DISTINCT FROM
          CASE
            WHEN sale_amount_usd IS NOT NULL AND quantity_kg > 0
              THEN ROUND(sale_amount_usd / (quantity_kg / 1000), 6)
            WHEN sale_price_usd IS NOT NULL AND input_mode = 'liters'
              THEN ROUND(sale_price_usd * 1000 / NULLIF(density, 0), 6)
            WHEN sale_price_usd IS NOT NULL
              THEN ROUND(sale_price_usd * 1000, 6)
          END)
      OR (sale_price_rub_per_tonne IS NOT NULL
        AND sale_price_rub_per_tonne IS DISTINCT FROM
          CASE
            WHEN sale_amount_rub IS NOT NULL AND quantity_kg > 0
              THEN ROUND(sale_amount_rub / (quantity_kg / 1000), 6)
            WHEN sale_price_rub IS NOT NULL AND input_mode = 'liters'
              THEN ROUND(sale_price_rub * 1000 / NULLIF(density, 0), 6)
            WHEN sale_price_rub IS NOT NULL
              THEN ROUND(sale_price_rub * 1000, 6)
          END)
  ) THEN
    RAISE EXCEPTION 'Existing foreign-refueling per-tonne rates do not match their saved source values';
  END IF;
END $$;

WITH source AS (
  SELECT
    id,
    quantity_kg,
    input_mode,
    density,
    purchase_price_usd,
    purchase_price_rub,
    sale_price_usd,
    sale_price_rub,
    purchase_amount_usd,
    purchase_amount_rub,
    sale_amount_usd,
    sale_amount_rub
  FROM public.refueling_abroad
)
UPDATE public.refueling_abroad AS deal
SET
  quantity_tonnes = COALESCE(deal.quantity_tonnes, source.quantity_kg / 1000),
  purchase_price_usd_per_tonne = COALESCE(
    deal.purchase_price_usd_per_tonne,
    CASE
      WHEN source.purchase_amount_usd IS NOT NULL AND source.quantity_kg > 0
        THEN ROUND(source.purchase_amount_usd / (source.quantity_kg / 1000), 6)
      WHEN source.purchase_price_usd IS NOT NULL AND source.input_mode = 'liters'
        THEN ROUND(source.purchase_price_usd * 1000 / NULLIF(source.density, 0), 6)
      WHEN source.purchase_price_usd IS NOT NULL
        THEN ROUND(source.purchase_price_usd * 1000, 6)
    END
  ),
  purchase_price_rub_per_tonne = COALESCE(
    deal.purchase_price_rub_per_tonne,
    CASE
      WHEN source.purchase_amount_rub IS NOT NULL AND source.quantity_kg > 0
        THEN ROUND(source.purchase_amount_rub / (source.quantity_kg / 1000), 6)
      WHEN source.purchase_price_rub IS NOT NULL AND source.input_mode = 'liters'
        THEN ROUND(source.purchase_price_rub * 1000 / NULLIF(source.density, 0), 6)
      WHEN source.purchase_price_rub IS NOT NULL
        THEN ROUND(source.purchase_price_rub * 1000, 6)
    END
  ),
  sale_price_usd_per_tonne = COALESCE(
    deal.sale_price_usd_per_tonne,
    CASE
      WHEN source.sale_amount_usd IS NOT NULL AND source.quantity_kg > 0
        THEN ROUND(source.sale_amount_usd / (source.quantity_kg / 1000), 6)
      WHEN source.sale_price_usd IS NOT NULL AND source.input_mode = 'liters'
        THEN ROUND(source.sale_price_usd * 1000 / NULLIF(source.density, 0), 6)
      WHEN source.sale_price_usd IS NOT NULL
        THEN ROUND(source.sale_price_usd * 1000, 6)
    END
  ),
  sale_price_rub_per_tonne = COALESCE(
    deal.sale_price_rub_per_tonne,
    CASE
      WHEN source.sale_amount_rub IS NOT NULL AND source.quantity_kg > 0
        THEN ROUND(source.sale_amount_rub / (source.quantity_kg / 1000), 6)
      WHEN source.sale_price_rub IS NOT NULL AND source.input_mode = 'liters'
        THEN ROUND(source.sale_price_rub * 1000 / NULLIF(source.density, 0), 6)
      WHEN source.sale_price_rub IS NOT NULL
        THEN ROUND(source.sale_price_rub * 1000, 6)
    END
  )
FROM source
WHERE deal.id = source.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.refueling_abroad
    WHERE quantity_tonnes IS DISTINCT FROM quantity_kg / 1000
  ) THEN
    RAISE EXCEPTION 'Foreign-refueling mass backfill verification failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.refueling_abroad
    WHERE
      (purchase_price_usd_per_tonne IS NOT NULL
        AND purchase_price_usd_per_tonne IS DISTINCT FROM
          CASE
            WHEN purchase_amount_usd IS NOT NULL AND quantity_kg > 0
              THEN ROUND(purchase_amount_usd / (quantity_kg / 1000), 6)
            WHEN purchase_price_usd IS NOT NULL AND input_mode = 'liters'
              THEN ROUND(purchase_price_usd * 1000 / NULLIF(density, 0), 6)
            WHEN purchase_price_usd IS NOT NULL
              THEN ROUND(purchase_price_usd * 1000, 6)
          END)
      OR (purchase_price_rub_per_tonne IS NOT NULL
        AND purchase_price_rub_per_tonne IS DISTINCT FROM
          CASE
            WHEN purchase_amount_rub IS NOT NULL AND quantity_kg > 0
              THEN ROUND(purchase_amount_rub / (quantity_kg / 1000), 6)
            WHEN purchase_price_rub IS NOT NULL AND input_mode = 'liters'
              THEN ROUND(purchase_price_rub * 1000 / NULLIF(density, 0), 6)
            WHEN purchase_price_rub IS NOT NULL
              THEN ROUND(purchase_price_rub * 1000, 6)
          END)
      OR (sale_price_usd_per_tonne IS NOT NULL
        AND sale_price_usd_per_tonne IS DISTINCT FROM
          CASE
            WHEN sale_amount_usd IS NOT NULL AND quantity_kg > 0
              THEN ROUND(sale_amount_usd / (quantity_kg / 1000), 6)
            WHEN sale_price_usd IS NOT NULL AND input_mode = 'liters'
              THEN ROUND(sale_price_usd * 1000 / NULLIF(density, 0), 6)
            WHEN sale_price_usd IS NOT NULL
              THEN ROUND(sale_price_usd * 1000, 6)
          END)
      OR (sale_price_rub_per_tonne IS NOT NULL
        AND sale_price_rub_per_tonne IS DISTINCT FROM
          CASE
            WHEN sale_amount_rub IS NOT NULL AND quantity_kg > 0
              THEN ROUND(sale_amount_rub / (quantity_kg / 1000), 6)
            WHEN sale_price_rub IS NOT NULL AND input_mode = 'liters'
              THEN ROUND(sale_price_rub * 1000 / NULLIF(density, 0), 6)
            WHEN sale_price_rub IS NOT NULL
              THEN ROUND(sale_price_rub * 1000, 6)
          END)
  ) THEN
    RAISE EXCEPTION 'Foreign-refueling per-tonne rate backfill verification failed';
  END IF;
END $$;

COMMENT ON COLUMN public.refueling_abroad.quantity_tonnes IS
  'Authoritative foreign-refueling mass in tonnes; quantity_kg remains a compatibility mirror.';
COMMENT ON COLUMN public.refueling_abroad.purchase_price_usd_per_tonne IS
  'Purchase rate in USD/tonne; saved totals retain the current effective rate, otherwise per-litre values use deal density.';
COMMENT ON COLUMN public.refueling_abroad.purchase_price_rub_per_tonne IS
  'Purchase rate in RUB/tonne; saved totals retain the current effective rate, otherwise per-litre values use deal density.';
COMMENT ON COLUMN public.refueling_abroad.sale_price_usd_per_tonne IS
  'Sale rate in USD/tonne; saved totals retain the current effective rate, otherwise per-litre values use deal density.';
COMMENT ON COLUMN public.refueling_abroad.sale_price_rub_per_tonne IS
  'Sale rate in RUB/tonne; saved totals retain the current effective rate, otherwise per-litre values use deal density.';

COMMIT;
