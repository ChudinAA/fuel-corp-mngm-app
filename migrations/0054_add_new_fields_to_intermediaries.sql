-- Add buy_currency_id, sell_currency_id, buy_exchange_rate, sell_exchange_rate, cross_conversion_cost, manual_commission_usd to refueling_abroad_intermediaries
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "buy_currency_id" uuid REFERENCES "currencies"("id");
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "sell_currency_id" uuid REFERENCES "currencies"("id");
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "buy_exchange_rate" numeric(12,5);
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "sell_exchange_rate" numeric(12,5);
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "cross_conversion_cost" numeric(12,5);
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "cross_conversion_cost_rub" numeric(12,5);
ALTER TABLE "refueling_abroad_intermediaries" ADD COLUMN IF NOT EXISTS "manual_commission_usd" numeric(12,5);
