
-- Add source_transaction_id to movement table for internal movements (from warehouse)
ALTER TABLE movement ADD COLUMN IF NOT EXISTS source_transaction_id UUID REFERENCES warehouse_transactions(id);
