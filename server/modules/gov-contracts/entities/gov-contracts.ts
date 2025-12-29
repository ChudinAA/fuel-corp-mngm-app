
import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";
import { customers } from "../../customers/entities/customers";

export const governmentContracts = pgTable("government_contracts", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractNumber: text("contract_number").notNull(),
  contractName: text("contract_name").notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  contractDate: timestamp("contract_date", { mode: "string" }).notNull(),
  startDate: timestamp("start_date", { mode: "string" }).notNull(),
  endDate: timestamp("end_date", { mode: "string" }).notNull(),
  totalAmount: text("total_amount"), // Общая сумма контракта
  currentAmount: text("current_amount"), // Текущая сумма продаж
  remainingAmount: text("remaining_amount"), // Остаток
  productType: text("product_type"), // Тип продукта
  plannedVolume: text("planned_volume"), // Плановый объем
  actualVolume: text("actual_volume"), // Фактический объем
  status: text("status").default("active").notNull(), // 'active', 'completed', 'suspended'
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id).notNull(),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  deletedById: uuid("deleted_by_id").references(() => users.id),
}, (table) => ({
  contractNumberIdx: index("government_contracts_contract_number_idx").on(table.contractNumber),
  statusIdx: index("government_contracts_status_idx").on(table.status),
  startDateIdx: index("government_contracts_start_date_idx").on(table.startDate),
  endDateIdx: index("government_contracts_end_date_idx").on(table.endDate),
}));

// ============ RELATIONS ============

export const governmentContractsRelations = relations(governmentContracts, ({ one }) => ({
  createdBy: one(users, { fields: [governmentContracts.createdById], references: [users.id] }),
  customer: one(customers, { fields: [governmentContracts.customerId], references: [customers.id] }),
}));

// ============ INSERT SCHEMAS ============

export const insertGovernmentContractSchema = createInsertSchema(governmentContracts);

// ============ TYPES ============

export type GovernmentContract = typeof governmentContracts.$inferSelect;
export type InsertGovernmentContract = z.infer<typeof insertGovernmentContractSchema>;
