CREATE TABLE IF NOT EXISTS "user_warehouse_access" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now(),
  "created_by_id" uuid REFERENCES "users"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_warehouse_access_user_warehouse_idx" ON "user_warehouse_access" ("user_id", "warehouse_id");
CREATE INDEX IF NOT EXISTS "user_warehouse_access_user_idx" ON "user_warehouse_access" ("user_id");
CREATE INDEX IF NOT EXISTS "user_warehouse_access_warehouse_idx" ON "user_warehouse_access" ("warehouse_id");
