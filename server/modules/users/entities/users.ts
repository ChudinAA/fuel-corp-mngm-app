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
import { roles } from "./roles";

// Session table for express-session storage
// Note: Management is shared with connect-pg-simple
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { precision: 6, mode: "string" }).notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  roleId: uuid("role_id").references(() => roles.id),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  deletedById: uuid("deleted_by_id").references(() => users.id),
});

// ============ RELATIONS ============

export const usersRelations = relations(users, ({ one }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
}));

// ============ INSERT SCHEMAS ============

export const registerUserSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(6, "Пароль должен быть не менее 6 символов"),
  firstName: z.string().min(1, "Введите имя"),
  lastName: z.string().min(1, "Введите фамилию"),
  confirmPassword: z.string().optional(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLoginAt: true,
});

export const loginSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(6, "Пароль должен быть не менее 6 символов"),
});

// ============ TYPES ============

export type User = typeof users.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type RegisterUser = z.infer<typeof registerUserSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;
