-- Create refueling_abroad_exchange_rates table
CREATE TABLE IF NOT EXISTS "refueling_abroad_exchange_rates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "refueling_abroad_id" uuid NOT NULL REFERENCES "refueling_abroad"("id") ON DELETE CASCADE,
  "chain_position" integer NOT NULL DEFAULT 0,
  "exchange_rate_id" uuid REFERENCES "exchange_rates"("id"),
  "from_currency_id" uuid REFERENCES "currencies"("id"),
  "to_currency_id" uuid REFERENCES "currencies"("id"),
  "from_currency_code" text,
  "to_currency_code" text,
  "rate" decimal(15, 6),
  "rate_date" text,
  "notes" text,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "raer_refueling_abroad_idx" ON "refueling_abroad_exchange_rates" ("refueling_abroad_id");
CREATE INDEX IF NOT EXISTS "raer_chain_position_idx" ON "refueling_abroad_exchange_rates" ("refueling_abroad_id", "chain_position");

-- Create refueling_abroad_bank_commissions table
CREATE TABLE IF NOT EXISTS "refueling_abroad_bank_commissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "refueling_abroad_id" uuid NOT NULL REFERENCES "refueling_abroad"("id") ON DELETE CASCADE,
  "chain_position" integer NOT NULL DEFAULT 0,
  "commission_type" text NOT NULL DEFAULT 'percent',
  "percent" decimal(10, 4),
  "min_value" decimal(15, 4),
  "bank_name" text,
  "notes" text,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "rabc_refueling_abroad_idx" ON "refueling_abroad_bank_commissions" ("refueling_abroad_id");
CREATE INDEX IF NOT EXISTS "rabc_chain_position_idx" ON "refueling_abroad_bank_commissions" ("refueling_abroad_id", "chain_position");
