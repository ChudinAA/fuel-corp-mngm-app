
-- Add purchase_price_modified flag to opt table
ALTER TABLE opt ADD COLUMN IF NOT EXISTS purchase_price_modified BOOLEAN DEFAULT false;

-- Add purchase_price_modified flag to aircraft_refueling table
ALTER TABLE aircraft_refueling ADD COLUMN IF NOT EXISTS purchase_price_modified BOOLEAN DEFAULT false;
