
-- Add PVKJ balance and cost fields to warehouses
ALTER TABLE "warehouses" ADD COLUMN "pvkj_balance" numeric(15, 2) DEFAULT '0';
ALTER TABLE "warehouses" ADD COLUMN "pvkj_average_cost" numeric(12, 4) DEFAULT '0';
