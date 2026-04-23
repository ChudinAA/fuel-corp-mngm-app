import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  boolean,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";
import { bases } from "../../bases/entities/bases";
import { customers } from "../../customers/entities/customers";

export const aircraft = pgTable(
  "aircraft",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
    deletedAt: timestamp("deleted_at", { mode: "string" }),
    deletedById: uuid("deleted_by_id").references(() => users.id),
  },
  (table) => ({
    nameIdx: index("aircraft_name_idx").on(table.name),
    isActiveIdx: index("aircraft_is_active_idx").on(table.isActive),
  })
);

export const flightNumbers = pgTable(
  "flight_numbers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    number: text("number").notNull(),
    basisId: uuid("basis_id").references(() => bases.id, { onDelete: "set null" }),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
    deletedAt: timestamp("deleted_at", { mode: "string" }),
    deletedById: uuid("deleted_by_id").references(() => users.id),
  },
  (table) => ({
    numberIdx: index("flight_numbers_number_idx").on(table.number),
    basisIdx: index("flight_numbers_basis_idx").on(table.basisId),
    isActiveIdx: index("flight_numbers_is_active_idx").on(table.isActive),
  })
);

export const aircraftRelations = relations(aircraft, ({ one }) => ({
  customer: one(customers, {
    fields: [aircraft.customerId],
    references: [customers.id],
  }),
  createdBy: one(users, {
    fields: [aircraft.createdById],
    references: [users.id],
    relationName: "aircraftCreatedBy",
  }),
  updatedBy: one(users, {
    fields: [aircraft.updatedById],
    references: [users.id],
    relationName: "aircraftUpdatedBy",
  }),
}));

export const flightNumbersRelations = relations(flightNumbers, ({ one }) => ({
  basis: one(bases, {
    fields: [flightNumbers.basisId],
    references: [bases.id],
  }),
  createdBy: one(users, {
    fields: [flightNumbers.createdById],
    references: [users.id],
    relationName: "flightNumberCreatedBy",
  }),
  updatedBy: one(users, {
    fields: [flightNumbers.updatedById],
    references: [users.id],
    relationName: "flightNumberUpdatedBy",
  }),
}));

export const insertAircraftSchema = createInsertSchema(aircraft)
  .omit({ id: true, createdAt: true })
  .extend({
    name: z.string().min(1, "Укажите бортовой номер"),
    customerId: z.string().uuid().nullable().optional(),
  });

export const insertFlightNumberSchema = createInsertSchema(flightNumbers)
  .omit({ id: true, createdAt: true })
  .extend({
    number: z.string().min(1, "Укажите номер рейса"),
    basisId: z.string().nullable().optional(),
  });

export type Aircraft = typeof aircraft.$inferSelect;
export type InsertAircraft = z.infer<typeof insertAircraftSchema>;
export type FlightNumber = typeof flightNumbers.$inferSelect;
export type InsertFlightNumber = z.infer<typeof insertFlightNumberSchema>;
