
-- Add transaction_id to movement table
ALTER TABLE movement ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES warehouse_transactions(id);
