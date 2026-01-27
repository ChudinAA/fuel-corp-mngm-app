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

export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    currency: text("currency").notNull(),
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
    isActiveIdx: index("exchange_rates_is_active_idx").on(table.isActive),
  })
);

export const exchangeRatesRelations = relations(exchangeRates, ({ one }) => ({
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
    currency: z.string().min(1, "Валюта обязательна"),
  });

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;

export const CURRENCIES = [
  { value: "USD", label: "Доллар США ($)" },
  { value: "EUR", label: "Евро (€)" },
  { value: "CNY", label: "Юань (¥)" },
  { value: "AED", label: "Дирхам ОАЭ" },
  { value: "TRY", label: "Турецкая лира" },
] as const;
