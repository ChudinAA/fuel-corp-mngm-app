
import { pgTable, uuid, text, jsonb, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { users } from "../../users/entities/users";

// Таблица определений виджетов
export const widgetDefinitions = pgTable("widget_definitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  widgetKey: text("widget_key").unique().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  defaultWidth: integer("default_width").notNull().default(2),
  defaultHeight: integer("default_height").notNull().default(2),
  minWidth: integer("min_width").notNull().default(1),
  minHeight: integer("min_height").notNull().default(1),
  requiredPermissions: text("required_permissions").array().default([]),
  configSchema: jsonb("config_schema"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
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
