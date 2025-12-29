
import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";

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

// ============ RELATIONS ============

export const registryTemplatesRelations = relations(registryTemplates, ({ one }) => ({
  createdBy: one(users, { fields: [registryTemplates.createdById], references: [users.id] }),
}));

// ============ INSERT SCHEMAS ============

export const insertRegistryTemplateSchema = createInsertSchema(registryTemplates);

// ============ TYPES ============

export type RegistryTemplate = typeof registryTemplates.$inferSelect;
export type InsertRegistryTemplate = z.infer<typeof insertRegistryTemplateSchema>;
