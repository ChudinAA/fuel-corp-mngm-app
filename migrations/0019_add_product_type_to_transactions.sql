
-- Add product_type to warehouse_transactions
ALTER TABLE "warehouse_transactions" ADD COLUMN "product_type" text DEFAULT 'kerosene';
