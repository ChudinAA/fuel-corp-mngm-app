-- Migration to add new fields to suppliers and customers tables
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "full_name" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "iata" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "supply_nomenclature" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "with_vat" boolean DEFAULT false;

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