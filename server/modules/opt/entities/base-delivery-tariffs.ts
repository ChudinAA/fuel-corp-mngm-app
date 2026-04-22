import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  decimal,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { bases } from "../../bases/entities/bases";

export const baseDeliveryTariffs = pgTable("base_delivery_tariffs", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromBaseId: uuid("from_base_id").references(() => bases.id),
  toBaseId: uuid("to_base_id").references(() => bases.id),
  pricePerTon: decimal("price_per_ton", { precision: 19, scale: 6 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
});

export const baseDeliveryTariffsRelations = relations(baseDeliveryTariffs, ({ one }) => ({
  fromBase: one(bases, { fields: [baseDeliveryTariffs.fromBaseId], references: [bases.id], relationName: "tariffFromBase" }),
  toBase: one(bases, { fields: [baseDeliveryTariffs.toBaseId], references: [bases.id], relationName: "tariffToBase" }),
}));

export const insertBaseDeliveryTariffSchema = createInsertSchema(baseDeliveryTariffs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export type InsertBaseDeliveryTariff = z.infer<typeof insertBaseDeliveryTariffSchema>;
export type BaseDeliveryTariff = typeof baseDeliveryTariffs.$inferSelect;
