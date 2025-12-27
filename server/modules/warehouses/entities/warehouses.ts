import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  decimal,
  date,
  boolean,
  timestamp,
  jsonb,
  serial,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";
import { suppliers } from "../../suppliers/entities/suppliers";
import { opt } from "../../opt/entities/opt";
import { aircraftRefueling } from "../../refueling/entities/refueling";
import { movement } from "../../movement/entities/movement";
import { exchange } from "../../exchange/entities/exchange";
import { bases } from "../../bases/entities/bases";

export const warehouses = pgTable("warehouses", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  supplierId: uuid("supplier_id"), // Link to auto-created supplier
  currentBalance: decimal("current_balance", {
    precision: 15,
    scale: 2,
  }).default("0"),
  averageCost: decimal("average_cost", { precision: 12, scale: 4 }).default(
    "0"
  ),
  pvkjBalance: decimal("pvkj_balance", { precision: 15, scale: 2 }).default(
    "0"
  ),
  pvkjAverageCost: decimal("pvkj_average_cost", {
    precision: 12,
    scale: 4,
  }).default("0"),
  storageCost: decimal("storage_cost", { precision: 12, scale: 2 }), // Moved from logistics
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  deletedById: uuid("deleted_by_id").references(() => users.id),
}, (table) => ({
  nameIdx: index("warehouses_name_idx").on(table.name),
  isActiveIdx: index("warehouses_is_active_idx").on(table.isActive),
  supplierIdx: index("warehouses_supplier_idx").on(table.supplierId),
}));

// Junction table for warehouse-base many-to-many relationship
export const warehouseBases = pgTable(
  "warehouse_bases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    baseId: uuid("base_id")
      .notNull()
      .references(() => bases.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => ({
    // Composite unique constraint to prevent duplicate warehouse-base pairs
    uniqueWarehouseBase: index("unique_warehouse_base_idx").on(
      table.warehouseId,
      table.baseId
    ),
  })
);

export const warehouseTransactions = pgTable("warehouse_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  transactionType: text("transaction_type").notNull(),
  productType: text("product_type").default("kerosene"),
  quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull(),
  sourceType: text("source_type"),
  sourceId: uuid("source_id"),
  balanceBefore: decimal("balance_before", { precision: 15, scale: 2 }),
  balanceAfter: decimal("balance_after", { precision: 15, scale: 2 }),
  averageCostBefore: decimal("average_cost_before", {
    precision: 12,
    scale: 4,
  }),
  averageCostAfter: decimal("average_cost_after", { precision: 12, scale: 4 }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
}, (table) => ({
  warehouseIdIdx: index("warehouse_transactions_warehouse_id_idx").on(table.warehouseId),
  createdAtIdx: index("warehouse_transactions_created_at_idx").on(table.createdAt),
  sourceIdx: index("warehouse_transactions_source_idx").on(table.sourceType, table.sourceId),
  warehouseProductIdx: index("warehouse_transactions_warehouse_product_idx").on(table.warehouseId, table.productType),
  warehouseDateIdx: index("warehouse_transactions_warehouse_date_idx").on(table.warehouseId, table.createdAt),
}));

export const warehousesRelations = relations(warehouses, ({ many, one }) => ({
  transactions: many(warehouseTransactions),
  supplier: one(suppliers, {
    fields: [warehouses.supplierId],
    references: [suppliers.id],
  }),
  warehouseBases: many(warehouseBases),
  optDeals: many(opt),
  refuelings: many(aircraftRefueling),
  movementsFrom: many(movement, { relationName: "fromWarehouse" }),
  movementsTo: many(movement, { relationName: "toWarehouse" }),
  exchangeDeals: many(exchange),
  createdBy: one(users, {
    fields: [warehouses.createdById],
    references: [users.id],
    relationName: "warehouseCreatedBy",
  }),
  updatedBy: one(users, {
    fields: [warehouses.updatedById],
    references: [users.id],
    relationName: "warehouseUpdatedBy",
  }),
}));

export const warehouseBasesRelations = relations(warehouseBases, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [warehouseBases.warehouseId],
    references: [warehouses.id],
  }),
  base: one(bases, { fields: [warehouseBases.baseId], references: [bases.id] }),
}));

export const warehouseTransactionsRelations = relations(
  warehouseTransactions,
  ({ one }) => ({
    warehouse: one(warehouses, {
      fields: [warehouseTransactions.warehouseId],
      references: [warehouses.id],
    }),
    createdBy: one(users, {
      fields: [warehouseTransactions.createdById],
      references: [users.id],
      relationName: "warehouseTransactionCreatedBy",
    }),
    updatedBy: one(users, {
      fields: [warehouseTransactions.updatedById],
      references: [users.id],
      relationName: "warehouseTransactionUpdatedBy",
    }),
  })
);

// ============ INSERT SCHEMAS ============

export const insertWarehouseSchema = z.object({
  name: z.string().min(1),
  supplierId: z.string().uuid().optional().nullable(),
  storageCost: z.string().optional().nullable(),
  pvkjBalance: z.string().optional().nullable(),
  pvkjAverageCost: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  createdById: z.string().uuid(),
  baseIds: z.array(z.string().uuid()).optional(),
});

export const insertWarehouseTransactionSchema = createInsertSchema(
  warehouseTransactions
).omit({ id: true });

// ============ TYPES ============

export type Warehouse = typeof warehouses.$inferSelect & {
  baseIds?: string[];
};
export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;

export type WarehouseTransaction = typeof warehouseTransactions.$inferSelect;
export type InsertWarehouseTransaction = z.infer<
  typeof insertWarehouseTransactionSchema
>;

export type WarehouseBase = typeof warehouseBases.$inferSelect;