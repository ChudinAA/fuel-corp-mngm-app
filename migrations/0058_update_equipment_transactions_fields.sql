ALTER TABLE "equipment_transactions" 
ADD COLUMN IF NOT EXISTS "product_type" text NOT NULL DEFAULT 'kerosene',
ADD COLUMN IF NOT EXISTS "source_type" text,
ADD COLUMN IF NOT EXISTS "source_id" uuid;
