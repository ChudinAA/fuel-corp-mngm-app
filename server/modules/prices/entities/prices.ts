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
import { opt } from "../../opt/entities/opt";
import { aircraftRefueling } from "../../refueling/entities/refueling";
import { bases, currencies, exchangeRates } from "@shared/schema";

export const prices = pgTable(
  "prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productType: text("product_type").notNull(),
    counterpartyId: uuid("counterparty_id").notNull(),
    counterpartyType: text("counterparty_type").notNull(),
    counterpartyRole: text("counterparty_role").notNull(),
    basis: text("basis").notNull(),
    basisId: uuid("basis_id").references(() => bases.id),
    priceValues: text("price_values").array(),
    volume: decimal("volume", { precision: 15, scale: 2 }),
    dateFrom: date("date_from").notNull(),
    dateTo: date("date_to").notNull(),
    contractNumber: text("contract_number"),
    contractAppendix: text("contract_appendix"),
    notes: text("notes"),
    soldVolume: decimal("sold_volume", { precision: 15, scale: 2 }).default(
      "0",
    ),
    dateCheckWarning: text("date_check_warning"),
    currency: text("currency").default("RUB"),
    currencyId: uuid("currency_id").references(() => currencies.id),
    exchangeRateId: uuid("exchange_rate_id").references(() => exchangeRates.id),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
    deletedAt: timestamp("deleted_at", { mode: "string" }),
    deletedById: uuid("deleted_by_id").references(() => users.id),
  },
  (table) => ({
    counterpartyRoleTypeIdx: index("prices_counterparty_role_type_idx").on(
      table.counterpartyRole,
      table.counterpartyType,
    ),
    counterpartyIdIdx: index("prices_counterparty_id_idx").on(
      table.counterpartyId,
    ),
    dateRangeIdx: index("prices_date_range_idx").on(
      table.dateFrom,
      table.dateTo,
    ),
    activeIdx: index("prices_is_active_idx").on(table.isActive),
    basisProductIdx: index("prices_basis_product_idx").on(
      table.basis,
      table.productType,
    ),
    currencyIdx: index("prices_currency_idx").on(table.currency),
  }),
);

// ============ RELATIONS ============

export const pricesRelations = relations(prices, ({ many, one }) => ({
  optPurchases: many(opt, { relationName: "purchasePrice" }),
  optSales: many(opt, { relationName: "salePrice" }),
  refuelingPurchases: many(aircraftRefueling, {
    relationName: "purchasePrice",
  }),
  refuelingSales: many(aircraftRefueling, { relationName: "salePrice" }),
  basis: one(bases, { fields: [prices.basisId], references: [bases.id] }),
  currency: one(currencies, {
    fields: [prices.currencyId],
    references: [currencies.id],
  }),
  exchangeRate: one(exchangeRates, {
    fields: [prices.exchangeRateId],
    references: [exchangeRates.id],
  }),
  createdBy: one(users, {
    fields: [prices.createdById],
    references: [users.id],
    relationName: "priceCreatedBy",
  }),
  updatedBy: one(users, {
    fields: [prices.updatedById],
    references: [users.id],
    relationName: "priceUpdatedBy",
  }),
}));

// ============ INSERT SCHEMAS ============

export const insertPriceSchema = createInsertSchema(prices).omit({ id: true });

// ============ TYPES ============

export type Price = typeof prices.$inferSelect;
export type InsertPrice = z.infer<typeof insertPriceSchema>;
