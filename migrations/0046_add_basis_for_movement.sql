-- Add basis field to movement table
ALTER TABLE movement ADD COLUMN IF NOT EXISTS basis text;

-- Add price id and price index fields to track which price from array was selected
ALTER TABLE movement ADD COLUMN IF NOT EXISTS purchase_price_id UUID REFERENCES prices(id);
ALTER TABLE movement ADD COLUMN IF NOT EXISTS purchase_price_index integer DEFAULT 0;