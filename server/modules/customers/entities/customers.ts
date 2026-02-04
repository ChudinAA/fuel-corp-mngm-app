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
import { bases, users } from "@shared/schema";
import { aircraftRefueling } from "@shared/schema";
import { opt } from "@shared/schema";

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    inn: text("inn"),
    contractNumber: text("contract_number"),
    contactPerson: text("contact_person"),
    phone: text("phone"),
    email: text("email"),
    module: text("module").notNull(), // "wholesale", "refueling", "both"
    isIntermediary: boolean("is_intermediary").default(false),
    isForeign: boolean("is_foreign").default(false),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
    deletedAt: timestamp("deleted_at", { mode: "string" }),
    deletedById: uuid("deleted_by_id").references(() => users.id),
  },
  (table) => ({
    moduleIdx: index("customers_module_idx").on(table.module),
    nameIdx: index("customers_name_idx").on(table.name),
    isActiveIdx: index("customers_is_active_idx").on(table.isActive),
    isIntermediaryIdx: index("customers_is_intermediary_idx").on(
      table.isIntermediary,
    ),
    isForeignIdx: index("customers_is_foreign_idx").on(table.isForeign),
  }),
);

// Junction table for supplier-base many-to-many relationship
export const customerBases = pgTable(
  "customer_bases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    baseId: uuid("base_id")
      .notNull()
      .references(() => bases.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => ({
    // Composite unique constraint to prevent duplicate supplier-base pairs
    uniqueCustomerBase: index("unique_customer_base_idx").on(
      table.customerId,
      table.baseId,
    ),
  }),
);

// ============ RELATIONS ============

export const customersRelations = relations(customers, ({ many }) => ({
  optDeals: many(opt),
  refuelings: many(aircraftRefueling),
  customerBases: many(customerBases),
}));

export const customerBasesRelations = relations(customerBases, ({ one }) => ({
  customer: one(customers, {
    fields: [customerBases.customerId],
    references: [customers.id],
  }),
  base: one(bases, { fields: [customerBases.baseId], references: [bases.id] }),
}));

// ============ INSERT SCHEMAS ============

export const insertCustomerSchema = createInsertSchema(customers)
  .omit({ id: true })
  .extend({
    baseIds: z.array(z.string().uuid()).optional(),
  });

// ============ TYPES ============

export type Customer = typeof customers.$inferSelect & {
  baseIds?: string[];
};
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type CustomerBase = typeof customerBases.$inferSelect;
