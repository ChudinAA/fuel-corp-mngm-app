-- Migration to add new fields to suppliers and customers tables
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "full_name" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "iata" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "supply_nomenclature" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "with_vat" boolean DEFAULT false;

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "full_name" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "iata" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "with_vat" boolean DEFAULT false;
