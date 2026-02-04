-- Add basis_id to prices
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "basis_id" uuid REFERENCES "bases"("id");

-- Add flight_number fields to refueling 
ALTER TABLE "aircraft_refueling" ADD COLUMN IF NOT EXISTS "flight_number" text;
ALTER TABLE "refueling_abroad" ADD COLUMN IF NOT EXISTS "flight_number" text;

-- Add fields to aircraft_refueling flight_number
ALTER TABLE "aircraft_refueling" ADD COLUMN IF NOT EXISTS "customer_basis" text;
ALTER TABLE "aircraft_refueling" ADD COLUMN IF NOT EXISTS "basis_id" uuid REFERENCES "bases"("id");
ALTER TABLE "aircraft_refueling" ADD COLUMN IF NOT EXISTS "customer_basis_id" uuid REFERENCES "bases"("id");

-- Add fields to opt
ALTER TABLE "opt" ADD COLUMN IF NOT EXISTS "customer_basis" text;
ALTER TABLE "opt" ADD COLUMN IF NOT EXISTS "basis_id" uuid REFERENCES "bases"("id");
ALTER TABLE "opt" ADD COLUMN IF NOT EXISTS "customer_basis_id" uuid REFERENCES "bases"("id");

-- Seed logic: 1. prices.basis_id
UPDATE "prices" p
SET basis_id = b.id
FROM "bases" b
WHERE p.counterparty_type = b.base_type AND p.basis = b.name;

-- Seed logic: 2. opt (basis_id from purchasePrice, customer_basis/id from salePrice)
UPDATE "opt" o
SET 
  basis_id = p.basis_id
FROM "prices" p
WHERE o.purchase_price_id = p.id;

UPDATE "opt" o
SET 
  customer_basis = p.basis,
  customer_basis_id = p.basis_id
FROM "prices" p
WHERE o.sale_price_id = p.id;

-- Seed logic: 3. aircraft_refueling (basis_id from purchasePrice, customer_basis/id from salePrice)
UPDATE "aircraft_refueling" ar
SET 
  basis_id = p.basis_id
FROM "prices" p
WHERE ar.purchase_price_id = p.id;

UPDATE "aircraft_refueling" ar
SET 
  customer_basis = p.basis,
  customer_basis_id = p.basis_id
FROM "prices" p
WHERE ar.sale_price_id = p.id;
