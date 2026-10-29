-- Data backfill only. Replit Publish first adds the nullable *_per_tonne
-- columns from the Drizzle schema; run this script afterward.
BEGIN;

UPDATE public.warehouses
SET average_cost_per_tonne = ROUND(average_cost * 1000, 6)
WHERE average_cost_per_tonne IS NULL
  AND average_cost IS NOT NULL;

UPDATE public.warehouses
SET pvkj_average_cost_per_tonne = ROUND(pvkj_average_cost * 1000, 6)
WHERE pvkj_average_cost_per_tonne IS NULL
  AND pvkj_average_cost IS NOT NULL;

UPDATE public.warehouse_transactions
SET price_per_tonne = ROUND(price * 1000, 6)
WHERE price_per_tonne IS NULL
  AND price IS NOT NULL;

UPDATE public.warehouse_transactions
SET average_cost_before_per_tonne = ROUND(average_cost_before * 1000, 6)
WHERE average_cost_before_per_tonne IS NULL
  AND average_cost_before IS NOT NULL;

UPDATE public.warehouse_transactions
SET average_cost_after_per_tonne = ROUND(average_cost_after * 1000, 6)
WHERE average_cost_after_per_tonne IS NULL
  AND average_cost_after IS NOT NULL;

UPDATE public.equipments
SET average_cost_per_tonne = ROUND(average_cost * 1000, 6)
WHERE average_cost_per_tonne IS NULL
  AND average_cost IS NOT NULL;

UPDATE public.equipments
SET pvkj_average_cost_per_tonne = ROUND(pvkj_average_cost * 1000, 6)
WHERE pvkj_average_cost_per_tonne IS NULL
  AND pvkj_average_cost IS NOT NULL;

UPDATE public.equipment_transactions
SET price_per_tonne = ROUND(price * 1000, 6)
WHERE price_per_tonne IS NULL
  AND price IS NOT NULL;

UPDATE public.equipment_transactions
SET average_cost_before_per_tonne = ROUND(average_cost_before * 1000, 6)
WHERE average_cost_before_per_tonne IS NULL
  AND average_cost_before IS NOT NULL;

UPDATE public.equipment_transactions
SET average_cost_after_per_tonne = ROUND(average_cost_after * 1000, 6)
WHERE average_cost_after_per_tonne IS NULL
  AND average_cost_after IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.warehouses
    WHERE (average_cost IS NOT NULL AND average_cost_per_tonne IS NULL)
       OR (pvkj_average_cost IS NOT NULL AND pvkj_average_cost_per_tonne IS NULL)
  ) OR EXISTS (
    SELECT 1 FROM public.warehouse_transactions
    WHERE (price IS NOT NULL AND price_per_tonne IS NULL)
       OR (average_cost_before IS NOT NULL AND average_cost_before_per_tonne IS NULL)
       OR (average_cost_after IS NOT NULL AND average_cost_after_per_tonne IS NULL)
  ) OR EXISTS (
    SELECT 1 FROM public.equipments
    WHERE (average_cost IS NOT NULL AND average_cost_per_tonne IS NULL)
       OR (pvkj_average_cost IS NOT NULL AND pvkj_average_cost_per_tonne IS NULL)
  ) OR EXISTS (
    SELECT 1 FROM public.equipment_transactions
    WHERE (price IS NOT NULL AND price_per_tonne IS NULL)
       OR (average_cost_before IS NOT NULL AND average_cost_before_per_tonne IS NULL)
       OR (average_cost_after IS NOT NULL AND average_cost_after_per_tonne IS NULL)
  ) THEN
    RAISE EXCEPTION 'Warehouse/equipment per-tonne cost backfill verification failed';
  END IF;
END $$;

COMMIT;
