
-- Удаление старых полей
ALTER TABLE "delivery_cost" DROP COLUMN IF EXISTS "effective_date";
ALTER TABLE "delivery_cost" DROP COLUMN IF EXISTS "cost_per_trip";
ALTER TABLE "delivery_cost" DROP COLUMN IF EXISTS "basis";
ALTER TABLE "delivery_cost" DROP COLUMN IF EXISTS "delivery_location_id";
ALTER TABLE "delivery_cost" DROP COLUMN IF EXISTS "tariff";

-- Добавление новых полей
ALTER TABLE "delivery_cost" ADD COLUMN IF NOT EXISTS "from_location" text NOT NULL DEFAULT '';
ALTER TABLE "delivery_cost" ADD COLUMN IF NOT EXISTS "to_location" text NOT NULL DEFAULT '';
ALTER TABLE "delivery_cost" ADD COLUMN IF NOT EXISTS "cost_per_kg" numeric(12, 4) NOT NULL DEFAULT 0;
ALTER TABLE "delivery_cost" ADD COLUMN IF NOT EXISTS "distance" numeric(10, 2);

-- Удаление дефолтных значений после добавления
ALTER TABLE "delivery_cost" ALTER COLUMN "from_location" DROP DEFAULT;
ALTER TABLE "delivery_cost" ALTER COLUMN "to_location" DROP DEFAULT;
ALTER TABLE "delivery_cost" ALTER COLUMN "cost_per_kg" DROP DEFAULT;
