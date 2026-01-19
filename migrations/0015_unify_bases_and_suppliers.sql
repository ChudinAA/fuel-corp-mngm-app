
-- Create unified bases table
CREATE TABLE "bases" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "base_type" text NOT NULL, -- 'wholesale' or 'refueling'
  "location" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp,
  "created_by_id" uuid REFERENCES "users"("id"),
  "updated_by_id" uuid REFERENCES "users"("id")
);

-- Migrate data from wholesale_bases
INSERT INTO "bases" (id, name, base_type, location, is_active, created_at, updated_at, created_by_id, updated_by_id)
SELECT id, name, 'wholesale', location, is_active, created_at, updated_at, created_by_id, updated_by_id
FROM "wholesale_bases";

-- Migrate data from refueling_bases
INSERT INTO "bases" (id, name, base_type, location, is_active, created_at, updated_at, created_by_id, updated_by_id)
SELECT id, name, 'refueling', location, is_active, created_at, updated_at, created_by_id, updated_by_id
FROM "refueling_bases";

-- Create unified suppliers table
CREATE TABLE "suppliers" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "base_ids" text[],
  "service_price" numeric(12, 2),
  "pvkj_price" numeric(12, 2),
  "agent_fee" numeric(12, 2),
  "is_warehouse" boolean DEFAULT false,
  "warehouse_id" uuid REFERENCES "warehouses"("id"),
  "storage_cost" numeric(12, 2),
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp,
  "created_by_id" uuid REFERENCES "users"("id"),
  "updated_by_id" uuid REFERENCES "users"("id")
);

-- Migrate data from wholesale_suppliers
INSERT INTO "suppliers" (id, name, description, base_ids, is_warehouse, warehouse_id, storage_cost, is_active, created_at, updated_at, created_by_id, updated_by_id)
SELECT id, name, description, base_ids, is_warehouse, NULL, storage_cost, is_active, created_at, updated_at, created_by_id, updated_by_id
FROM "wholesale_suppliers";

-- Migrate data from refueling_providers
INSERT INTO "suppliers" (id, name, description, base_ids, service_price, pvkj_price, agent_fee, is_warehouse, warehouse_id, storage_cost, is_active, created_at, updated_at, created_by_id, updated_by_id)
SELECT id, name, description, base_ids, service_price, pvkj_price, agent_fee, is_warehouse, NULL, storage_cost, is_active, created_at, updated_at, created_by_id, updated_by_id
FROM "refueling_providers";

-- Update warehouse_id for suppliers that are warehouses
UPDATE "suppliers" s
SET warehouse_id = w.id
FROM "warehouses" w
WHERE w.supplier_id = s.id 
  AND w.supplier_type IN ('wholesale', 'refueling')
  AND s.is_warehouse = true;

-- Drop old tables
DROP TABLE IF EXISTS "wholesale_bases" CASCADE;
DROP TABLE IF EXISTS "refueling_bases" CASCADE;
DROP TABLE IF EXISTS "wholesale_suppliers" CASCADE;
DROP TABLE IF EXISTS "refueling_providers" CASCADE;
