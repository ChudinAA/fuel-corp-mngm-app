
-- Add warehouse_id to aircraft_refueling table if not exists
ALTER TABLE aircraft_refueling ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);
