import { pgTable, uuid, text, jsonb, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { users } from "../../users/entities/users";
import { roles } from "../../users/entities/roles";

// Таблица определений виджетов
export const widgetDefinitions = pgTable("widget_definitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  widgetKey: text("widget_key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  defaultWidth: integer("default_width").notNull().default(4),
  defaultHeight: integer("default_height").notNull().default(2),
  minWidth: integer("min_width").notNull().default(2),
  minHeight: integer("min_height").notNull().default(1),
  requiredPermissions: jsonb("required_permissions").$type<string[]>(),
  configSchema: jsonb("config_schema"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
});

// Таблица конфигураций дашбордов
export const dashboardConfigurations = pgTable("dashboard_configurations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  isDefault: boolean("is_default").default(false),
  layout: jsonb("layout").$type<any[]>().notNull().default([]),
  widgets: jsonb("widgets").$type<any[]>().notNull().default([]),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
});

// Таблица шаблонов дашбордов
export const dashboardTemplates = pgTable("dashboard_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // 'system', 'user', 'role'
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }),
  layout: jsonb("layout").notNull().$type<any[]>(),
  widgets: jsonb("widgets").notNull().$type<any[]>(),
  isSystem: boolean("is_system").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdBy: uuid("created_by").references(() => users.id),
});