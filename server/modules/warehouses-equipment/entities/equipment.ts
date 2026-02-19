import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  decimal,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";
import { warehouses } from "../../warehouses/entities/warehouses";

export const equipments = pgTable(
  "equipments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    currentBalance: decimal("current_balance", {
      precision: 15,
      scale: 2,
    }).default("0"),
    averageCost: decimal("average_cost", { precision: 12, scale: 4 }).default("0"),
    isActive: text("is_active").default("true"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
  },
  (table) => ({
    nameIdx: index("equipments_name_idx").on(table.name),
  }),
);

export const equipmentTransactions = pgTable(
  "equipment_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipments.id),
    transactionType: text("transaction_type").notNull(), // income, expense
    quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull(),
    balanceBefore: decimal("balance_before", { precision: 15, scale: 2 }),
    balanceAfter: decimal("balance_after", { precision: 15, scale: 2 }),
    averageCostBefore: decimal("average_cost_before", { precision: 12, scale: 4 }),
    averageCostAfter: decimal("average_cost_after", { precision: 12, scale: 4 }),
    transactionDate: timestamp("transaction_date", { mode: "string" }),
    sourceWarehouseId: uuid("source_warehouse_id").references(() => warehouses.id),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    createdById: uuid("created_by_id").references(() => users.id),
  },
  (table) => ({
    equipmentIdx: index("equipment_transactions_equipment_id_idx").on(table.equipmentId),
    dateIdx: index("equipment_transactions_date_idx").on(table.transactionDate),
  }),
);

export const warehousesEquipment = pgTable(
  "warehouses_equipment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipments.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => ({
    uniqueWarehouseEquipment: index("unique_warehouse_equipment_idx").on(
      table.warehouseId,
      table.equipmentId,
    ),
  }),
);

export const equipmentsRelations = relations(equipments, ({ many, one }) => ({
  transactions: many(equipmentTransactions),
  warehouses: many(warehousesEquipment),
  createdBy: one(users, {
    fields: [equipments.createdById],
    references: [users.id],
  }),
}));

export const equipmentTransactionsRelations = relations(equipmentTransactions, ({ one }) => ({
  equipment: one(equipments, {
    fields: [equipmentTransactions.equipmentId],
    references: [equipments.id],
  }),
  sourceWarehouse: one(warehouses, {
    fields: [equipmentTransactions.sourceWarehouseId],
    references: [warehouses.id],
  }),
  createdBy: one(users, {
    fields: [equipmentTransactions.createdById],
    references: [users.id],
  }),
}));

export const warehousesEquipmentRelations = relations(warehousesEquipment, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [warehousesEquipment.warehouseId],
    references: [warehouses.id],
  }),
  equipment: one(equipments, {
    fields: [warehousesEquipment.equipmentId],
    references: [equipments.id],
  }),
}));

export const insertEquipmentSchema = createInsertSchema(equipments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEquipmentTransactionSchema = createInsertSchema(equipmentTransactions).omit({ id: true, createdAt: true });

export type Equipment = typeof equipments.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type EquipmentTransaction = typeof equipmentTransactions.$inferSelect;
export type InsertEquipmentTransaction = z.infer<typeof insertEquipmentTransactionSchema>;
