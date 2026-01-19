
-- Update wholesale_suppliers table
ALTER TABLE "wholesale_suppliers" DROP COLUMN IF EXISTS "default_base_id";
ALTER TABLE "wholesale_suppliers" ADD COLUMN IF NOT EXISTS "base_ids" text[];
ALTER TABLE "wholesale_suppliers" ADD COLUMN IF NOT EXISTS "is_warehouse" boolean DEFAULT false;
ALTER TABLE "wholesale_suppliers" ADD COLUMN IF NOT EXISTS "storage_cost" numeric(12, 2);

-- Update refueling_providers table
ALTER TABLE "refueling_providers" DROP COLUMN IF EXISTS "default_base_id";
ALTER TABLE "refueling_providers" ADD COLUMN IF NOT EXISTS "base_ids" text[];
ALTER TABLE "refueling_providers" ADD COLUMN IF NOT EXISTS "is_warehouse" boolean DEFAULT false;
ALTER TABLE "refueling_providers" ADD COLUMN IF NOT EXISTS "storage_cost" numeric(12, 2);

-- Update warehouses table
ALTER TABLE "warehouses" DROP COLUMN IF EXISTS "base_id";
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "base_ids" text[];
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "supplier_type" text;
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "supplier_id" uuid;
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "storage_cost" numeric(12, 2);

-- Drop logistics_warehouses table (no longer needed)
DROP TABLE IF EXISTS "logistics_warehouses" CASCADE;

-- Update delivery_cost table
ALTER TABLE "delivery_cost" DROP COLUMN IF EXISTS "base_id";
ALTER TABLE "delivery_cost" DROP COLUMN IF EXISTS "destination_id";
ALTER TABLE "delivery_cost" ADD COLUMN IF NOT EXISTS "from_entity_type" text;
ALTER TABLE "delivery_cost" ADD COLUMN IF NOT EXISTS "from_entity_id" uuid;
ALTER TABLE "delivery_cost" ADD COLUMN IF NOT EXISTS "to_entity_type" text;
ALTER TABLE "delivery_cost" ADD COLUMN IF NOT EXISTS "to_entity_id" uuid;

-- Update existing data to use new structure (if needed)
UPDATE "delivery_cost" 
SET "from_entity_type" = 'base',
    "to_entity_type" = 'delivery_location'
WHERE "from_entity_type" IS NULL;
