-- ЖД Станции
CREATE TABLE IF NOT EXISTS "railway_stations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "code" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp,
  "created_by_id" uuid REFERENCES "users"("id"),
  "updated_by_id" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp,
  "deleted_by_id" uuid REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "railway_stations_name_idx" ON "railway_stations" ("name");
CREATE INDEX IF NOT EXISTS "railway_stations_is_active_idx" ON "railway_stations" ("is_active");

-- Тарифы ЖД доставки
CREATE TABLE IF NOT EXISTS "railway_tariffs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "zone_name" text NOT NULL,
  "price_per_ton" decimal(15, 2) NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp,
  "created_by_id" uuid REFERENCES "users"("id"),
  "updated_by_id" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp,
  "deleted_by_id" uuid REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "railway_tariffs_zone_name_idx" ON "railway_tariffs" ("zone_name");
CREATE INDEX IF NOT EXISTS "railway_tariffs_is_active_idx" ON "railway_tariffs" ("is_active");

-- Сделки Биржи
CREATE TABLE IF NOT EXISTS "exchange_deals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "deal_number" text,
  "deal_date" date,
  "departure_station_id" uuid REFERENCES "railway_stations"("id"),
  "destination_station_id" uuid REFERENCES "railway_stations"("id"),
  "buyer_id" uuid REFERENCES "customers"("id"),
  "payment_date" date,
  "price_per_ton" decimal(15, 2),
  "weight_ton" decimal(15, 3),
  "actual_weight_ton" decimal(15, 3),
  "delivery_tariff_id" uuid REFERENCES "railway_tariffs"("id"),
  "wagon_departure_date" date,
  "planned_delivery_date" date,
  "seller_id" uuid REFERENCES "suppliers"("id"),
  "wagon_numbers" text,
  "is_draft" boolean DEFAULT false,
  "notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp,
  "created_by_id" uuid REFERENCES "users"("id"),
  "updated_by_id" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp,
  "deleted_by_id" uuid REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "exchange_deals_deal_date_idx" ON "exchange_deals" ("deal_date");
CREATE INDEX IF NOT EXISTS "exchange_deals_seller_id_idx" ON "exchange_deals" ("seller_id");
CREATE INDEX IF NOT EXISTS "exchange_deals_buyer_id_idx" ON "exchange_deals" ("buyer_id");
CREATE INDEX IF NOT EXISTS "exchange_deals_is_draft_idx" ON "exchange_deals" ("is_draft");
CREATE INDEX IF NOT EXISTS "exchange_deals_deleted_at_idx" ON "exchange_deals" ("deleted_at");

-- Карты авансов Биржи
CREATE TABLE IF NOT EXISTS "exchange_advance_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "seller_id" uuid NOT NULL REFERENCES "suppliers"("id"),
  "current_balance" decimal(15, 2) DEFAULT '0',
  "notes" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp,
  "created_by_id" uuid REFERENCES "users"("id"),
  "updated_by_id" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp,
  "deleted_by_id" uuid REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "exchange_advance_cards_seller_id_idx" ON "exchange_advance_cards" ("seller_id");
CREATE INDEX IF NOT EXISTS "exchange_advance_cards_is_active_idx" ON "exchange_advance_cards" ("is_active");

-- Транзакции карт авансов Биржи
CREATE TABLE IF NOT EXISTS "exchange_advance_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "card_id" uuid NOT NULL REFERENCES "exchange_advance_cards"("id"),
  "transaction_type" text NOT NULL,
  "amount" decimal(15, 2) NOT NULL,
  "balance_before" decimal(15, 2),
  "balance_after" decimal(15, 2),
  "related_deal_id" uuid,
  "description" text,
  "transaction_date" timestamp,
  "notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp,
  "created_by_id" uuid REFERENCES "users"("id"),
  "updated_by_id" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp,
  "deleted_by_id" uuid REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "exchange_advance_transactions_card_id_idx" ON "exchange_advance_transactions" ("card_id");
CREATE INDEX IF NOT EXISTS "exchange_advance_transactions_type_idx" ON "exchange_advance_transactions" ("transaction_type");
CREATE INDEX IF NOT EXISTS "exchange_advance_transactions_created_at_idx" ON "exchange_advance_transactions" ("created_at");
