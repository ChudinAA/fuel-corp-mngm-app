
-- Drop and recreate deal_date columns with correct timestamp type

-- OPT table
ALTER TABLE opt DROP COLUMN IF EXISTS deal_date;
ALTER TABLE opt ADD COLUMN deal_date TIMESTAMP NOT NULL DEFAULT NOW();
UPDATE opt SET deal_date = created_at WHERE deal_date = NOW();

-- Aircraft Refueling table
ALTER TABLE aircraft_refueling DROP COLUMN IF EXISTS deal_date;
ALTER TABLE aircraft_refueling ADD COLUMN deal_date TIMESTAMP NOT NULL DEFAULT NOW();
UPDATE aircraft_refueling SET deal_date = created_at WHERE deal_date = NOW();

-- Movement table
ALTER TABLE movement DROP COLUMN IF EXISTS deal_date;
ALTER TABLE movement ADD COLUMN deal_date TIMESTAMP NOT NULL DEFAULT NOW();
UPDATE movement SET deal_date = created_at WHERE deal_date = NOW();

-- Exchange table - drop old date field and create new timestamp field
ALTER TABLE exchange DROP COLUMN IF EXISTS deal_date;
ALTER TABLE exchange ADD COLUMN deal_date TIMESTAMP NOT NULL DEFAULT NOW();
UPDATE exchange SET deal_date = created_at WHERE deal_date = NOW();

-- Add foreign key constraints for price references
ALTER TABLE opt ADD CONSTRAINT opt_purchase_price_id_fkey 
  FOREIGN KEY (purchase_price_id) REFERENCES prices(id) ON DELETE SET NULL;
  
ALTER TABLE opt ADD CONSTRAINT opt_sale_price_id_fkey 
  FOREIGN KEY (sale_price_id) REFERENCES prices(id) ON DELETE SET NULL;

ALTER TABLE aircraft_refueling ADD CONSTRAINT aircraft_refueling_purchase_price_id_fkey 
  FOREIGN KEY (purchase_price_id) REFERENCES prices(id) ON DELETE SET NULL;
  
ALTER TABLE aircraft_refueling ADD CONSTRAINT aircraft_refueling_sale_price_id_fkey 
  FOREIGN KEY (sale_price_id) REFERENCES prices(id) ON DELETE SET NULL;

-- Add missing updatedById reference to exchange
ALTER TABLE exchange ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Create additional indexes for dealDate fields
CREATE INDEX IF NOT EXISTS idx_opt_deal_date ON opt(deal_date);
CREATE INDEX IF NOT EXISTS idx_aircraft_refueling_deal_date ON aircraft_refueling(deal_date);
CREATE INDEX IF NOT EXISTS idx_movement_deal_date ON movement(deal_date);
CREATE INDEX IF NOT EXISTS idx_exchange_deal_date ON exchange(deal_date);

-- Indexes for price foreign keys
CREATE INDEX IF NOT EXISTS idx_opt_purchase_price_id ON opt(purchase_price_id);
CREATE INDEX IF NOT EXISTS idx_opt_sale_price_id ON opt(sale_price_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_refueling_purchase_price_id ON aircraft_refueling(purchase_price_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_refueling_sale_price_id ON aircraft_refueling(sale_price_id);
