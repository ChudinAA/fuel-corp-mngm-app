import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  decimal,
  boolean,
  timestamp,
  uuid,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";
import { suppliers } from "../../suppliers/entities/suppliers";
import { customers } from "../../customers/entities/customers";
import { prices } from "../../prices/entities/prices";
import {
  storageCards,
  storageCardTransactions,
} from "../../storage-cards/entities/storage-cards";
import { exchangeRates } from "../../exchange-rates/entities/exchange-rates";
import { refuelingAbroadIntermediaries } from "./refueling-abroad-intermediaries";
import { bases } from "@shared/schema";

export const refuelingAbroad = pgTable(
  "refueling_abroad",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    refuelingDate: timestamp("refueling_date", { mode: "string" }).notNull(),
    productType: text("product_type").notNull(),
    aircraftNumber: text("aircraft_number"),
    orderNumber: text("order_number"),
    flightNumber: text("flight_number"),
    airport: text("airport"),
    country: text("country"),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => customers.id),
    basisId: uuid("basis_id").references(() => bases.id),
    storageCardId: uuid("storage_card_id").references(() => storageCards.id),
    intermediaryId: uuid("intermediary_id").references(() => suppliers.id),
    intermediaryCommissionFormula: text("intermediary_commission_formula"),
    intermediaryCommissionUsd: decimal("intermediary_commission_usd", {
      precision: 15,
      scale: 4,
    }),
    intermediaryCommissionRub: decimal("intermediary_commission_rub", {
      precision: 15,
      scale: 2,
    }),
    quantityLiters: decimal("quantity_liters", { precision: 15, scale: 2 }),
    density: decimal("density", { precision: 6, scale: 4 }),
    quantityKg: decimal("quantity_kg", { precision: 15, scale: 2 }).notNull(),
    inputMode: text("input_mode"),
    currency: text("currency").default("USD").notNull(),
    exchangeRateId: uuid("exchange_rate_id").references(() => exchangeRates.id),
    exchangeRateValue: decimal("exchange_rate_value", {
      precision: 15,
      scale: 4,
    }),
    transactionId: uuid("transaction_id").references(
      () => storageCardTransactions.id,
    ),
    purchaseExchangeRateId: uuid("purchase_exchange_rate_id").references(
      () => exchangeRates.id,
    ),
    purchaseExchangeRateValue: decimal("purchase_exchange_rate_value", {
      precision: 15,
      scale: 4,
    }),
    saleExchangeRateId: uuid("sale_exchange_rate_id").references(
      () => exchangeRates.id,
    ),
    saleExchangeRateValue: decimal("sale_exchange_rate_value", {
      precision: 15,
      scale: 4,
    }),
    purchasePriceUsd: decimal("purchase_price_usd", {
      precision: 12,
      scale: 4,
    }),
    purchasePriceRub: decimal("purchase_price_rub", {
      precision: 12,
      scale: 4,
    }),
    purchasePriceId: uuid("purchase_price_id").references(() => prices.id),
    purchasePriceIndex: integer("purchase_price_index").default(0),
    salePriceUsd: decimal("sale_price_usd", { precision: 12, scale: 4 }),
    salePriceRub: decimal("sale_price_rub", { precision: 12, scale: 4 }),
    salePriceId: uuid("sale_price_id").references(() => prices.id),
    salePriceIndex: integer("sale_price_index").default(0),
    purchaseAmountUsd: decimal("purchase_amount_usd", {
      precision: 15,
      scale: 2,
    }),
    purchaseAmountRub: decimal("purchase_amount_rub", {
      precision: 15,
      scale: 2,
    }),
    saleAmountUsd: decimal("sale_amount_usd", { precision: 15, scale: 2 }),
    saleAmountRub: decimal("sale_amount_rub", { precision: 15, scale: 2 }),
    profitUsd: decimal("profit_usd", { precision: 15, scale: 2 }),
    profitRub: decimal("profit_rub", { precision: 15, scale: 2 }),
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
    isDraft: boolean("is_draft").default(false).notNull(),
  },
  (table) => ({
    refuelingDateIdx: index("refueling_abroad_date_idx").on(
      table.refuelingDate,
    ),
    createdAtIdx: index("refueling_abroad_created_at_idx").on(table.createdAt),
    supplierIdx: index("refueling_abroad_supplier_idx").on(table.supplierId),
    buyerIdx: index("refueling_abroad_buyer_idx").on(table.buyerId),
    basisIdx: index("refueling_abroad_basis_idx").on(table.basisId),
    productTypeIdx: index("refueling_abroad_product_type_idx").on(
      table.productType,
    ),
    storageCardIdx: index("refueling_abroad_storage_card_idx").on(
      table.storageCardId,
    ),
    intermediaryIdx: index("refueling_abroad_intermediary_idx").on(
      table.intermediaryId,
    ),
    currencyIdx: index("refueling_abroad_currency_idx").on(table.currency),
    airportIdx: index("refueling_abroad_airport_idx").on(table.airport),
  }),
);

export const refuelingAbroadRelations = relations(
  refuelingAbroad,
  ({ one, many }) => ({
    supplier: one(suppliers, {
      fields: [refuelingAbroad.supplierId],
      references: [suppliers.id],
    }),
    buyer: one(customers, {
      fields: [refuelingAbroad.buyerId],
      references: [customers.id],
    }),
    basis: one(bases, {
      fields: [refuelingAbroad.basisId],
      references: [bases.id],
    }),
    storageCard: one(storageCards, {
      fields: [refuelingAbroad.storageCardId],
      references: [storageCards.id],
    }),
    transaction: one(storageCardTransactions, {
      fields: [refuelingAbroad.transactionId],
      references: [storageCardTransactions.id],
    }),
    intermediary: one(suppliers, {
      fields: [refuelingAbroad.intermediaryId],
      references: [suppliers.id],
      relationName: "intermediary",
    }),
    exchangeRate: one(exchangeRates, {
      fields: [refuelingAbroad.exchangeRateId],
      references: [exchangeRates.id],
    }),
    purchasePrice: one(prices, {
      fields: [refuelingAbroad.purchasePriceId],
      references: [prices.id],
    }),
    salePrice: one(prices, {
      fields: [refuelingAbroad.salePriceId],
      references: [prices.id],
    }),
    createdBy: one(users, {
      fields: [refuelingAbroad.createdById],
      references: [users.id],
    }),
    updatedBy: one(users, {
      fields: [refuelingAbroad.updatedById],
      references: [users.id],
    }),
    intermediaries: many(refuelingAbroadIntermediaries),
  }),
);

export const insertRefuelingAbroadSchema = createInsertSchema(refuelingAbroad)
  .omit({ id: true, createdAt: true })
  .extend({
    refuelingDate: z.string().nullable().optional(),
    productType: z.string().nullable().optional(),
    supplierId: z.string().nullable().optional(),
    buyerId: z.string().nullable().optional(),
    basisId: z.string().nullable().optional(),
    storageCardId: z.string().nullable().optional(),
    intermediaryId: z.string().nullable().optional(),
    intermediaryCommissionFormula: z.string().nullable().optional(),
    intermediaryCommissionUsd: z.number().nullable().optional(),
    intermediaryCommissionRub: z.number().nullable().optional(),
    quantityLiters: z.number().nullable().optional(),
    density: z.number().nullable().optional(),
    quantityKg: z.number().nullable().optional(),
    inputMode: z.string().nullable().optional(),
    currency: z.string().default("USD"),
    exchangeRateId: z.string().nullable().optional(),
    exchangeRateValue: z.number().nullable().optional(),
    purchaseExchangeRateId: z.string().nullable().optional(),
    purchaseExchangeRateValue: z.number().nullable().optional(),
    saleExchangeRateId: z.string().nullable().optional(),
    saleExchangeRateValue: z.number().nullable().optional(),
    purchasePriceUsd: z.number().nullable().optional(),
    purchasePriceRub: z.number().nullable().optional(),
    purchasePriceId: z.string().nullable().optional(),
    purchasePriceIndex: z.number().nullable().optional(),
    salePriceUsd: z.number().nullable().optional(),
    salePriceRub: z.number().nullable().optional(),
    salePriceId: z.string().nullable().optional(),
    salePriceIndex: z.number().nullable().optional(),
    purchaseAmountUsd: z.number().nullable().optional(),
    purchaseAmountRub: z.number().nullable().optional(),
    saleAmountUsd: z.number().nullable().optional(),
    saleAmountRub: z.number().nullable().optional(),
    profitUsd: z.number().nullable().optional(),
    profitRub: z.number().nullable().optional(),
    airport: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    contractNumber: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    isApproxVolume: z.boolean().optional(),
    isDraft: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (!data.isDraft) {
      if (!data.refuelingDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Дата заправки обязательна",
          path: ["refuelingDate"],
        });
      }
      if (!data.productType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Тип продукта обязателен",
          path: ["productType"],
        });
      }
      if (!data.supplierId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Поставщик обязателен",
          path: ["supplierId"],
        });
      }
      if (!data.buyerId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Покупатель обязателен",
          path: ["buyerId"],
        });
      }
      if (data.quantityKg === undefined || data.quantityKg === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Количество (кг) обязательно",
          path: ["quantityKg"],
        });
      }
    }
  });

export type RefuelingAbroad = typeof refuelingAbroad.$inferSelect;
export type InsertRefuelingAbroad = z.infer<typeof insertRefuelingAbroadSchema>;
