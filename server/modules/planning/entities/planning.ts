import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  decimal,
  boolean,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";
import { warehouses } from "../../warehouses/entities/warehouses";

// ============ PLAN ENTRIES ============
// Planned income (from supplier) or expense (to customer) for a warehouse on a given date

export const planEntries = pgTable(
  "plan_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    date: timestamp("date", { mode: "string" }).notNull(),
    type: text("type").notNull(), // 'income' | 'expense'
    counterpartyId: uuid("counterparty_id"), // supplier (income) or customer (expense)
    volume: decimal("volume", { precision: 15, scale: 2 }).notNull(),
    balanceAfter: decimal("balance_after", { precision: 15, scale: 2 }),
    isManualBalance: boolean("is_manual_balance").default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
    deletedAt: timestamp("deleted_at", { mode: "string" }),
    deletedById: uuid("deleted_by_id").references(() => users.id),
  },
  (table) => ({
    warehouseIdx: index("plan_entries_warehouse_idx").on(table.warehouseId),
    dateIdx: index("plan_entries_date_idx").on(table.date),
    warehouseDateIdx: index("plan_entries_warehouse_date_idx").on(
      table.warehouseId,
      table.date,
    ),
  }),
);

export const planEntriesRelations = relations(planEntries, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [planEntries.warehouseId],
    references: [warehouses.id],
  }),
  createdBy: one(users, {
    fields: [planEntries.createdById],
    references: [users.id],
    relationName: "planEntryCreatedBy",
  }),
  updatedBy: one(users, {
    fields: [planEntries.updatedById],
    references: [users.id],
    relationName: "planEntryUpdatedBy",
  }),
}));

export const insertPlanEntrySchema = createInsertSchema(planEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedById: true,
});

export type PlanEntry = typeof planEntries.$inferSelect;
export type InsertPlanEntry = z.infer<typeof insertPlanEntrySchema>;

// ============ FREE VOLUME ALLOCATIONS ============
// Reallocation of free volume within/across counterparties for a warehouse

export const freeVolumeAllocations = pgTable(
  "free_volume_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    date: timestamp("date", { mode: "string" }).notNull(),
    fromCounterpartyId: uuid("from_counterparty_id"),
    toCounterpartyId: uuid("to_counterparty_id"),
    volume: decimal("volume", { precision: 15, scale: 2 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
    deletedAt: timestamp("deleted_at", { mode: "string" }),
    deletedById: uuid("deleted_by_id").references(() => users.id),
  },
  (table) => ({
    warehouseIdx: index("free_volume_allocations_warehouse_idx").on(
      table.warehouseId,
    ),
    dateIdx: index("free_volume_allocations_date_idx").on(table.date),
  }),
);

export const freeVolumeAllocationsRelations = relations(
  freeVolumeAllocations,
  ({ one }) => ({
    warehouse: one(warehouses, {
      fields: [freeVolumeAllocations.warehouseId],
      references: [warehouses.id],
    }),
    createdBy: one(users, {
      fields: [freeVolumeAllocations.createdById],
      references: [users.id],
      relationName: "freeVolumeAllocationCreatedBy",
    }),
  }),
);

export const insertFreeVolumeAllocationSchema = createInsertSchema(
  freeVolumeAllocations,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedById: true,
});

export type FreeVolumeAllocation = typeof freeVolumeAllocations.$inferSelect;
export type InsertFreeVolumeAllocation = z.infer<
  typeof insertFreeVolumeAllocationSchema
>;

// ============ SUPPLIER ALLOCATED VOLUMES ============
// Admin/manager-defined supply limit per supplier for a period

export const supplierAllocatedVolumes = pgTable(
  "supplier_allocated_volumes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierId: uuid("supplier_id").notNull(),
    periodFrom: timestamp("period_from", { mode: "string" }).notNull(),
    periodTo: timestamp("period_to", { mode: "string" }).notNull(),
    volume: decimal("volume", { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
    deletedAt: timestamp("deleted_at", { mode: "string" }),
    deletedById: uuid("deleted_by_id").references(() => users.id),
  },
  (table) => ({
    supplierIdx: index("supplier_allocated_volumes_supplier_idx").on(
      table.supplierId,
    ),
    periodIdx: index("supplier_allocated_volumes_period_idx").on(
      table.periodFrom,
      table.periodTo,
    ),
  }),
);

export const insertSupplierAllocatedVolumeSchema = createInsertSchema(
  supplierAllocatedVolumes,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedById: true,
});

export type SupplierAllocatedVolume =
  typeof supplierAllocatedVolumes.$inferSelect;
export type InsertSupplierAllocatedVolume = z.infer<
  typeof insertSupplierAllocatedVolumeSchema
>;
