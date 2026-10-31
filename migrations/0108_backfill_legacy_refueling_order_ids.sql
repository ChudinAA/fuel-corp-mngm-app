-- Manual data migration for Production SQL Console.
-- First run docs/production-sql/refueling-order-id-backfill-preview.sql and
-- review the READY groups. Then run this entire file in one SQL Console request.
--
-- Only fills refueling_order_id. Does not change deal values, stock movements,
-- or rows that already have an order ID.
-- Groups are exact RT number + calendar date, matching the legacy list ordering.
-- Only active common-aircraft rows are included; NULL equipment_type is treated
-- as "common". LIK rows, deleted rows, blank RT numbers, and ambiguous groups
-- are intentionally left unchanged.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '2min';

DO $$
BEGIN
  IF to_regclass('public.aircraft_refueling') IS NULL THEN
    RAISE EXCEPTION 'Required table public.aircraft_refueling is missing';
  END IF;

  IF EXISTS (
    SELECT required.column_name
    FROM (VALUES
      ('refueling_order_id'),
      ('order_number'),
      ('refueling_date'),
      ('equipment_type'),
      ('product_type'),
      ('deleted_at')
    ) AS required(column_name)
    WHERE NOT EXISTS (
      SELECT 1
      FROM information_schema.columns AS actual
      WHERE actual.table_schema = 'public'
        AND actual.table_name = 'aircraft_refueling'
        AND actual.column_name = required.column_name
    )
  ) THEN
    RAISE EXCEPTION
      'Required columns for legacy refueling-order backfill are missing';
  END IF;
END
$$;

WITH candidate_groups AS MATERIALIZED (
  SELECT
    r.order_number,
    r.refueling_date::date AS refueling_day,
    gen_random_uuid() AS refueling_order_id
  FROM public.aircraft_refueling AS r
  WHERE r.deleted_at IS NULL
    AND r.refueling_order_id IS NULL
    AND COALESCE(r.equipment_type, 'common') = 'common'
    AND r.order_number IS NOT NULL
    AND BTRIM(r.order_number) <> ''
    -- Do not create a second ID beside an existing order for the same RT/date.
    AND NOT EXISTS (
      SELECT 1
      FROM public.aircraft_refueling AS existing
      WHERE existing.order_number = r.order_number
        AND existing.refueling_date::date = r.refueling_date::date
        AND COALESCE(existing.equipment_type, 'common') = 'common'
        AND existing.refueling_order_id IS NOT NULL
    )
  GROUP BY r.order_number, r.refueling_date::date
  HAVING COUNT(*) BETWEEN 2 AND 3
    AND COUNT(DISTINCT r.product_type) = COUNT(*)
    AND BOOL_AND(r.product_type IN ('kerosene', 'pvkj', 'service'))
),
rows_to_update AS MATERIALIZED (
  SELECT
    r.id,
    g.refueling_order_id
  FROM public.aircraft_refueling AS r
  JOIN candidate_groups AS g
    ON g.order_number = r.order_number
   AND g.refueling_day = r.refueling_date::date
  WHERE r.deleted_at IS NULL
    AND r.refueling_order_id IS NULL
    AND COALESCE(r.equipment_type, 'common') = 'common'
)
UPDATE public.aircraft_refueling AS r
SET refueling_order_id = target.refueling_order_id
FROM rows_to_update AS target
WHERE r.id = target.id
  AND r.refueling_order_id IS NULL
RETURNING
  r.id AS deal_id,
  r.order_number,
  r.refueling_date::date AS refueling_day,
  r.refueling_order_id;

COMMIT;

-- Verify by rerunning the preview. No migrated group should remain marked READY.
