import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  decimal,
  timestamp,
  uuid,
  index,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { currencies } from "../../currencies/entities/currencies";
import { exchangeRates } from "../../exchange-rates/entities/exchange-rates";
import { refuelingAbroad } from "./refueling-abroad";

export const refuelingAbroadExchangeRates = pgTable(
  "refueling_abroad_exchange_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    refuelingAbroadId: uuid("refueling_abroad_id")
      .notNull()
      .references(() => refuelingAbroad.id, { onDelete: "cascade" }),
    chainPosition: integer("chain_position").default(0).notNull(),
    exchangeRateId: uuid("exchange_rate_id").references(() => exchangeRates.id),
    fromCurrencyId: uuid("from_currency_id").references(() => currencies.id),
    toCurrencyId: uuid("to_currency_id").references(() => currencies.id),
    fromCurrencyCode: text("from_currency_code"),
    toCurrencyCode: text("to_currency_code"),
    rate: decimal("rate", { precision: 15, scale: 6 }),
    rateDate: text("rate_date"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => ({
    refuelingAbroadIdx: index("raer_refueling_abroad_idx").on(
      table.refuelingAbroadId,
    ),
    chainPositionIdx: index("raer_chain_position_idx").on(
      table.refuelingAbroadId,
      table.chainPosition,
    ),
  }),
);

export const refuelingAbroadExchangeRatesRelations = relations(
  refuelingAbroadExchangeRates,
  ({ one }) => ({
    refuelingAbroad: one(refuelingAbroad, {
      fields: [refuelingAbroadExchangeRates.refuelingAbroadId],
      references: [refuelingAbroad.id],
    }),
    exchangeRate: one(exchangeRates, {
      fields: [refuelingAbroadExchangeRates.exchangeRateId],
      references: [exchangeRates.id],
    }),
    fromCurrency: one(currencies, {
      fields: [refuelingAbroadExchangeRates.fromCurrencyId],
      references: [currencies.id],
      relationName: "raerFromCurrency",
    }),
    toCurrency: one(currencies, {
      fields: [refuelingAbroadExchangeRates.toCurrencyId],
      references: [currencies.id],
      relationName: "raerToCurrency",
    }),
  }),
);

export const insertRefuelingAbroadExchangeRateSchema = createInsertSchema(
  refuelingAbroadExchangeRates,
)
  .omit({ id: true, createdAt: true })
  .extend({
    refuelingAbroadId: z.string(),
    chainPosition: z.number().default(0),
    exchangeRateId: z.string().uuid().nullable().optional(),
    fromCurrencyId: z.string().uuid().nullable().optional(),
    toCurrencyId: z.string().uuid().nullable().optional(),
    fromCurrencyCode: z.string().nullable().optional(),
    toCurrencyCode: z.string().nullable().optional(),
    rate: z.number().nullable().optional(),
    rateDate: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  });

export type RefuelingAbroadExchangeRate =
  typeof refuelingAbroadExchangeRates.$inferSelect;
export type InsertRefuelingAbroadExchangeRate = z.infer<
  typeof insertRefuelingAbroadExchangeRateSchema
>;
