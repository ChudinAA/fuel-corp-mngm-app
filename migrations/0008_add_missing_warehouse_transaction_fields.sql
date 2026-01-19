
-- Add missing fields to warehouse_transactions table if they don't exist
DO $$ 
BEGIN
    -- Add balance_before if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'warehouse_transactions' AND column_name = 'balance_before'
    ) THEN
        ALTER TABLE warehouse_transactions 
        ADD COLUMN balance_before NUMERIC(15, 2);
    END IF;

    -- Add average_cost_before if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'warehouse_transactions' AND column_name = 'average_cost_before'
    ) THEN
        ALTER TABLE warehouse_transactions 
        ADD COLUMN average_cost_before NUMERIC(12, 4);
    END IF;

    -- Add created_at if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'warehouse_transactions' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE warehouse_transactions 
        ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

-- Update existing records to have balance_before calculated from balance_after and quantity
UPDATE warehouse_transactions 
SET balance_before = (
    CASE 
        WHEN quantity < 0 THEN balance_after - quantity
        ELSE balance_after - quantity
    END
)
WHERE balance_before IS NULL AND balance_after IS NOT NULL;

-- Update existing records to have average_cost_before same as average_cost_after where missing
UPDATE warehouse_transactions 
SET average_cost_before = average_cost_after
WHERE average_cost_before IS NULL AND average_cost_after IS NOT NULL;
