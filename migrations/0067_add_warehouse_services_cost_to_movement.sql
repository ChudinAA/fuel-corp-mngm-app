-- Add warehouse_services_cost column to movement table
ALTER TABLE "movement" ADD COLUMN IF NOT EXISTS "warehouse_services_cost" numeric(15, 2);
