-- Добавление связи места доставки с базисом
ALTER TABLE "logistics_delivery_locations" ADD COLUMN "base_id" UUID;

-- Добавление внешнего ключа
ALTER TABLE "logistics_delivery_locations" 
  ADD CONSTRAINT "logistics_delivery_locations_base_id_bases_id_fk" 
  FOREIGN KEY ("base_id") REFERENCES "bases"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Создание индекса для ускорения запросов
CREATE INDEX IF NOT EXISTS "logistics_delivery_locations_base_id_idx" ON "logistics_delivery_locations"("base_id");
