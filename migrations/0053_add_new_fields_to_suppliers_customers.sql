-- Migration to add new fields to suppliers and customers tables
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "full_name" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "iata" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "supply_nomenclature" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "with_vat" boolean DEFAULT false;
-- Add storage_card_id for suppliers and supplier_id for storage_cards
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "storage_card_id" uuid;
ALTER TABLE "storage_cards" ADD COLUMN IF NOT EXISTS "supplier_id" uuid REFERENCES "suppliers"("id");

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "full_name" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "iata" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "with_vat" boolean DEFAULT false;

-- Add input_mode fields to opt, refueling, movements 
ALTER TABLE "opt" ADD COLUMN IF NOT EXISTS "input_mode" text;
ALTER TABLE "aircraft_refueling" ADD COLUMN IF NOT EXISTS "input_mode" text;
ALTER TABLE "refueling_abroad" ADD COLUMN IF NOT EXISTS "input_mode" text;
ALTER TABLE "movement" ADD COLUMN IF NOT EXISTS "input_mode" text;

-- Seed input_mode = 'kg' for all existing records
UPDATE "opt" SET input_mode = 'kg';
UPDATE "aircraft_refueling" SET input_mode = 'kg';
UPDATE "refueling_abroad" SET input_mode = 'kg';
UPDATE "movement" SET input_mode = 'kg';

-- Add is_price_recharge field to aircraft_refueling
ALTER TABLE "aircraft_refueling" ADD COLUMN IF NOT EXISTS "is_price_recharge" boolean DEFAULT false;
-- Seed is_price_recharge = false for all existing records
UPDATE "aircraft_refueling" SET is_price_recharge = false;

-- Add basis_id to refueling_abroad
ALTER TABLE "refueling_abroad" ADD COLUMN IF NOT EXISTS "basis_id" uuid REFERENCES "bases"("id");

-- Add currency_id to prices, exchange_rates target_currency_id
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "currency_id" uuid REFERENCES "currencies"("id");
ALTER TABLE "exchange_rates" ADD COLUMN IF NOT EXISTS "currency_id" uuid REFERENCES "currencies"("id");
ALTER TABLE "exchange_rates" ADD COLUMN IF NOT EXISTS "target_currency_id" uuid REFERENCES "currencies"("id");

-- Seed currency_id matching currency name field for all existing records
UPDATE "prices" SET currency_id = (SELECT id FROM currencies WHERE code = prices.currency);
UPDATE "exchange_rates" SET currency_id = (SELECT id FROM currencies WHERE code = exchange_rates.currency);
UPDATE "exchange_rates" SET target_currency_id = (SELECT id FROM currencies WHERE code = exchange_rates.target_currency);