
-- Remove supplier_type column from warehouses table
ALTER TABLE "warehouses" DROP COLUMN IF EXISTS "supplier_type";
