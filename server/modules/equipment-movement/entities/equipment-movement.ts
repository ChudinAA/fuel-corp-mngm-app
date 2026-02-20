import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  decimal,
  timestamp,
  uuid,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";
import { warehouses } from "../../warehouses/entities/warehouses";
import { equipments, equipmentTransactions } from "../../warehouses-equipment/entities/equipment";
import { bases } from "../../bases/entities/bases";

export const equipmentMovement = pgTable(
  "equipment_movement",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    movementDate: timestamp("movement_date", { mode: "string" }).notNull(),
    productType: text("product_type").notNull(),
    fromWarehouseId: uuid("from_warehouse_id").references(() => warehouses.id),
    toWarehouseId: uuid("to_warehouse_id").references(() => warehouses.id),
    fromEquipmentId: uuid("from_equipment_id").references(() => equipments.id),
    toEquipmentId: uuid("to_equipment_id").references(() => equipments.id),
    quantityKg: decimal("quantity_kg", { precision: 15, scale: 2 }).notNull(),
    quantityLiters: decimal("quantity_liters", { precision: 15, scale: 2 }),
    density: decimal("density", { precision: 6, scale: 4 }),
    inputMode: text("input_mode"),
    costPerKg: decimal("cost_per_kg", { precision: 19, scale: 5 }),
    totalCost: decimal("total_cost", { precision: 15, scale: 2 }),
    basis: text("basis"),
    basisId: uuid("basis_id").references(() => bases.id),
    transactionId: uuid("transaction_id").references(() => equipmentTransactions.id),
    sourceTransactionId: uuid("source_transaction_id").references(() => equipmentTransactions.id),
    isDraft: boolean("is_draft").default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
    deletedAt: timestamp("deleted_at", { mode: "string" }),
    deletedById: uuid("deleted_by_id").references(() => users.id),
  },
  (table) => ({
    movementDateIdx: index("eq_movement_date_idx").on(table.movementDate),
    fromWarehouseIdx: index("eq_movement_from_wh_idx").on(table.fromWarehouseId),
    toWarehouseIdx: index("eq_movement_to_wh_idx").on(table.toWarehouseId),
    fromEquipmentIdx: index("eq_movement_from_eq_idx").on(table.fromEquipmentId),
    toEquipmentIdx: index("eq_movement_to_eq_idx").on(table.toEquipmentId),
  }),
);

export const equipmentMovementRelations = relations(equipmentMovement, ({ one }) => ({
  fromWarehouse: one(warehouses, {
    fields: [equipmentMovement.fromWarehouseId],
    references: [warehouses.id],
    relationName: "fromWarehouseMovement",
  }),
  toWarehouse: one(warehouses, {
    fields: [equipmentMovement.toWarehouseId],
    references: [warehouses.id],
    relationName: "toWarehouseMovement",
  }),
  fromEquipment: one(equipments, {
    fields: [equipmentMovement.fromEquipmentId],
    references: [equipments.id],
    relationName: "fromEquipmentMovement",
  }),
  toEquipment: one(equipments, {
    fields: [equipmentMovement.toEquipmentId],
    references: [equipments.id],
    relationName: "toEquipmentMovement",
  }),
  basis: one(bases, {
    fields: [equipmentMovement.basisId],
    references: [bases.id],
  }),
  transaction: one(equipmentTransactions, {
    fields: [equipmentMovement.transactionId],
    references: [equipmentTransactions.id],
    relationName: "destinationEquipmentTransaction",
  }),
  sourceTransaction: one(equipmentTransactions, {
    fields: [equipmentMovement.sourceTransactionId],
    references: [equipmentTransactions.id],
    relationName: "sourceEquipmentTransaction",
  }),
  createdBy: one(users, {
    fields: [equipmentMovement.createdById],
    references: [users.id],
  }),
  updatedBy: one(users, {
    fields: [equipmentMovement.updatedById],
    references: [users.id],
  }),
}));

export const insertEquipmentMovementSchema = createInsertSchema(equipmentMovement).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedById: true,
});

export type EquipmentMovement = typeof equipmentMovement.$inferSelect;
export type InsertEquipmentMovement = z.infer<typeof insertEquipmentMovementSchema>;
