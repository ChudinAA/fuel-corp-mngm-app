ALTER TABLE "warehouses" ALTER COLUMN "storage_cost" TYPE numeric(15,6);
ALTER TABLE "suppliers" ALTER COLUMN "storage_cost" TYPE numeric(15,6);
ALTER TABLE "delivery_cost" ALTER COLUMN "cost_per_kg" TYPE numeric(15,6);
