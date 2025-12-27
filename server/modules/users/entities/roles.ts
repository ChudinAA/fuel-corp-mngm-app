import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  decimal,
  date,
  boolean,
  timestamp,
  jsonb,
  serial,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: text("permissions").array(),
  isDefault: boolean("is_default").default(false),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  deletedById: uuid("deleted_by_id").references(() => users.id),
});

// ============ RELATIONS ============

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
}));

// ============ INSERT SCHEMAS ============

export const insertRoleSchema = createInsertSchema(roles).omit({ id: true });

// ============ TYPES ============

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

// Module names for permissions
export const MODULES = [
  "opt",
  "refueling",
  "exchange",
  "movement",
  "warehouses",
  "prices",
  "delivery",
  "directories",
  "audit",
  "admin",
] as const;

export const ACTIONS = ["view", "create", "edit", "delete"] as const;

// Default roles
export const DEFAULT_ROLES = [
  { name: "Ген.дир", description: "Генеральный директор" },
  { name: "Админ", description: "Администратор системы" },
  { name: "Глав.бух", description: "Главный бухгалтер" },
  { name: "Коммерческий директор", description: "Коммерческий директор" },
  { name: "Руководитель проекта", description: "Руководитель проекта" },
  { name: "Ведущий менеджер", description: "Ведущий менеджер" },
  {
    name: "Руководитель подразделения",
    description: "Руководитель подразделения",
  },
  { name: "Менеджер", description: "Менеджер" },
  { name: "Операционист", description: "Операционист" },
  { name: "Оператор подразделения", description: "Оператор подразделения" },
] as const;
