
-- Add transaction_id to opt table
ALTER TABLE opt ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES warehouse_transactions(id);

-- Add transaction_id to aircraft_refueling table
ALTER TABLE aircraft_refueling ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES warehouse_transactions(id);
