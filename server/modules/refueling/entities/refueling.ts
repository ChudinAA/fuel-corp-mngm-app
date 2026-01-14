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
import { suppliers } from "@shared/schema";
import { customers } from "@shared/schema";
import {
  warehouses,
  warehouseTransactions,
} from "../../warehouses/entities/warehouses";
import { prices } from "../../prices/entities/prices";

export const aircraftRefueling = pgTable("aircraft_refueling", {
  id: uuid("id").defaultRandom().primaryKey(),
  refuelingDate: timestamp("refueling_date", { mode: "string" }).notNull(),
  productType: text("product_type").notNull(),
  aircraftNumber: text("aircraft_number"),
  orderNumber: text("order_number"),
  supplierId: uuid("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  basis: text("basis"),
  buyerId: uuid("buyer_id")
    .notNull()
    .references(() => customers.id),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  transactionId: uuid("transaction_id").references(
    () => warehouseTransactions.id
  ),
  quantityLiters: decimal("quantity_liters", { precision: 15, scale: 2 }),
  density: decimal("density", { precision: 6, scale: 4 }),
  quantityKg: decimal("quantity_kg", { precision: 15, scale: 2 }).notNull(),
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 4 }),
  purchasePriceId: uuid("purchase_price_id").references(() => prices.id),
  purchasePriceIndex: integer("purchase_price_index").default(0),
  salePrice: decimal("sale_price", { precision: 12, scale: 4 }),
  salePriceId: uuid("sale_price_id").references(() => prices.id),
  salePriceIndex: integer("sale_price_index").default(0),
  purchaseAmount: decimal("purchase_amount", { precision: 15, scale: 2 }),
  saleAmount: decimal("sale_amount", { precision: 15, scale: 2 }),
  profit: decimal("profit", { precision: 15, scale: 2 }),
  contractNumber: text("contract_number"),
  notes: text("notes"),
  isApproxVolume: boolean("is_approx_volume").default(false),
  purchasePriceModified: boolean("purchase_price_modified").default(false),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  deletedById: uuid("deleted_by_id").references(() => users.id),
  isDraft: boolean("is_draft").default(false).notNull()
}, (table) => ({
  refuelingDateIdx: index("aircraft_refueling_date_idx").on(table.refuelingDate),
  createdAtIdx: index("aircraft_refueling_created_at_idx").on(table.createdAt),
  supplierBasisIdx: index("aircraft_refueling_supplier_basis_idx").on(table.supplierId, table.basis),
  buyerBasisIdx: index("aircraft_refueling_buyer_basis_idx").on(table.buyerId, table.basis),
  productTypeIdx: index("aircraft_refueling_product_type_idx").on(table.productType),
  warehouseIdx: index("aircraft_refueling_warehouse_idx").on(table.warehouseId),
}));

// ============ RELATIONS ============

export const aircraftRefuelingRelations = relations(
  aircraftRefueling,
  ({ one }) => ({
    supplier: one(suppliers, {
      fields: [aircraftRefueling.supplierId],
      references: [suppliers.id],
    }),
    buyer: one(customers, {
      fields: [aircraftRefueling.buyerId],
      references: [customers.id],
    }),
    warehouse: one(warehouses, {
      fields: [aircraftRefueling.warehouseId],
      references: [warehouses.id],
    }),
    transaction: one(warehouseTransactions, {
      fields: [aircraftRefueling.transactionId],
      references: [warehouseTransactions.id],
    }),
    purchasePrice: one(prices, {
      fields: [aircraftRefueling.purchasePriceId],
      references: [prices.id],
    }),
    salePrice: one(prices, {
      fields: [aircraftRefueling.salePriceId],
      references: [prices.id],
    }),
    createdBy: one(users, {
      fields: [aircraftRefueling.createdById],
      references: [users.id],
    }),
    updatedBy: one(users, {
      fields: [aircraftRefueling.updatedById],
      references: [users.id],
    }),
  })
);

// ============ INSERT SCHEMAS ============

export const insertAircraftRefuelingSchema = createInsertSchema(
  aircraftRefueling
)
  .omit({ id: true, createdAt: true })
  .extend({
    refuelingDate: z.string(), // timestamp as string
  });

// ============ TYPES ============

export type AircraftRefueling = typeof aircraftRefueling.$inferSelect;
export type InsertAircraftRefueling = z.infer<
  typeof insertAircraftRefuelingSchema
>;

// Product types for refueling
export const PRODUCT_TYPES = [
  { value: "kerosene", label: "Керосин" },
  { value: "pvkj", label: "ПВКЖ" },
  { value: "service", label: "Услуга" },
  { value: "storage", label: "Хранение" },
  { value: "agent", label: "Агентские" },
] as const;
