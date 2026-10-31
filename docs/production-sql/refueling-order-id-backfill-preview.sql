-- Read-only preflight for migrations/0108_backfill_legacy_refueling_order_ids.sql
-- Run this first in Production SQL Console. Migrate only rows marked READY.
--
-- Scope matches the migration: active common-aircraft rows (NULL equipment_type
-- is treated as "common"), exact RT number, same calendar date, no existing
-- order ID anywhere in that group, and 2-3 distinct supported product types.

WITH rt_groups AS (
  SELECT
    r.order_number,
    r.refueling_date::date AS refueling_day,
    COUNT(*) FILTER (
      WHERE r.deleted_at IS NULL AND r.refueling_order_id IS NULL
    ) AS unlinked_active_rows,
    COUNT(DISTINCT r.product_type) FILTER (
      WHERE r.deleted_at IS NULL AND r.refueling_order_id IS NULL
    ) AS distinct_unlinked_product_types,
    COALESCE(
      ARRAY_AGG(DISTINCT r.product_type ORDER BY r.product_type) FILTER (
        WHERE r.deleted_at IS NULL AND r.refueling_order_id IS NULL
      ),
      ARRAY[]::text[]
    ) AS unlinked_product_types,
    COALESCE(BOOL_OR(r.refueling_order_id IS NOT NULL), FALSE)
      AS has_existing_order_id
  FROM public.aircraft_refueling AS r
  WHERE COALESCE(r.equipment_type, 'common') = 'common'
    AND r.order_number IS NOT NULL
    AND BTRIM(r.order_number) <> ''
  GROUP BY r.order_number, r.refueling_date::date
)
SELECT
  order_number,
  refueling_day,
  unlinked_active_rows,
  unlinked_product_types,
  has_existing_order_id,
  CASE
    WHEN has_existing_order_id
      THEN 'SKIP: в группе уже есть сделка с ID заказа'
    WHEN unlinked_active_rows > 3
      THEN 'SKIP: больше трёх строк'
    WHEN unlinked_active_rows <> distinct_unlinked_product_types
      THEN 'SKIP: повторяется тип продукта'
    WHEN NOT (
      unlinked_product_types <@ ARRAY['kerosene', 'pvkj', 'service']::text[]
    )
      THEN 'SKIP: тип продукта не поддерживается заказом'
    ELSE 'READY'
  END AS migration_status
FROM rt_groups
WHERE unlinked_active_rows >= 2
   OR (unlinked_active_rows >= 1 AND has_existing_order_id)
ORDER BY refueling_day, order_number;
