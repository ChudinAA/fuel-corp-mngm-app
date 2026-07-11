-- Planning resources: user-managed list of suppliers for planning
CREATE TABLE IF NOT EXISTS "planning_resources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "supplier_id" uuid NOT NULL REFERENCES "suppliers"("id"),
  "notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp,
  "created_by_id" uuid REFERENCES "users"("id"),
  "updated_by_id" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp,
  "deleted_by_id" uuid REFERENCES "users"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "planning_resources_supplier_idx" ON "planning_resources" ("supplier_id") WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS "planning_resources_deleted_idx" ON "planning_resources" ("deleted_at");

-- Planning settings: global flags (e.g. edit lock)
CREATE TABLE IF NOT EXISTS "planning_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL UNIQUE,
  "value" text NOT NULL,
  "updated_at" timestamp DEFAULT now(),
  "updated_by_id" uuid REFERENCES "users"("id")
);

INSERT INTO "planning_settings" ("key", "value") VALUES ('editLockEnabled', 'false') ON CONFLICT ("key") DO NOTHING;

-- Planning comments: field-level comments with optional high priority
CREATE TABLE IF NOT EXISTS "planning_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "field_key" text NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "text" text NOT NULL,
  "is_high_priority" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "planning_comments_entity_idx" ON "planning_comments" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "planning_comments_field_idx" ON "planning_comments" ("entity_type", "entity_id", "field_key");
