-- Add basis_id to prices
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "basis_id" uuid REFERENCES "bases"("id");

-- Add fields to aircraft_refueling
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
  basis_id = pp.basis_id,
  customer_basis = sp.basis,
  customer_basis_id = sp.basis_id
FROM "prices" pp
LEFT JOIN "prices" sp ON o.sale_price_id = sp.id
WHERE o.purchase_price_id = pp.id;

-- Seed logic: 3. aircraft_refueling (basis_id from purchasePrice, customer_basis/id from salePrice)
UPDATE "aircraft_refueling" ar
SET 
  basis_id = pp.basis_id,
  customer_basis = sp.basis,
  customer_basis_id = sp.basis_id
FROM "prices" pp
LEFT JOIN "prices" sp ON ar.sale_price_id = sp.id
WHERE ar.purchase_price_id = pp.id;
