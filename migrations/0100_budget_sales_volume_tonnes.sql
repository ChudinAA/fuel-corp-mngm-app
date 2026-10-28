BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.budget_income_expense') IS NULL THEN
    RAISE EXCEPTION 'Required table public.budget_income_expense is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'budget_income_expense'
      AND column_name = 'sales_volume'
  ) THEN
    RAISE EXCEPTION 'Required legacy column public.budget_income_expense.sales_volume is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.budget_income_expense
    WHERE sales_volume IS NOT NULL
      AND BTRIM(sales_volume) <> ''
      AND BTRIM(sales_volume) !~ '^-?[0-9]+([.][0-9]+)?$'
  ) THEN
    RAISE EXCEPTION 'Cannot backfill BDR tonnes: sales_volume contains non-numeric values';
  END IF;
END $$;

ALTER TABLE public.budget_income_expense
  ADD COLUMN IF NOT EXISTS sales_volume_tonnes numeric(18,5);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.budget_income_expense
    WHERE sales_volume_tonnes IS NOT NULL
      AND sales_volume IS NOT NULL
      AND BTRIM(sales_volume) <> ''
      AND sales_volume_tonnes IS DISTINCT FROM ROUND(sales_volume::numeric / 1000, 5)
  ) THEN
    RAISE EXCEPTION 'Existing BDR tonnes disagree with the kg compatibility field';
  END IF;
END $$;

UPDATE public.budget_income_expense
SET sales_volume_tonnes = ROUND(sales_volume::numeric / 1000, 5)
WHERE sales_volume_tonnes IS NULL
  AND sales_volume IS NOT NULL
  AND BTRIM(sales_volume) <> '';

COMMENT ON COLUMN public.budget_income_expense.sales_volume_tonnes IS
  'Authoritative BDR sales volume in metric tonnes; sales_volume remains a synchronized kg compatibility mirror.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'budget_income_expense'
      AND column_name = 'sales_volume_tonnes'
      AND (
        data_type <> 'numeric'
        OR numeric_precision <> 18
        OR numeric_scale <> 5
        OR is_nullable <> 'YES'
      )
  ) THEN
    RAISE EXCEPTION 'BDR sales volume tonne column schema validation failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.budget_income_expense
    WHERE sales_volume IS NOT NULL
      AND BTRIM(sales_volume) <> ''
      AND sales_volume_tonnes IS DISTINCT FROM ROUND(sales_volume::numeric / 1000, 5)
  ) THEN
    RAISE EXCEPTION 'BDR sales volume kg-to-tonne backfill verification failed';
  END IF;
END $$;

COMMIT;
