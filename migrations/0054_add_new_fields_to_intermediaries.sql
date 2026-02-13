-- Add buy_currency_id, sell_currency_id, buy_exchange_rate, sell_exchange_rate, cross_conversion_cost, manual_commission_usd to refueling_abroad_intermediaries
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "buy_currency_id" uuid REFERENCES "currencies"("id");
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "sell_currency_id" uuid REFERENCES "currencies"("id");
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "buy_exchange_rate" numeric(12,5);
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "sell_exchange_rate" numeric(12,5);
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "cross_conversion_cost" numeric(12,5);
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "cross_conversion_cost_rub" numeric(12,5);
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "manual_commission_usd" numeric(12,5);

-- Add transaction_id to refueling_abroad
ALTER TABLE "refueling_abroad" ADD COLUMN IF NOT EXISTS "transaction_id" uuid REFERENCES "storage_card_transactions"("id");

-- Remove country, airport, airport_code, average_cost_currency, storage_cost from storage_cards
ALTER TABLE "storage_cards" DROP COLUMN IF EXISTS "country";
ALTER TABLE "storage_cards" DROP COLUMN IF EXISTS "airport";
ALTER TABLE "storage_cards" DROP COLUMN IF EXISTS "airport_code";
ALTER TABLE "storage_cards" DROP COLUMN IF EXISTS "average_cost_currency";
ALTER TABLE "storage_cards" DROP COLUMN IF EXISTS "storage_cost";

-- Remove countryIdx, airportIdx from storage_cards
DROP INDEX IF EXISTS "storage_cards_country_idx";
DROP INDEX IF EXISTS "storage_cards_airport_idx";

-- Add currency_id and currency_symbol (default $) to storage_cards
ALTER TABLE "storage_cards" ADD COLUMN IF NOT EXISTS "currency_id" uuid REFERENCES "currencies"("id");
ALTER TABLE "storage_cards" ADD COLUMN IF NOT EXISTS "currency_symbol" text DEFAULT '$';

-- Remove sum from storage_card_transactions, add date_to to storage_card_transactions
ALTER TABLE "storage_card_transactions" DROP COLUMN IF EXISTS "sum";
-- Add currency_symbol (default $) to storage_card_transactions
ALTER TABLE "storage_card_transactions" ADD COLUMN IF NOT EXISTS "currency_symbol" text DEFAULT '$';
-- Change average_cost scale to 5
ALTER TABLE "storage_cards" ALTER COLUMN "average_cost" TYPE numeric(12,5);
