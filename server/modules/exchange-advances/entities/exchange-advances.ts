import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  decimal,
  boolean,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";
import { suppliers } from "../../suppliers/entities/suppliers";

// Карты авансов биржи (по продавцам)
export const exchangeAdvanceCards = pgTable(
  "exchange_advance_cards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sellerId: uuid("seller_id").notNull().references(() => suppliers.id),
    currentBalance: decimal("current_balance", { precision: 15, scale: 2 }).default("0"),
    notes: text("notes"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
    deletedAt: timestamp("deleted_at", { mode: "string" }),
    deletedById: uuid("deleted_by_id").references(() => users.id),
  },
  (table) => ({
    sellerIdIdx: index("exchange_advance_cards_seller_id_idx").on(table.sellerId),
    isActiveIdx: index("exchange_advance_cards_is_active_idx").on(table.isActive),
  }),
);

export const exchangeAdvanceCardsRelations = relations(exchangeAdvanceCards, ({ one, many }) => ({
  seller: one(suppliers, {
    fields: [exchangeAdvanceCards.sellerId],
    references: [suppliers.id],
  }),
  createdBy: one(users, {
    fields: [exchangeAdvanceCards.createdById],
    references: [users.id],
  }),
  transactions: many(exchangeAdvanceTransactions),
}));

// Транзакции по картам авансов биржи
export const exchangeAdvanceTransactions = pgTable(
  "exchange_advance_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cardId: uuid("card_id").notNull().references(() => exchangeAdvanceCards.id),
    transactionType: text("transaction_type").notNull(), // 'income' | 'expense'
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    balanceBefore: decimal("balance_before", { precision: 15, scale: 2 }),
    balanceAfter: decimal("balance_after", { precision: 15, scale: 2 }),
    relatedDealId: uuid("related_deal_id"),
    description: text("description"),
    transactionDate: timestamp("transaction_date", { mode: "string" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
    deletedAt: timestamp("deleted_at", { mode: "string" }),
    deletedById: uuid("deleted_by_id").references(() => users.id),
  },
  (table) => ({
    cardIdIdx: index("exchange_advance_transactions_card_id_idx").on(table.cardId),
    typeIdx: index("exchange_advance_transactions_type_idx").on(table.transactionType),
    createdAtIdx: index("exchange_advance_transactions_created_at_idx").on(table.createdAt),
  }),
);

export const exchangeAdvanceTransactionsRelations = relations(exchangeAdvanceTransactions, ({ one }) => ({
  card: one(exchangeAdvanceCards, {
    fields: [exchangeAdvanceTransactions.cardId],
    references: [exchangeAdvanceCards.id],
  }),
  createdBy: one(users, {
    fields: [exchangeAdvanceTransactions.createdById],
    references: [users.id],
  }),
}));

export const insertExchangeAdvanceCardSchema = createInsertSchema(exchangeAdvanceCards)
  .omit({ id: true, createdAt: true })
  .extend({
    sellerId: z.string().uuid("Продавец обязателен"),
    notes: z.string().nullable().optional(),
  });

export const insertExchangeAdvanceTransactionSchema = createInsertSchema(exchangeAdvanceTransactions)
  .omit({ id: true, createdAt: true })
  .extend({
    cardId: z.string().uuid(),
    transactionType: z.enum(["income", "expense"]),
    amount: z.union([z.string(), z.number()]).transform(v => String(v)),
    relatedDealId: z.string().uuid().nullable().optional(),
    description: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    transactionDate: z.string().nullable().optional(),
  });

export type ExchangeAdvanceCard = typeof exchangeAdvanceCards.$inferSelect;
export type InsertExchangeAdvanceCard = z.infer<typeof insertExchangeAdvanceCardSchema>;
export type ExchangeAdvanceTransaction = typeof exchangeAdvanceTransactions.$inferSelect;
export type InsertExchangeAdvanceTransaction = z.infer<typeof insertExchangeAdvanceTransactionSchema>;
