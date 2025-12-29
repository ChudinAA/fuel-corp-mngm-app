
import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";

// Таблица для сохраненных отчетов
export const savedReports = pgTable("saved_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reportType: text("report_type").notNull(), // 'daily', 'analytics', 'registry', 'monthly_plan', 'gov_contract', 'bdr', 'management'
  reportName: text("report_name").notNull(),
  description: text("description"),
  filters: jsonb("filters").notNull(), // Сохраненные фильтры отчета
  columns: jsonb("columns"), // Настройки колонок (порядок, видимость)
  chartConfig: jsonb("chart_config"), // Настройки графиков для аналитических отчетов
  isPublic: text("is_public").default("false").notNull(), // Доступен ли отчет другим пользователям
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id).notNull(),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  deletedById: uuid("deleted_by_id").references(() => users.id),
}, (table) => ({
  reportTypeIdx: index("saved_reports_report_type_idx").on(table.reportType),
  createdByIdx: index("saved_reports_created_by_idx").on(table.createdById),
  createdAtIdx: index("saved_reports_created_at_idx").on(table.createdAt),
}));

// Таблица для госконтрактов
export const governmentContracts = pgTable("government_contracts", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractNumber: text("contract_number").notNull(),
  contractName: text("contract_name").notNull(),
  customerId: uuid("customer_id"), // Связь с заказчиком
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

// Таблица для БДР (Бюджет доходов и расходов)
export const budgetIncomeExpense = pgTable("budget_income_expense", {
  id: uuid("id").defaultRandom().primaryKey(),
  budgetMonth: timestamp("budget_month", { mode: "string" }).notNull(),
  salesVolume: text("sales_volume"), // Объем продаж
  salesRevenue: text("sales_revenue"), // Выручка от продаж
  marginality: text("marginality"), // Маржинальность
  operatingExpenses: text("operating_expenses"), // Операционные расходы
  personnelExpenses: text("personnel_expenses"), // Расходы на персонал
  logisticsExpenses: text("logistics_expenses"), // Логистические расходы
  otherExpenses: text("other_expenses"), // Прочие расходы
  totalExpenses: text("total_expenses"), // Общие расходы
  netProfit: text("net_profit"), // Чистая прибыль
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id).notNull(),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  deletedById: uuid("deleted_by_id").references(() => users.id),
}, (table) => ({
  budgetMonthIdx: index("budget_income_expense_budget_month_idx").on(table.budgetMonth),
}));

// ============ RELATIONS ============

export const savedReportsRelations = relations(savedReports, ({ one }) => ({
  createdBy: one(users, { fields: [savedReports.createdById], references: [users.id] }),
}));

export const governmentContractsRelations = relations(governmentContracts, ({ one }) => ({
  createdBy: one(users, { fields: [governmentContracts.createdById], references: [users.id] }),
}));

export const budgetIncomeExpenseRelations = relations(budgetIncomeExpense, ({ one }) => ({
  createdBy: one(users, { fields: [budgetIncomeExpense.createdById], references: [users.id] }),
}));

// ============ INSERT SCHEMAS ============

export const insertSavedReportSchema = createInsertSchema(savedReports);
export const insertGovernmentContractSchema = createInsertSchema(governmentContracts);
export const insertBudgetIncomeExpenseSchema = createInsertSchema(budgetIncomeExpense);

// ============ TYPES ============

export type SavedReport = typeof savedReports.$inferSelect;
export type InsertSavedReport = z.infer<typeof insertSavedReportSchema>;

export type GovernmentContract = typeof governmentContracts.$inferSelect;
export type InsertGovernmentContract = z.infer<typeof insertGovernmentContractSchema>;

export type BudgetIncomeExpense = typeof budgetIncomeExpense.$inferSelect;
export type InsertBudgetIncomeExpense = z.infer<typeof insertBudgetIncomeExpenseSchema>;
