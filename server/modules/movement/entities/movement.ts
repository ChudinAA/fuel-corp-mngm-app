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
import { users } from "../../users/entities/users";
import { suppliers } from "../../../schemas/suppliers";
import { warehouses } from "../../warehouses/entities/warehouses";
import { logisticsCarriers } from "../../logistics/entities/logistics";

export const movement = pgTable("movement", {
  id: uuid("id").defaultRandom().primaryKey(),
  movementDate: timestamp("movement_date", { mode: "string" }).notNull(),
  movementType: text("movement_type").notNull(),
  productType: text("product_type").notNull(),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  fromWarehouseId: uuid("from_warehouse_id").references(() => warehouses.id),
  toWarehouseId: uuid("to_warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  quantityLiters: decimal("quantity_liters", { precision: 15, scale: 2 }),
  density: decimal("density", { precision: 6, scale: 4 }),
  quantityKg: decimal("quantity_kg", { precision: 15, scale: 2 }).notNull(),
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 4 }),
  deliveryPrice: decimal("delivery_price", { precision: 12, scale: 4 }),
  deliveryCost: decimal("delivery_cost", { precision: 15, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 15, scale: 2 }),
  costPerKg: decimal("cost_per_kg", { precision: 12, scale: 4 }),
  carrierId: uuid("carrier_id").references(() => logisticsCarriers.id),
  vehicleNumber: text("vehicle_number"),
  trailerNumber: text("trailer_number"),
  driverName: text("driver_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// ============ RELATIONS ============

export const movementRelations = relations(movement, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [movement.supplierId],
    references: [suppliers.id],
  }),
  fromWarehouse: one(warehouses, {
    fields: [movement.fromWarehouseId],
    references: [warehouses.id],
  }),
  toWarehouse: one(warehouses, {
    fields: [movement.toWarehouseId],
    references: [warehouses.id],
  }),
  carrier: one(logisticsCarriers, {
    fields: [movement.carrierId],
    references: [logisticsCarriers.id],
  }),
  createdBy: one(users, {
    fields: [movement.createdById],
    references: [users.id],
  }),
  updatedBy: one(users, {
    fields: [movement.updatedById],
    references: [users.id],
  }),
}));

// ============ INSERT SCHEMAS ============

export const insertMovementSchema = z.object({
  movementDate: z.string(), // timestamp as string
  movementType: z.string(),
  productType: z.string(),
  supplierId: z.string().nullable().optional(),
  fromWarehouseId: z.string().nullable().optional(),
  toWarehouseId: z.string(),
  quantityLiters: z.number().nullable().optional(),
  density: z.number().nullable().optional(),
  quantityKg: z.number(),
  purchasePrice: z.number().nullable().optional(),
  deliveryPrice: z.number().nullable().optional(),
  deliveryCost: z.number().nullable().optional(),
  totalCost: z.number().nullable().optional(),
  costPerKg: z.number().nullable().optional(),
  carrierId: z.string().nullable().optional(),
  vehicleNumber: z.string().nullable().optional(),
  trailerNumber: z.string().nullable().optional(),
  driverName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdById: z.string().nullable().optional(),
});

// ============ TYPES ============

export type Movement = typeof movement.$inferSelect;
export type InsertMovement = z.infer<typeof insertMovementSchema>;
