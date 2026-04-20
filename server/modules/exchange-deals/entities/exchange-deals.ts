import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  decimal,
  boolean,
  timestamp,
  date,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";
import { suppliers } from "../../suppliers/entities/suppliers";
import { customers } from "../../customers/entities/customers";
import { railwayStations, railwayTariffs } from "../../railway/entities/railway";

export const exchangeDeals = pgTable(
  "exchange_deals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dealNumber: text("deal_number"),
    dealDate: date("deal_date"),
    departureStationId: uuid("departure_station_id").references(() => railwayStations.id),
    destinationStationId: uuid("destination_station_id").references(() => railwayStations.id),
    buyerId: uuid("buyer_id").references(() => customers.id),
    paymentDate: date("payment_date"),
    pricePerTon: decimal("price_per_ton", { precision: 15, scale: 2 }),
    weightTon: decimal("weight_ton", { precision: 15, scale: 3 }),
    actualWeightTon: decimal("actual_weight_ton", { precision: 15, scale: 3 }),
    deliveryTariffId: uuid("delivery_tariff_id").references(() => railwayTariffs.id),
    wagonDepartureDate: date("wagon_departure_date"),
    plannedDeliveryDate: date("planned_delivery_date"),
    sellerId: uuid("seller_id").references(() => suppliers.id),
    wagonNumbers: text("wagon_numbers"),
    isDraft: boolean("is_draft").default(false),
    notes: text("notes"),
    // Поставщик-склад как покупатель (мы закупаем топливо себе на склад)
    buyerSupplierId: uuid("buyer_supplier_id").references(() => suppliers.id),
    // Подтверждение получения на складе
    isReceivedAtWarehouse: boolean("is_received_at_warehouse").default(false),
    // Ссылка на созданное Перемещение
    movementId: uuid("movement_id"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
    deletedAt: timestamp("deleted_at", { mode: "string" }),
    deletedById: uuid("deleted_by_id").references(() => users.id),
  },
  (table) => ({
    dealDateIdx: index("exchange_deals_deal_date_idx").on(table.dealDate),
    sellerIdIdx: index("exchange_deals_seller_id_idx").on(table.sellerId),
    buyerIdIdx: index("exchange_deals_buyer_id_idx").on(table.buyerId),
    isDraftIdx: index("exchange_deals_is_draft_idx").on(table.isDraft),
    deletedAtIdx: index("exchange_deals_deleted_at_idx").on(table.deletedAt),
    buyerSupplierIdx: index("exchange_deals_buyer_supplier_idx").on(table.buyerSupplierId),
  }),
);

export const exchangeDealsRelations = relations(exchangeDeals, ({ one }) => ({
  buyer: one(customers, {
    fields: [exchangeDeals.buyerId],
    references: [customers.id],
  }),
  seller: one(suppliers, {
    fields: [exchangeDeals.sellerId],
    references: [suppliers.id],
  }),
  buyerSupplier: one(suppliers, {
    fields: [exchangeDeals.buyerSupplierId],
    references: [suppliers.id],
    relationName: "buyerSupplier",
  }),
  departureStation: one(railwayStations, {
    fields: [exchangeDeals.departureStationId],
    references: [railwayStations.id],
    relationName: "departureStation",
  }),
  destinationStation: one(railwayStations, {
    fields: [exchangeDeals.destinationStationId],
    references: [railwayStations.id],
    relationName: "destinationStation",
  }),
  deliveryTariff: one(railwayTariffs, {
    fields: [exchangeDeals.deliveryTariffId],
    references: [railwayTariffs.id],
  }),
  createdBy: one(users, {
    fields: [exchangeDeals.createdById],
    references: [users.id],
  }),
}));

export const insertExchangeDealSchema = createInsertSchema(exchangeDeals)
  .omit({ id: true, createdAt: true })
  .extend({
    dealNumber: z.string().nullable().optional(),
    dealDate: z.string().nullable().optional(),
    departureStationId: z.string().uuid().nullable().optional(),
    destinationStationId: z.string().uuid().nullable().optional(),
    buyerId: z.string().uuid().nullable().optional(),
    paymentDate: z.string().nullable().optional(),
    pricePerTon: z.union([z.string(), z.number()]).transform(v => v !== null && v !== undefined && v !== "" ? String(v) : null).nullable().optional(),
    weightTon: z.union([z.string(), z.number()]).transform(v => v !== null && v !== undefined && v !== "" ? String(v) : null).nullable().optional(),
    actualWeightTon: z.union([z.string(), z.number()]).transform(v => v !== null && v !== undefined && v !== "" ? String(v) : null).nullable().optional(),
    deliveryTariffId: z.string().uuid().nullable().optional(),
    wagonDepartureDate: z.string().nullable().optional(),
    plannedDeliveryDate: z.string().nullable().optional(),
    sellerId: z.string().uuid().nullable().optional(),
    wagonNumbers: z.string().nullable().optional(),
    isDraft: z.boolean().default(false),
    notes: z.string().nullable().optional(),
    buyerSupplierId: z.string().uuid().nullable().optional(),
    isReceivedAtWarehouse: z.boolean().default(false),
    movementId: z.string().uuid().nullable().optional(),
  });

export type ExchangeDeal = typeof exchangeDeals.$inferSelect;
export type InsertExchangeDeal = z.infer<typeof insertExchangeDealSchema>;
