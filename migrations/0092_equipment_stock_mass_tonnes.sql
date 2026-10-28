BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

DO $$
BEGIN
  IF to_regclass('public.equipments') IS NULL THEN
    RAISE EXCEPTION 'equipments table is required for migration 0092';
  END IF;
  IF to_regclass('public.equipment_transactions') IS NULL THEN
    RAISE EXCEPTION 'equipment_transactions table is required for migration 0092';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'equipments'
      AND column_name = 'current_balance'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'equipments'
      AND column_name = 'pvkj_balance'
  ) THEN
    RAISE EXCEPTION 'Legacy equipment balance columns are required for migration 0092';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'equipment_transactions'
      AND column_name = 'quantity'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'equipment_transactions'
      AND column_name = 'balance_before'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'equipment_transactions'
      AND column_name = 'balance_after'
  ) THEN
    RAISE EXCEPTION 'Legacy equipment transaction mass columns are required for migration 0092';
  END IF;
END
$$;

ALTER TABLE public.equipments
  ADD COLUMN IF NOT EXISTS current_balance_tonnes numeric(18,5),
  ADD COLUMN IF NOT EXISTS pvkj_balance_tonnes numeric(18,5);

ALTER TABLE public.equipment_transactions
  ADD COLUMN IF NOT EXISTS quantity_tonnes numeric(18,5),
  ADD COLUMN IF NOT EXISTS balance_before_tonnes numeric(18,5),
  ADD COLUMN IF NOT EXISTS balance_after_tonnes numeric(18,5);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.equipments
    WHERE current_balance_tonnes IS NOT NULL
      AND current_balance_tonnes IS DISTINCT FROM current_balance / 1000
  ) OR EXISTS (
    SELECT 1 FROM public.equipments
    WHERE pvkj_balance_tonnes IS NOT NULL
      AND pvkj_balance_tonnes IS DISTINCT FROM pvkj_balance / 1000
  ) THEN
    RAISE EXCEPTION 'Existing equipment tonne balances do not match legacy kg values';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.equipment_transactions
    WHERE quantity_tonnes IS NOT NULL
      AND quantity_tonnes IS DISTINCT FROM quantity / 1000
  ) OR EXISTS (
    SELECT 1 FROM public.equipment_transactions
    WHERE balance_before_tonnes IS NOT NULL
      AND balance_before_tonnes IS DISTINCT FROM balance_before / 1000
  ) OR EXISTS (
    SELECT 1 FROM public.equipment_transactions
    WHERE balance_after_tonnes IS NOT NULL
      AND balance_after_tonnes IS DISTINCT FROM balance_after / 1000
  ) THEN
    RAISE EXCEPTION 'Existing equipment transaction tonnes do not match legacy kg values';
  END IF;
END
$$;

UPDATE public.equipments
SET current_balance_tonnes = current_balance / 1000
WHERE current_balance_tonnes IS NULL
  AND current_balance IS NOT NULL;

UPDATE public.equipments
SET pvkj_balance_tonnes = pvkj_balance / 1000
WHERE pvkj_balance_tonnes IS NULL
  AND pvkj_balance IS NOT NULL;

UPDATE public.equipment_transactions
SET quantity_tonnes = quantity / 1000
WHERE quantity_tonnes IS NULL
  AND quantity IS NOT NULL;

UPDATE public.equipment_transactions
SET balance_before_tonnes = balance_before / 1000
WHERE balance_before_tonnes IS NULL
  AND balance_before IS NOT NULL;

UPDATE public.equipment_transactions
SET balance_after_tonnes = balance_after / 1000
WHERE balance_after_tonnes IS NULL
  AND balance_after IS NOT NULL;

COMMIT;
