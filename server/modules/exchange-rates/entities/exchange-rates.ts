import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  decimal,
  date,
  boolean,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";
import { currencies } from "@shared/schema";

export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    currency: text("currency").notNull(),
    targetCurrency: text("target_currency").notNull().default("RUB"),
    currencyId: uuid("currency_id").references(() => currencies.id),
    targetCurrencyId: uuid("target_currency_id").references(() => currencies.id),
    rate: decimal("rate", { precision: 15, scale: 6 }).notNull(),
    rateDate: date("rate_date").notNull(),
    source: text("source"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
    deletedAt: timestamp("deleted_at", { mode: "string" }),
    deletedById: uuid("deleted_by_id").references(() => users.id),
  },
  (table) => ({
    currencyIdx: index("exchange_rates_currency_idx").on(table.currency),
    rateDateIdx: index("exchange_rates_rate_date_idx").on(table.rateDate),
    currencyDateIdx: index("exchange_rates_currency_date_idx").on(
      table.currency,
      table.rateDate
    ),
    currencyPairIdx: index("exchange_rates_currency_pair_idx").on(
      table.currency,
      table.targetCurrency
    ),
    isActiveIdx: index("exchange_rates_is_active_idx").on(table.isActive),
  })
);

export const exchangeRatesRelations = relations(exchangeRates, ({ one }) => ({
  currency: one(currencies, {
    fields: [exchangeRates.currencyId],
    references: [currencies.id],
  }),
  targetCurrency: one(currencies, {
    fields: [exchangeRates.targetCurrencyId],
    references: [currencies.id],
  }),
  createdBy: one(users, {
    fields: [exchangeRates.createdById],
    references: [users.id],
    relationName: "exchangeRateCreatedBy",
  }),
  updatedBy: one(users, {
    fields: [exchangeRates.updatedById],
    references: [users.id],
    relationName: "exchangeRateUpdatedBy",
  }),
}));

export const insertExchangeRateSchema = createInsertSchema(exchangeRates)
  .omit({ id: true, createdAt: true })
  .extend({
    rate: z.number().positive("Курс должен быть положительным"),
    rateDate: z.string(),
    currency: z.string().min(1, "Базовая валюта обязательна"),
    targetCurrency: z.string().min(1, "Целевая валюта обязательна"),
    currencyId: z.string(),
    targetCurrencyId: z.string(),
  });

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;
