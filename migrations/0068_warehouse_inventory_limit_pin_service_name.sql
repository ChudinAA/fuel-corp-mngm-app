-- Add service_name to warehouse_services
ALTER TABLE warehouse_services ADD COLUMN IF NOT EXISTS service_name text;

-- Add is_pinned, limit fields to warehouses
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS limit_volume decimal(15,2);
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS limit_product_type text;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS limit_expires_at date;
