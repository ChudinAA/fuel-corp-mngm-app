
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

// Таблица для шаблонов реестров
export const registryTemplates = pgTable("registry_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateName: text("template_name").notNull(),
  templateType: text("template_type").notNull(), // 'airline', 'government', 'foreign', 'other'
  customerType: text("customer_type"), // Связь с типом заказчика
  structure: jsonb("structure").notNull(), // Структура шаблона (колонки, формулы, формат)
  isActive: text("is_active").default("true").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id).notNull(),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  deletedById: uuid("deleted_by_id").references(() => users.id),
}, (table) => ({
  templateTypeIdx: index("registry_templates_template_type_idx").on(table.templateType),
  isActiveIdx: index("registry_templates_is_active_idx").on(table.isActive),
}));

// Таблица для ежемесячных планов
export const monthlyPlans = pgTable("monthly_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  planMonth: timestamp("plan_month", { mode: "string" }).notNull(), // Месяц планирования
  planType: text("plan_type").notNull(), // 'sales', 'warehouse_volume'
  baseId: uuid("base_id"), // Связь с базой/аэропортом
  productType: text("product_type"), // Тип продукта
  plannedVolume: text("planned_volume"), // Плановый объем
  plannedRevenue: text("planned_revenue"), // Плановая выручка
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id).notNull(),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  deletedById: uuid("deleted_by_id").references(() => users.id),
}, (table) => ({
  planMonthIdx: index("monthly_plans_plan_month_idx").on(table.planMonth),
  planTypeIdx: index("monthly_plans_plan_type_idx").on(table.planType),
  baseIdIdx: index("monthly_plans_base_id_idx").on(table.baseId),
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

export const registryTemplatesRelations = relations(registryTemplates, ({ one }) => ({
  createdBy: one(users, { fields: [registryTemplates.createdById], references: [users.id] }),
}));

export const monthlyPlansRelations = relations(monthlyPlans, ({ one }) => ({
  createdBy: one(users, { fields: [monthlyPlans.createdById], references: [users.id] }),
}));

export const governmentContractsRelations = relations(governmentContracts, ({ one }) => ({
  createdBy: one(users, { fields: [governmentContracts.createdById], references: [users.id] }),
}));

export const budgetIncomeExpenseRelations = relations(budgetIncomeExpense, ({ one }) => ({
  createdBy: one(users, { fields: [budgetIncomeExpense.createdById], references: [users.id] }),
}));

// ============ INSERT SCHEMAS ============

export const insertSavedReportSchema = createInsertSchema(savedReports);
export const insertRegistryTemplateSchema = createInsertSchema(registryTemplates);
export const insertMonthlyPlanSchema = createInsertSchema(monthlyPlans);
export const insertGovernmentContractSchema = createInsertSchema(governmentContracts);
export const insertBudgetIncomeExpenseSchema = createInsertSchema(budgetIncomeExpense);

// ============ TYPES ============

export type SavedReport = typeof savedReports.$inferSelect;
export type InsertSavedReport = z.infer<typeof insertSavedReportSchema>;

export type RegistryTemplate = typeof registryTemplates.$inferSelect;
export type InsertRegistryTemplate = z.infer<typeof insertRegistryTemplateSchema>;

export type MonthlyPlan = typeof monthlyPlans.$inferSelect;
export type InsertMonthlyPlan = z.infer<typeof insertMonthlyPlanSchema>;

export type GovernmentContract = typeof governmentContracts.$inferSelect;
export type InsertGovernmentContract = z.infer<typeof insertGovernmentContractSchema>;

export type BudgetIncomeExpense = typeof budgetIncomeExpense.$inferSelect;
export type InsertBudgetIncomeExpense = z.infer<typeof insertBudgetIncomeExpenseSchema>;
