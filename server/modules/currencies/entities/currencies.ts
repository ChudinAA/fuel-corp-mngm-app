import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  boolean,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";

export const currencies = pgTable(
  "currencies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    symbol: text("symbol"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
    deletedAt: timestamp("deleted_at", { mode: "string" }),
    deletedById: uuid("deleted_by_id").references(() => users.id),
  },
  (table) => ({
    codeIdx: index("currencies_code_idx").on(table.code),
    isActiveIdx: index("currencies_is_active_idx").on(table.isActive),
  })
);

export const currenciesRelations = relations(currencies, ({ one }) => ({
  createdBy: one(users, {
    fields: [currencies.createdById],
    references: [users.id],
    relationName: "currencyCreatedBy",
  }),
  updatedBy: one(users, {
    fields: [currencies.updatedById],
    references: [users.id],
    relationName: "currencyUpdatedBy",
  }),
}));

export const insertCurrencySchema = createInsertSchema(currencies)
  .omit({ id: true, createdAt: true })
  .extend({
    code: z.string().min(1, "Код валюты обязателен").max(10),
    name: z.string().min(1, "Название валюты обязательно"),
  });

export type Currency = typeof currencies.$inferSelect;
export type InsertCurrency = z.infer<typeof insertCurrencySchema>;
