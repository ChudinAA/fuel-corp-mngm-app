ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "limit_type" text DEFAULT 'volume';
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "max_deal_amount" numeric(15, 2);

ALTER TABLE "supplier_basis_prices" ADD COLUMN IF NOT EXISTS "other_service_type" text;
ALTER TABLE "supplier_basis_prices" ADD COLUMN IF NOT EXISTS "other_service_value" numeric(15, 6);
