-- Additive correction: product type is independent of the integration-only nomenclature kind.
ALTER TABLE nomenclature ADD COLUMN IF NOT EXISTS product_type text;
UPDATE nomenclature n SET product_type = t.code
FROM nomenclature_types t
WHERE n.nomenclature_type_id = t.id AND n.product_type IS NULL
  AND t.code IN ('kerosene', 'pvkj', 'service');
ALTER TABLE nomenclature ALTER COLUMN nomenclature_type_id DROP NOT NULL;
DROP INDEX IF EXISTS nomenclature_one_default_per_type_idx;
-- Keep at most one active default when old kinds map to the same product type.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY product_type ORDER BY created_at, id) AS position
  FROM nomenclature WHERE is_default AND deleted_at IS NULL AND product_type IS NOT NULL
)
UPDATE nomenclature SET is_default = false
WHERE id IN (SELECT id FROM ranked WHERE position > 1);
CREATE UNIQUE INDEX IF NOT EXISTS nomenclature_one_default_per_product_idx
  ON nomenclature(product_type)
  WHERE is_default = true AND deleted_at IS NULL AND product_type IS NOT NULL;
ALTER TABLE units_of_measure ADD COLUMN IF NOT EXISTS reference_unit_id uuid REFERENCES units_of_measure(id);
-- Retain the old reference_nomenclature_id only as historical data; it is not used for conversions.
