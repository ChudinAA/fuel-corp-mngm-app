-- Step 1: Add columns
ALTER TABLE warehouse_transactions 
ADD COLUMN IF NOT EXISTS sum DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS price DECIMAL(12, 4),
ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMP;

-- Step 2: Migrate data for OPT deals (using purchase_amount as sum and purchase_price as price)
UPDATE warehouse_transactions wt
SET 
  sum = o.purchase_amount::numeric,
  price = o.purchase_price::numeric
FROM opt o
WHERE wt.source_type = 'opt' AND wt.source_id = o.id;

-- Step 3: Migrate data for Refueling deals (using purchase_amount as sum and purchase_price as price)
UPDATE warehouse_transactions wt
SET 
  sum = a.purchase_amount::numeric,
  price = a.purchase_price::numeric
FROM aircraft_refueling a
WHERE wt.source_type = 'refueling' AND wt.source_id = a.id;

-- Step 4: Migrate data for Movements (using total_cost as sum and cost_per_kg as price)
UPDATE warehouse_transactions wt
SET 
  sum = m.total_cost::numeric,
  price = m.cost_per_kg::numeric
FROM movement m
WHERE wt.source_type = 'movement' AND wt.source_id = m.id;
