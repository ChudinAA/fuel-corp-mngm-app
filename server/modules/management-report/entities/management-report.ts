
import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";

export const managementReports = pgTable("management_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reportName: text("report_name").notNull(),
  description: text("description"),
  periodStart: timestamp("period_start", { mode: "string" }).notNull(),
  periodEnd: timestamp("period_end", { mode: "string" }).notNull(),
  reportData: jsonb("report_data").notNull(), // Агрегированные данные отчета
  visualizationConfig: jsonb("visualization_config"), // Настройки графиков и визуализаций
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id).notNull(),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  deletedById: uuid("deleted_by_id").references(() => users.id),
}, (table) => ({
  periodStartIdx: index("management_reports_period_start_idx").on(table.periodStart),
  periodEndIdx: index("management_reports_period_end_idx").on(table.periodEnd),
  createdByIdx: index("management_reports_created_by_idx").on(table.createdById),
}));

// ============ RELATIONS ============

export const managementReportsRelations = relations(managementReports, ({ one }) => ({
  createdBy: one(users, { fields: [managementReports.createdById], references: [users.id] }),
}));

// ============ INSERT SCHEMAS ============

export const insertManagementReportSchema = createInsertSchema(managementReports);

// ============ TYPES ============

export type ManagementReport = typeof managementReports.$inferSelect;
export type InsertManagementReport = z.infer<typeof insertManagementReportSchema>;
