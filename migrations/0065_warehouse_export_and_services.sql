-- Add is_export flag to warehouses
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "is_export" boolean DEFAULT false;

-- Create warehouse_services table
CREATE TABLE IF NOT EXISTS "warehouse_services" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id") ON DELETE CASCADE,
  "service_type" text NOT NULL,
  "service_value" numeric(15, 6) NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp
);

CREATE INDEX IF NOT EXISTS "warehouse_services_warehouse_id_idx" ON "warehouse_services"("warehouse_id");
