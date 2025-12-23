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
import { supplierBases } from "./suppliers";
import { warehouseBases } from "./warehouses";

export const bases = pgTable("bases", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  baseType: text("base_type").notNull(), // 'wholesale' or 'refueling'
  location: text("location"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// ============ RELATIONS ============

export const basesRelations = relations(bases, ({ one, many }) => ({
  supplierBases: many(supplierBases),
  warehouseBases: many(warehouseBases),
  createdBy: one(users, {
    fields: [bases.createdById],
    references: [users.id],
    relationName: "baseCreatedBy",
  }),
  updatedBy: one(users, {
    fields: [bases.updatedById],
    references: [users.id],
    relationName: "baseUpdatedBy",
  }),
}));

// ============ INSERT SCHEMAS ============

export const insertBaseSchema = createInsertSchema(bases).omit({ id: true });

// ============ TYPES ============

export type Base = typeof bases.$inferSelect;
export type InsertBase = z.infer<typeof insertBaseSchema>;
