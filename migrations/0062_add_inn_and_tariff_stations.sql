-- Add INN field to suppliers
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "inn" text;

-- Add station pair fields to railway_tariffs
ALTER TABLE "railway_tariffs" ADD COLUMN IF NOT EXISTS "departure_station_id" uuid REFERENCES "railway_stations"("id");
ALTER TABLE "railway_tariffs" ADD COLUMN IF NOT EXISTS "destination_station_id" uuid REFERENCES "railway_stations"("id");

-- Make zone_name optional (allow null for new records using station pairs)
ALTER TABLE "railway_tariffs" ALTER COLUMN "zone_name" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "railway_tariffs_departure_station_idx" ON "railway_tariffs" ("departure_station_id");
CREATE INDEX IF NOT EXISTS "railway_tariffs_destination_station_idx" ON "railway_tariffs" ("destination_station_id");
