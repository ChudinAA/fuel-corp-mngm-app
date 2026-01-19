
-- Create supplier_bases junction table
CREATE TABLE IF NOT EXISTS "supplier_bases" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "supplier_id" uuid NOT NULL REFERENCES "suppliers"("id") ON DELETE CASCADE,
  "base_id" uuid NOT NULL REFERENCES "bases"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now()
);

-- Create unique index to prevent duplicate supplier-base pairs
CREATE UNIQUE INDEX IF NOT EXISTS "unique_supplier_base_idx" ON "supplier_bases"("supplier_id", "base_id");

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "idx_supplier_bases_supplier_id" ON "supplier_bases"("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_bases_base_id" ON "supplier_bases"("base_id");

-- Migrate existing data from suppliers.base_ids to supplier_bases
INSERT INTO "supplier_bases" ("supplier_id", "base_id", "created_at")
SELECT s.id, UNNEST(s.base_ids)::uuid, s.created_at
FROM "suppliers" s
WHERE s.base_ids IS NOT NULL AND array_length(s.base_ids, 1) > 0
ON CONFLICT DO NOTHING;

-- Create warehouse_bases junction table
CREATE TABLE IF NOT EXISTS "warehouse_bases" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id") ON DELETE CASCADE,
  "base_id" uuid NOT NULL REFERENCES "bases"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now()
);

-- Create unique index to prevent duplicate warehouse-base pairs
CREATE UNIQUE INDEX IF NOT EXISTS "unique_warehouse_base_idx" ON "warehouse_bases"("warehouse_id", "base_id");

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "idx_warehouse_bases_warehouse_id" ON "warehouse_bases"("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_warehouse_bases_base_id" ON "warehouse_bases"("base_id");

-- Migrate existing data from warehouses.base_ids to warehouse_bases
INSERT INTO "warehouse_bases" ("warehouse_id", "base_id", "created_at")
SELECT w.id, UNNEST(w.base_ids)::uuid, w.created_at
FROM "warehouses" w
WHERE w.base_ids IS NOT NULL AND array_length(w.base_ids, 1) > 0
ON CONFLICT DO NOTHING;

-- Remove base_ids column from suppliers (will be done after ensuring all code is updated)
-- ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "base_ids";

-- Remove base_ids column from warehouses (will be done after ensuring all code is updated)
-- ALTER TABLE "warehouses" DROP COLUMN IF EXISTS "base_ids";
