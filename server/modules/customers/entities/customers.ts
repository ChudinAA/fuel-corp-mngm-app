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
import { users } from "@shared/schema";
import { aircraftRefueling } from "@shared/schema";
import { opt } from "@shared/schema";

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  inn: text("inn"),
  contractNumber: text("contract_number"),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  module: text("module").notNull(), // "wholesale", "refueling", "both"
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// ============ RELATIONS ============

export const customersRelations = relations(customers, ({ many }) => ({
  optDeals: many(opt),
  refuelings: many(aircraftRefueling),
}));

// ============ INSERT SCHEMAS ============

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
});

// ============ TYPES ============

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
