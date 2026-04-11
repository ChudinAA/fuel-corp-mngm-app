import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  decimal,
  boolean,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";

// ЖД Станции
export const railwayStations = pgTable(
  "railway_stations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    code: text("code"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
    deletedAt: timestamp("deleted_at", { mode: "string" }),
    deletedById: uuid("deleted_by_id").references(() => users.id),
  },
  (table) => ({
    nameIdx: index("railway_stations_name_idx").on(table.name),
    isActiveIdx: index("railway_stations_is_active_idx").on(table.isActive),
  }),
);

export const railwayStationsRelations = relations(railwayStations, ({ one }) => ({
  createdBy: one(users, {
    fields: [railwayStations.createdById],
    references: [users.id],
  }),
}));

export const insertRailwayStationSchema = createInsertSchema(railwayStations)
  .omit({ id: true, createdAt: true })
  .extend({
    name: z.string().min(1, "Название обязательно"),
    code: z.string().nullable().optional(),
  });

export type RailwayStation = typeof railwayStations.$inferSelect;
export type InsertRailwayStation = z.infer<typeof insertRailwayStationSchema>;

// Тарифы ЖД доставки
export const railwayTariffs = pgTable(
  "railway_tariffs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    zoneName: text("zone_name").notNull(),
    pricePerTon: decimal("price_per_ton", { precision: 15, scale: 2 }).notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
    deletedAt: timestamp("deleted_at", { mode: "string" }),
    deletedById: uuid("deleted_by_id").references(() => users.id),
  },
  (table) => ({
    zoneNameIdx: index("railway_tariffs_zone_name_idx").on(table.zoneName),
    isActiveIdx: index("railway_tariffs_is_active_idx").on(table.isActive),
  }),
);

export const railwayTariffsRelations = relations(railwayTariffs, ({ one }) => ({
  createdBy: one(users, {
    fields: [railwayTariffs.createdById],
    references: [users.id],
  }),
}));

export const insertRailwayTariffSchema = createInsertSchema(railwayTariffs)
  .omit({ id: true, createdAt: true })
  .extend({
    zoneName: z.string().min(1, "Название зоны обязательно"),
    pricePerTon: z.union([z.string(), z.number()]).transform(v => String(v)),
  });

export type RailwayTariff = typeof railwayTariffs.$inferSelect;
export type InsertRailwayTariff = z.infer<typeof insertRailwayTariffSchema>;
