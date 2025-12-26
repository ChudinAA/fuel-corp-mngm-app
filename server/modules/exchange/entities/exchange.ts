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
import { warehouses } from "../../warehouses/entities/warehouses";

export const exchange = pgTable("exchange", {
  id: uuid("id").defaultRandom().primaryKey(),
  dealDate: timestamp("deal_date", { mode: "string" }).notNull(),
  dealNumber: text("deal_number"),
  counterparty: text("counterparty").notNull(),
  productType: text("product_type").notNull(),
  quantityKg: decimal("quantity_kg", { precision: 15, scale: 2 }).notNull(),
  pricePerKg: decimal("price_per_kg", { precision: 12, scale: 4 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
}, (table) => ({
  dealDateIdx: index("exchange_deal_date_idx").on(table.dealDate),
  warehouseIdx: index("exchange_warehouse_idx").on(table.warehouseId),
  productTypeIdx: index("exchange_product_type_idx").on(table.productType),
}));

// ============ RELATIONS ============

export const exchangeRelations = relations(exchange, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [exchange.warehouseId],
    references: [warehouses.id],
  }),
  createdBy: one(users, {
    fields: [exchange.createdById],
    references: [users.id],
  }),
  updatedBy: one(users, {
    fields: [exchange.updatedById],
    references: [users.id],
  }),
}));

// ============ INSERT SCHEMAS ============

export const insertExchangeSchema = createInsertSchema(exchange)
  .omit({ id: true, createdAt: true })
  .extend({
    dealDate: z.string(),
  });

// ============ TYPES ============

export type Exchange = typeof exchange.$inferSelect;
export type InsertExchange = z.infer<typeof insertExchangeSchema>;
