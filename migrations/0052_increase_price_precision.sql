
-- Migration to increase price precision to 5 decimal places
-- Tables: prices, opt, aircraft_refueling, movement

-- 1. Prices table: price_values stores JSON strings, but schema needs updates
-- volume and sold_volume stay at 2 decimal places

-- 2. OPT table
ALTER TABLE "opt" ALTER COLUMN "purchase_price" TYPE numeric(19, 5);
ALTER TABLE "opt" ALTER COLUMN "sale_price" TYPE numeric(19, 5);
ALTER TABLE "opt" ALTER COLUMN "delivery_tariff" TYPE numeric(19, 5);

-- 3. Aircraft Refueling table
ALTER TABLE "aircraft_refueling" ALTER COLUMN "purchase_price" TYPE numeric(19, 5);
ALTER TABLE "aircraft_refueling" ALTER COLUMN "sale_price" TYPE numeric(19, 5);

-- 4. Movement table
ALTER TABLE "movement" ALTER COLUMN "purchase_price" TYPE numeric(19, 5);
ALTER TABLE "movement" ALTER COLUMN "delivery_price" TYPE numeric(19, 5);
ALTER TABLE "movement" ALTER COLUMN "cost_per_kg" TYPE numeric(19, 5);

-- 5. Delivery Cost (if applicable)
ALTER TABLE "delivery_cost" ALTER COLUMN "cost_per_kg" TYPE numeric(19, 5);
