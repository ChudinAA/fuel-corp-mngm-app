import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  decimal,
  boolean,
  timestamp,
  date,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";

import { suppliers } from "../../suppliers/entities/suppliers";
import { currencies } from "@shared/schema";

export const storageCards = pgTable(
  "storage_cards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    currency: text("currency").default("USD"),
    currencySymbol: text("currency_symbol").default("$"),
    currencyId: uuid("currency_id").references(() => currencies.id),
    currentBalance: decimal("current_balance", {
      precision: 15,
      scale: 2,
    }).default("0"),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    averageCost: decimal("average_cost", { precision: 12, scale: 5 }).default(
      "0",
    ),
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
    nameIdx: index("storage_cards_name_idx").on(table.name),
    isActiveIdx: index("storage_cards_is_active_idx").on(table.isActive),
  }),
);

export const storageCardTransactions = pgTable(
  "storage_card_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storageCardId: uuid("storage_card_id")
      .notNull()
      .references(() => storageCards.id),
    transactionType: text("transaction_type").notNull(),
    quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull(),
    price: decimal("price", { precision: 12, scale: 4 }),
    currency: text("currency").default("USD"),
    currencySymbol: text("currency_symbol").default("$"),
    balanceBefore: decimal("balance_before", { precision: 15, scale: 2 }),
    balanceAfter: decimal("balance_after", { precision: 15, scale: 2 }),
    averageCostBefore: decimal("average_cost_before", {
      precision: 12,
      scale: 4,
    }),
    averageCostAfter: decimal("average_cost_after", {
      precision: 12,
      scale: 4,
    }),
    sourceType: text("source_type"),
    sourceId: uuid("source_id"),
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
    storageCardIdIdx: index("storage_card_transactions_card_id_idx").on(
      table.storageCardId,
    ),
    createdAtIdx: index("storage_card_transactions_created_at_idx").on(
      table.createdAt,
    ),
    sourceIdx: index("storage_card_transactions_source_idx").on(
      table.sourceType,
      table.sourceId,
    ),
    transactionDateIdx: index("storage_card_transactions_date_idx").on(
      table.storageCardId,
      table.transactionDate,
    ),
  }),
);

export const storageCardsRelations = relations(
  storageCards,
  ({ many, one }) => ({
    transactions: many(storageCardTransactions),
    supplier: one(suppliers, {
      fields: [storageCards.supplierId],
      references: [suppliers.id],
    }),
    currency: one(currencies, {
      fields: [storageCards.currencyId],
      references: [currencies.id],
    }),
    createdBy: one(users, {
      fields: [storageCards.createdById],
      references: [users.id],
      relationName: "storageCardCreatedBy",
    }),
    updatedBy: one(users, {
      fields: [storageCards.updatedById],
      references: [users.id],
      relationName: "storageCardUpdatedBy",
    }),
  }),
);

export const storageCardTransactionsRelations = relations(
  storageCardTransactions,
  ({ one }) => ({
    storageCard: one(storageCards, {
      fields: [storageCardTransactions.storageCardId],
      references: [storageCards.id],
    }),
    createdBy: one(users, {
      fields: [storageCardTransactions.createdById],
      references: [users.id],
    }),
  }),
);

export const insertStorageCardSchema = createInsertSchema(storageCards)
  .omit({ id: true, createdAt: true })
  .extend({
    name: z.string().min(1, "Название обязательно"),
  });

export const insertStorageCardTransactionSchema = createInsertSchema(
  storageCardTransactions,
)
  .omit({ id: true, createdAt: true })
  .extend({
    quantity: z.number(),
    price: z.number().optional(),
  });

export type StorageCard = typeof storageCards.$inferSelect;
export type InsertStorageCard = z.infer<typeof insertStorageCardSchema>;
export type StorageCardTransaction =
  typeof storageCardTransactions.$inferSelect;
export type InsertStorageCardTransaction = z.infer<
  typeof insertStorageCardTransactionSchema
>;
