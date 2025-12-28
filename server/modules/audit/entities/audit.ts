
import { pgTable, text, uuid, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";
import { relations } from "drizzle-orm";

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  operation: text("operation").notNull(), // 'CREATE', 'UPDATE', 'DELETE', 'RESTORE'
  oldData: jsonb("old_data"),
  newData: jsonb("new_data"),
  changedFields: text("changed_fields").array(),
  userId: uuid("user_id").references(() => users.id),
  userName: text("user_name"),
  userEmail: text("user_email"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  rolledBackAt: timestamp("rolled_back_at", { mode: "string" }),
  rolledBackById: uuid("rolled_back_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => ({
  entityIdx: index("audit_log_entity_idx").on(table.entityType, table.entityId),
  createdAtIdx: index("audit_log_created_at_idx").on(table.createdAt),
  userIdx: index("audit_log_user_idx").on(table.userId),
  operationIdx: index("audit_log_operation_idx").on(table.operation),
  entityCreatedIdx: index("audit_log_entity_created_idx").on(table.entityType, table.entityId, table.createdAt),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id],
  }),
}));

// Schema for inserting audit log entries
export const insertAuditLogSchema = createInsertSchema(auditLog).omit({
  id: true,
  createdAt: true,
});

// Types
export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// Audit operation types
export const AUDIT_OPERATIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  RESTORE: 'RESTORE',
  VIEW: 'VIEW',
} as const;

export type AuditOperation = typeof AUDIT_OPERATIONS[keyof typeof AUDIT_OPERATIONS];

// Entity types for audit
export const ENTITY_TYPES = {
  OPT: 'opt',
  AIRCRAFT_REFUELING: 'aircraft_refueling',
  MOVEMENT: 'movement',
  EXCHANGE: 'exchange',
  WAREHOUSE: 'warehouses',
  PRICE: 'prices',
  SUPPLIER: 'suppliers',
  CUSTOMER: 'customers',
  BASE: 'bases',
  LOGISTICS_CARRIER: 'logistics_carriers',
  LOGISTICS_DELIVERY_LOCATION: 'logistics_delivery_locations',
  LOGISTICS_VEHICLE: 'logistics_vehicles',
  LOGISTICS_TRAILER: 'logistics_trailers',
  LOGISTICS_DRIVER: 'logistics_drivers',
  DELIVERY_COST: 'delivery_cost',
  USER: 'users',
  ROLE: 'roles',
} as const;

export type EntityType = typeof ENTITY_TYPES[keyof typeof ENTITY_TYPES];
