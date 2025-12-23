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
import { logisticsCarriers } from "./logistics";

export const deliveryCost = pgTable("delivery_cost", {
  id: uuid("id").defaultRandom().primaryKey(),
  carrierId: uuid("carrier_id")
    .notNull()
    .references(() => logisticsCarriers.id),
  fromEntityType: text("from_entity_type").notNull(), // "base", "warehouse", "delivery_location"
  fromEntityId: uuid("from_entity_id").notNull(),
  fromLocation: text("from_location").notNull(),
  toEntityType: text("to_entity_type").notNull(), // "base", "warehouse", "delivery_location"
  toEntityId: uuid("to_entity_id").notNull(),
  toLocation: text("to_location").notNull(),
  costPerKg: decimal("cost_per_kg", { precision: 12, scale: 4 }).notNull(),
  distance: decimal("distance", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// ============ RELATIONS ============

export const deliveryCostRelations = relations(deliveryCost, ({ one }) => ({
  carrier: one(logisticsCarriers, {
    fields: [deliveryCost.carrierId],
    references: [logisticsCarriers.id],
  }),
  createdBy: one(users, {
    fields: [deliveryCost.createdById],
    references: [users.id],
    relationName: "deliveryCostCreatedBy",
  }),
  updatedBy: one(users, {
    fields: [deliveryCost.updatedById],
    references: [users.id],
    relationName: "deliveryCostUpdatedBy",
  }),
}));

// ============ INSERT SCHEMAS ============

export const insertDeliveryCostSchema = createInsertSchema(deliveryCost).omit({
  id: true,
});

// ============ TYPES ============

export type DeliveryCost = typeof deliveryCost.$inferSelect;
export type InsertDeliveryCost = z.infer<typeof insertDeliveryCostSchema>;
