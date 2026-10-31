import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const integrationApiKeys = pgTable(
  "integration_api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    integration: text("integration").notNull().default("1c"),
    label: text("label").notNull().default("1С"),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
    createdById: uuid("created_by_id"),
    revokedAt: timestamp("revoked_at", { mode: "string" }),
    revokedById: uuid("revoked_by_id"),
  },
  (table) => ({
    integrationIdx: index("integration_api_keys_integration_idx").on(table.integration),
    oneActiveKeyPerIntegration: uniqueIndex("integration_api_keys_one_active_per_integration")
      .on(table.integration)
      .where(sql`${table.revokedAt} IS NULL`),
  }),
);

export const integrationSettings = pgTable("integration_settings", {
  id: integer("id").primaryKey().default(1),
  counterpartyMasterDataEnabled: boolean("counterparty_master_data_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
  updatedById: uuid("updated_by_id"),
});

export const integrationRequestLogs = pgTable(
  "integration_request_logs",
  {
    id: serial("id").primaryKey(),
    integration: text("integration").notNull().default("1c"),
    requestId: uuid("request_id").notNull(),
    apiKeyId: uuid("api_key_id"),
    method: text("method").notNull(),
    path: text("path").notNull(),
    statusCode: integer("status_code").notNull(),
    durationMs: integer("duration_ms").notNull(),
    itemCount: integer("item_count"),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    createdIdx: index("integration_request_logs_created_idx").on(table.createdAt),
    requestIdx: index("integration_request_logs_request_idx").on(table.requestId),
  }),
);

export const integrationChangeLogs = pgTable(
  "integration_change_logs",
  {
    id: serial("id").primaryKey(),
    integration: text("integration").notNull().default("1c"),
    requestId: uuid("request_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    external1cId: text("id_1c").notNull(),
    operation: text("operation").notNull(),
    outcome: text("outcome").notNull(),
    incomingData: jsonb("incoming_data"),
    oldData: jsonb("old_data"),
    newData: jsonb("new_data"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    reviewedAt: timestamp("reviewed_at", { mode: "string" }),
    reviewedById: uuid("reviewed_by_id"),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    requestIdx: index("integration_change_logs_request_idx").on(table.requestId),
    reviewIdx: index("integration_change_logs_review_idx").on(table.reviewedAt, table.createdAt),
    entityIdx: index("integration_change_logs_entity_idx").on(table.entityType, table.entityId),
  }),
);
