BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.supplier_basis_prices') IS NULL THEN
    RAISE EXCEPTION 'Required table public.supplier_basis_prices is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'supplier_basis_prices'
      AND column_name = 'service_price'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'supplier_basis_prices'
      AND column_name = 'pvkj_price'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'supplier_basis_prices'
      AND column_name = 'agent_fee'
  ) THEN
    RAISE EXCEPTION 'Required legacy supplier basis rate columns are missing';
  END IF;
END $$;

ALTER TABLE public.supplier_basis_prices
  ADD COLUMN IF NOT EXISTS service_price_per_tonne numeric(22,6),
  ADD COLUMN IF NOT EXISTS pvkj_price_per_tonne numeric(22,6),
  ADD COLUMN IF NOT EXISTS agent_fee_per_tonne numeric(22,6);

UPDATE public.supplier_basis_prices
SET service_price_per_tonne = ROUND(service_price * 1000, 6)
WHERE service_price_per_tonne IS NULL
  AND service_price IS NOT NULL;

UPDATE public.supplier_basis_prices
SET pvkj_price_per_tonne = ROUND(pvkj_price * 1000, 6)
WHERE pvkj_price_per_tonne IS NULL
  AND pvkj_price IS NOT NULL;

UPDATE public.supplier_basis_prices
SET agent_fee_per_tonne = ROUND(agent_fee * 1000, 6)
WHERE agent_fee_per_tonne IS NULL
  AND agent_fee IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.supplier_basis_prices
    WHERE (service_price IS NOT NULL AND service_price_per_tonne IS NULL)
       OR (pvkj_price IS NOT NULL AND pvkj_price_per_tonne IS NULL)
       OR (agent_fee IS NOT NULL AND agent_fee_per_tonne IS NULL)
  ) THEN
    RAISE EXCEPTION 'Supplier basis per-tonne rate backfill verification failed';
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_basis_prices.service_price_per_tonne IS
  'Authoritative supplier service rate in currency per metric tonne; service_price remains a compatibility mirror.';
COMMENT ON COLUMN public.supplier_basis_prices.pvkj_price_per_tonne IS
  'Authoritative supplier PVKJ rate in currency per metric tonne; pvkj_price remains a compatibility mirror.';
COMMENT ON COLUMN public.supplier_basis_prices.agent_fee_per_tonne IS
  'Authoritative supplier agent fee rate in currency per metric tonne; agent_fee remains a compatibility mirror.';

COMMIT;
