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
import { opt } from "../../opt/entities/opt";
import { movement } from "../../movement/entities/movement";
import { deliveryCost } from "../../delivery/entities/delivery";

// Перевозчики
export const logisticsCarriers = pgTable("logistics_carriers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  inn: text("inn"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
}, (table) => ({
  nameIdx: index("logistics_carriers_name_idx").on(table.name),
  isActiveIdx: index("logistics_carriers_is_active_idx").on(table.isActive),
}));

// Места доставки
export const logisticsDeliveryLocations = pgTable(
  "logistics_delivery_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    address: text("address"),
    notes: text("notes"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
  }
);

// Транспорт
export const logisticsVehicles = pgTable("logistics_vehicles", {
  id: uuid("id").defaultRandom().primaryKey(),
  carrierId: uuid("carrier_id").references(() => logisticsCarriers.id, {
    onDelete: "set null",
  }),
  regNumber: text("reg_number").notNull(),
  model: text("model"),
  capacityKg: decimal("capacity_kg", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
}, (table) => ({
  carrierIdx: index("logistics_vehicles_carrier_idx").on(table.carrierId),
  regNumberIdx: index("logistics_vehicles_reg_number_idx").on(table.regNumber),
  isActiveIdx: index("logistics_vehicles_is_active_idx").on(table.isActive),
}));

// Прицепы
export const logisticsTrailers = pgTable("logistics_trailers", {
  id: uuid("id").defaultRandom().primaryKey(),
  carrierId: uuid("carrier_id").references(() => logisticsCarriers.id, {
    onDelete: "set null",
  }),
  regNumber: text("reg_number").notNull(),
  capacityKg: decimal("capacity_kg", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// Водители
export const logisticsDrivers = pgTable("logistics_drivers", {
  id: uuid("id").defaultRandom().primaryKey(),
  carrierId: uuid("carrier_id").references(() => logisticsCarriers.id, {
    onDelete: "set null",
  }),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  licenseNumber: text("license_number"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// ============ RELATIONS ============

export const logisticsCarriersRelations = relations(
  logisticsCarriers,
  ({ many }) => ({
    vehicles: many(logisticsVehicles),
    trailers: many(logisticsTrailers),
    drivers: many(logisticsDrivers),
    optDeals: many(opt),
    movements: many(movement),
    deliveryCosts: many(deliveryCost),
  })
);

export const logisticsDeliveryLocationsRelations = relations(
  logisticsDeliveryLocations,
  ({ many }) => ({
    optDeals: many(opt),
  })
);

export const logisticsVehiclesRelations = relations(
  logisticsVehicles,
  ({ one }) => ({
    carrier: one(logisticsCarriers, {
      fields: [logisticsVehicles.carrierId],
      references: [logisticsCarriers.id],
    }),
  })
);

export const logisticsTrailersRelations = relations(
  logisticsTrailers,
  ({ one }) => ({
    carrier: one(logisticsCarriers, {
      fields: [logisticsTrailers.carrierId],
      references: [logisticsCarriers.id],
    }),
  })
);

export const logisticsDriversRelations = relations(
  logisticsDrivers,
  ({ one }) => ({
    carrier: one(logisticsCarriers, {
      fields: [logisticsDrivers.carrierId],
      references: [logisticsCarriers.id],
    }),
  })
);

// ============ INSERT SCHEMAS ============

export const insertLogisticsCarrierSchema = createInsertSchema(
  logisticsCarriers
).omit({ id: true });
export const insertLogisticsDeliveryLocationSchema = createInsertSchema(
  logisticsDeliveryLocations
).omit({ id: true });
export const insertLogisticsVehicleSchema = createInsertSchema(
  logisticsVehicles
).omit({ id: true });
export const insertLogisticsTrailerSchema = createInsertSchema(
  logisticsTrailers
).omit({ id: true });
export const insertLogisticsDriverSchema = createInsertSchema(
  logisticsDrivers
).omit({ id: true });

// ============ TYPES ============

export type LogisticsCarrier = typeof logisticsCarriers.$inferSelect;
export type InsertLogisticsCarrier = z.infer<
  typeof insertLogisticsCarrierSchema
>;

export type LogisticsDeliveryLocation =
  typeof logisticsDeliveryLocations.$inferSelect;
export type InsertLogisticsDeliveryLocation = z.infer<
  typeof insertLogisticsDeliveryLocationSchema
>;

export type LogisticsVehicle = typeof logisticsVehicles.$inferSelect;
export type InsertLogisticsVehicle = z.infer<
  typeof insertLogisticsVehicleSchema
>;

export type LogisticsTrailer = typeof logisticsTrailers.$inferSelect;
export type InsertLogisticsTrailer = z.infer<
  typeof insertLogisticsTrailerSchema
>;

export type LogisticsDriver = typeof logisticsDrivers.$inferSelect;
export type InsertLogisticsDriver = z.infer<typeof insertLogisticsDriverSchema>;
