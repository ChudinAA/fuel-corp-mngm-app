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
import { suppliers } from "../../../schemas/suppliers";
import { customers } from "./customers";
import {
  warehouses,
  warehouseTransactions,
} from "../../warehouses/entities/warehouses";
import {
  logisticsCarriers,
  logisticsDeliveryLocations,
} from "../../logistics/entities/logistics";
import { prices } from "../../prices/entities/prices";

export const opt = pgTable("opt", {
  id: uuid("id").defaultRandom().primaryKey(),
  supplierId: uuid("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  buyerId: uuid("buyer_id")
    .notNull()
    .references(() => customers.id),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  transactionId: uuid("transaction_id").references(
    () => warehouseTransactions.id
  ),
  dealDate: timestamp("deal_date", { mode: "string" }).notNull(),
  basis: text("basis"),
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
  carrierId: uuid("carrier_id").references(() => logisticsCarriers.id),
  deliveryLocationId: uuid("delivery_location_id").references(
    () => logisticsDeliveryLocations.id
  ),
  deliveryTariff: decimal("delivery_tariff", { precision: 12, scale: 4 }),
  deliveryCost: decimal("delivery_cost", { precision: 15, scale: 2 }),
  profit: decimal("profit", { precision: 15, scale: 2 }),
  contractNumber: text("contract_number"),
  notes: text("notes"),
  isApproxVolume: boolean("is_approx_volume").default(false),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// ============ RELATIONS ============

export const optRelations = relations(opt, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [opt.supplierId],
    references: [suppliers.id],
  }),
  buyer: one(customers, { fields: [opt.buyerId], references: [customers.id] }),
  warehouse: one(warehouses, {
    fields: [opt.warehouseId],
    references: [warehouses.id],
  }),
  transaction: one(warehouseTransactions, {
    fields: [opt.transactionId],
    references: [warehouseTransactions.id],
  }),
  carrier: one(logisticsCarriers, {
    fields: [opt.carrierId],
    references: [logisticsCarriers.id],
  }),
  deliveryLocation: one(logisticsDeliveryLocations, {
    fields: [opt.deliveryLocationId],
    references: [logisticsDeliveryLocations.id],
  }),
  purchasePrice: one(prices, {
    fields: [opt.purchasePriceId],
    references: [prices.id],
  }),
  salePrice: one(prices, {
    fields: [opt.salePriceId],
    references: [prices.id],
  }),
  createdBy: one(users, { fields: [opt.createdById], references: [users.id] }),
  updatedBy: one(users, { fields: [opt.updatedById], references: [users.id] }),
}));

// ============ INSERT SCHEMAS ============

export const insertOptSchema = z.object({
  supplierId: z.string(),
  buyerId: z.string(),
  warehouseId: z.string().nullable().optional(),
  basis: z.string().nullable().optional(),
  dealDate: z.string(),
  quantityLiters: z.number().nullable().optional(),
  density: z.number().nullable().optional(),
  quantityKg: z.number(),
  purchasePrice: z.number().nullable().optional(),
  purchasePriceId: z.string().nullable().optional(),
  salePrice: z.number().nullable().optional(),
  salePriceId: z.string().nullable().optional(),
  purchaseAmount: z.number().nullable().optional(),
  saleAmount: z.number().nullable().optional(),
  carrierId: z.string().nullable().optional(),
  deliveryLocationId: z.string().nullable().optional(),
  deliveryTariff: z.number().nullable().optional(),
  deliveryCost: z.number().nullable().optional(),
  profit: z.number().nullable().optional(),
  contractNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isApproxVolume: z.boolean().optional(),
  createdById: z.string().nullable().optional(),
  updatedById: z.string().nullable().optional(),
});

// ============ TYPES ============

export type Opt = typeof opt.$inferSelect;
export type InsertOpt = z.infer<typeof insertOptSchema>;
