CREATE TABLE IF NOT EXISTS "recalculation_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "warehouse_id" uuid NOT NULL,
  "product_type" text DEFAULT 'kerosene' NOT NULL,
  "after_date" timestamp NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "priority" integer DEFAULT 0,
  "attempts" integer DEFAULT 0,
  "error_message" text,
  "processing_started_at" timestamp,
  "processed_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "created_by_id" uuid
);

CREATE INDEX IF NOT EXISTS "recalculation_queue_warehouse_product_idx" ON "recalculation_queue" ("warehouse_id", "product_type");

DO $$ BEGIN
 ALTER TABLE "recalculation_queue" ADD CONSTRAINT "recalculation_queue_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "recalculation_queue" ADD CONSTRAINT "recalculation_queue_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;