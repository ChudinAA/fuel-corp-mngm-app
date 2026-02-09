-- Add buy_currency_id, sell_currency_id, buy_exchange_rate, sell_exchange_rate, buy_exchange_rate_id, sell_exchange_rate_id, cross_conversion_cost to refueling_abroad_intermediaries
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "buy_currency_id" uuid REFERENCES "currencies"("id");
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "sell_currency_id" uuid REFERENCES "currencies"("id");
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "buy_exchange_rate" numeric(12,4);
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "sell_exchange_rate" numeric(12,4);
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "buy_exchange_rate_id" uuid REFERENCES "exchange_rates"("id");
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "sell_exchange_rate_id" uuid REFERENCES "exchange_rates"("id");
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "cross_conversion_cost" numeric(12,4);
