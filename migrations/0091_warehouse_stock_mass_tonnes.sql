BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

DO $$
BEGIN
  IF to_regclass('public.warehouses') IS NULL THEN
    RAISE EXCEPTION 'warehouses table is required for migration 0091';
  END IF;
  IF to_regclass('public.warehouse_transactions') IS NULL THEN
    RAISE EXCEPTION 'warehouse_transactions table is required for migration 0091';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warehouses'
      AND column_name = 'current_balance'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warehouses'
      AND column_name = 'pvkj_balance'
  ) THEN
    RAISE EXCEPTION 'Legacy warehouse balance columns are required for migration 0091';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warehouse_transactions'
      AND column_name = 'quantity'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warehouse_transactions'
      AND column_name = 'balance_before'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warehouse_transactions'
      AND column_name = 'balance_after'
  ) THEN
    RAISE EXCEPTION 'Legacy warehouse transaction mass columns are required for migration 0091';
  END IF;
END
$$;

ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS current_balance_tonnes numeric(18,5),
  ADD COLUMN IF NOT EXISTS pvkj_balance_tonnes numeric(18,5);

ALTER TABLE public.warehouse_transactions
  ADD COLUMN IF NOT EXISTS quantity_tonnes numeric(18,5),
  ADD COLUMN IF NOT EXISTS balance_before_tonnes numeric(18,5),
  ADD COLUMN IF NOT EXISTS balance_after_tonnes numeric(18,5);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.warehouses
    WHERE current_balance_tonnes IS NOT NULL
      AND current_balance_tonnes IS DISTINCT FROM current_balance / 1000
  ) OR EXISTS (
    SELECT 1 FROM public.warehouses
    WHERE pvkj_balance_tonnes IS NOT NULL
      AND pvkj_balance_tonnes IS DISTINCT FROM pvkj_balance / 1000
  ) THEN
    RAISE EXCEPTION 'Existing warehouse tonne balances do not match legacy kg values';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.warehouse_transactions
    WHERE quantity_tonnes IS NOT NULL
      AND quantity_tonnes IS DISTINCT FROM quantity / 1000
  ) OR EXISTS (
    SELECT 1 FROM public.warehouse_transactions
    WHERE balance_before_tonnes IS NOT NULL
      AND balance_before_tonnes IS DISTINCT FROM balance_before / 1000
  ) OR EXISTS (
    SELECT 1 FROM public.warehouse_transactions
    WHERE balance_after_tonnes IS NOT NULL
      AND balance_after_tonnes IS DISTINCT FROM balance_after / 1000
  ) THEN
    RAISE EXCEPTION 'Existing warehouse transaction tonnes do not match legacy kg values';
  END IF;
END
$$;

UPDATE public.warehouses
SET current_balance_tonnes = current_balance / 1000
WHERE current_balance_tonnes IS NULL
  AND current_balance IS NOT NULL;

UPDATE public.warehouses
SET pvkj_balance_tonnes = pvkj_balance / 1000
WHERE pvkj_balance_tonnes IS NULL
  AND pvkj_balance IS NOT NULL;

UPDATE public.warehouse_transactions
SET quantity_tonnes = quantity / 1000
WHERE quantity_tonnes IS NULL
  AND quantity IS NOT NULL;

UPDATE public.warehouse_transactions
SET balance_before_tonnes = balance_before / 1000
WHERE balance_before_tonnes IS NULL
  AND balance_before IS NOT NULL;

UPDATE public.warehouse_transactions
SET balance_after_tonnes = balance_after / 1000
WHERE balance_after_tonnes IS NULL
  AND balance_after IS NOT NULL;

COMMIT;
