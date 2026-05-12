-- Increase decimal scale from 4/5 to 6 for all price and cost columns
-- warehouses
ALTER TABLE "warehouses" ALTER COLUMN "average_cost" TYPE numeric(15,6);
ALTER TABLE "warehouses" ALTER COLUMN "pvkj_average_cost" TYPE numeric(15,6);

-- warehouse_transactions
ALTER TABLE "warehouse_transactions" ALTER COLUMN "average_cost_before" TYPE numeric(15,6);
ALTER TABLE "warehouse_transactions" ALTER COLUMN "average_cost_after" TYPE numeric(15,6);
ALTER TABLE "warehouse_transactions" ALTER COLUMN "price" TYPE numeric(15,6);

-- storage_cards
ALTER TABLE "storage_cards" ALTER COLUMN "average_cost" TYPE numeric(15,6);

-- storage_card_transactions
ALTER TABLE "storage_card_transactions" ALTER COLUMN "price" TYPE numeric(15,6);
ALTER TABLE "storage_card_transactions" ALTER COLUMN "average_cost_before" TYPE numeric(15,6);
ALTER TABLE "storage_card_transactions" ALTER COLUMN "average_cost_after" TYPE numeric(15,6);

-- movement
ALTER TABLE "movement" ALTER COLUMN "purchase_price" TYPE numeric(19,6);
ALTER TABLE "movement" ALTER COLUMN "delivery_price" TYPE numeric(19,6);
ALTER TABLE "movement" ALTER COLUMN "cost_per_kg" TYPE numeric(19,6);

-- opt
ALTER TABLE "opt" ALTER COLUMN "purchase_price" TYPE numeric(19,6);
ALTER TABLE "opt" ALTER COLUMN "sale_price" TYPE numeric(19,6);
ALTER TABLE "opt" ALTER COLUMN "delivery_tariff" TYPE numeric(19,6);

-- aircraft_refueling
ALTER TABLE "aircraft_refueling" ALTER COLUMN "purchase_price" TYPE numeric(19,6);
ALTER TABLE "aircraft_refueling" ALTER COLUMN "sale_price" TYPE numeric(19,6);

-- transportation
ALTER TABLE "transportation" ALTER COLUMN "purchase_price" TYPE numeric(19,6);
ALTER TABLE "transportation" ALTER COLUMN "sale_price" TYPE numeric(19,6);
ALTER TABLE "transportation" ALTER COLUMN "delivery_tariff" TYPE numeric(19,6);

-- equipment_movement
ALTER TABLE "equipment_movement" ALTER COLUMN "cost_per_kg" TYPE numeric(19,6);

-- refueling_abroad
ALTER TABLE "refueling_abroad" ALTER COLUMN "intermediary_commission_usd" TYPE numeric(15,6);
ALTER TABLE "refueling_abroad" ALTER COLUMN "exchange_rate_value" TYPE numeric(15,6);
ALTER TABLE "refueling_abroad" ALTER COLUMN "purchase_exchange_rate_value" TYPE numeric(15,6);
ALTER TABLE "refueling_abroad" ALTER COLUMN "sale_exchange_rate_value" TYPE numeric(15,6);
ALTER TABLE "refueling_abroad" ALTER COLUMN "purchase_price_usd" TYPE numeric(15,6);
ALTER TABLE "refueling_abroad" ALTER COLUMN "purchase_price_rub" TYPE numeric(15,6);
ALTER TABLE "refueling_abroad" ALTER COLUMN "sale_price_usd" TYPE numeric(15,6);
ALTER TABLE "refueling_abroad" ALTER COLUMN "sale_price_rub" TYPE numeric(15,6);
ALTER TABLE "refueling_abroad" ALTER COLUMN "bank_commission_usd" TYPE numeric(15,6);
ALTER TABLE "refueling_abroad" ALTER COLUMN "bank_commission_rub" TYPE numeric(15,6);
