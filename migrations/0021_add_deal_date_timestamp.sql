
-- Add deal_date timestamp to opt
ALTER TABLE opt ADD COLUMN IF NOT EXISTS deal_date TIMESTAMP;

-- Update deal_date from existing data (keep the date but set time to created_at time)
UPDATE opt SET deal_date = COALESCE(created_at, NOW()) WHERE deal_date IS NULL;

-- Add deal_date timestamp to aircraft_refueling
ALTER TABLE aircraft_refueling ADD COLUMN IF NOT EXISTS deal_date TIMESTAMP;
UPDATE aircraft_refueling SET deal_date = COALESCE(created_at, NOW()) WHERE deal_date IS NULL;

-- Add deal_date timestamp to movement
ALTER TABLE movement ADD COLUMN IF NOT EXISTS deal_date TIMESTAMP;
UPDATE movement SET deal_date = COALESCE(created_at, NOW()) WHERE deal_date IS NULL;

-- Add deal_date timestamp to exchange
ALTER TABLE exchange ADD COLUMN IF NOT EXISTS deal_date TIMESTAMP;
UPDATE exchange SET deal_date = COALESCE(created_at, NOW()) WHERE deal_date IS NULL;
