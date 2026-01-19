
-- Add warehouse_id to opt table
ALTER TABLE opt ADD COLUMN warehouse_id UUID REFERENCES warehouses(id);
