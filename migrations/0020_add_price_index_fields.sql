
-- Add price index fields to track which price from array was selected
ALTER TABLE "opt" ADD COLUMN "purchase_price_index" integer DEFAULT 0;
ALTER TABLE "opt" ADD COLUMN "sale_price_index" integer DEFAULT 0;

ALTER TABLE "aircraft_refueling" ADD COLUMN "purchase_price_index" integer DEFAULT 0;
ALTER TABLE "aircraft_refueling" ADD COLUMN "sale_price_index" integer DEFAULT 0;
