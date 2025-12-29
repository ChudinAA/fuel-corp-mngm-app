
import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";

export const monthlyPlans = pgTable("monthly_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  planMonth: timestamp("plan_month", { mode: "string" }).notNull(),
  planType: text("plan_type").notNull(), // 'sales', 'warehouse_volume'
  baseId: uuid("base_id"),
  productType: text("product_type"),
  plannedVolume: text("planned_volume"),
  plannedRevenue: text("planned_revenue"),
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

// ============ RELATIONS ============

export const monthlyPlansRelations = relations(monthlyPlans, ({ one }) => ({
  createdBy: one(users, { fields: [monthlyPlans.createdById], references: [users.id] }),
}));

// ============ INSERT SCHEMAS ============

export const insertMonthlyPlanSchema = createInsertSchema(monthlyPlans);

// ============ TYPES ============

export type MonthlyPlan = typeof monthlyPlans.$inferSelect;
export type InsertMonthlyPlan = z.infer<typeof insertMonthlyPlanSchema>;
