
-- Удаление полей из wholesale_suppliers
ALTER TABLE "wholesale_suppliers" DROP COLUMN IF EXISTS "inn";
ALTER TABLE "wholesale_suppliers" DROP COLUMN IF EXISTS "contract_number";

-- Удаление поля из wholesale_bases
ALTER TABLE "wholesale_bases" DROP COLUMN IF EXISTS "supplier_id";

-- Удаление полей из refueling_providers
ALTER TABLE "refueling_providers" DROP COLUMN IF EXISTS "icao_code";
ALTER TABLE "refueling_providers" DROP COLUMN IF EXISTS "iata_code";

-- Удаление поля из refueling_bases
ALTER TABLE "refueling_bases" DROP COLUMN IF EXISTS "provider_id";

-- Удаление таблицы refueling_services
DROP TABLE IF EXISTS "refueling_services";
