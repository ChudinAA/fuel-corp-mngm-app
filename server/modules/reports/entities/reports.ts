
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

// ============ RELATIONS ============

export const savedReportsRelations = relations(savedReports, ({ one }) => ({
  createdBy: one(users, { fields: [savedReports.createdById], references: [users.id] }),
}));

// ============ INSERT SCHEMAS ============

export const insertSavedReportSchema = createInsertSchema(savedReports);

// ============ TYPES ============

export type SavedReport = typeof savedReports.$inferSelect;
export type InsertSavedReport = z.infer<typeof insertSavedReportSchema>;
