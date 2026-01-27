-- Step 1: Add columns
ALTER TABLE movement 
ADD COLUMN IF NOT EXISTS storage_cost DECIMAL(15, 2);
  
-- Step 2: Update storage_cost for existing records
UPDATE movement m
SET 
  storage_cost = w.storage_cost * m.quantity_kg / 1000
FROM warehouses w
WHERE m.to_warehouse_id = w.id;
