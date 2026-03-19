import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { users } from "../../users/entities/users";
import { bases, suppliers, customers } from "@shared/schema";
import {
  logisticsCarriers,
  logisticsDeliveryLocations,
} from "../../logistics/entities/logistics";
import { prices } from "../../prices/entities/prices";
import { PRODUCT_TYPE } from "@shared/constants";

export const transportation = pgTable(
  "transportation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => customers.id),
    dealDate: timestamp("deal_date", { mode: "string" }).notNull(),
    basis: text("basis"),
    customerBasis: text("customer_basis"),
    basisId: uuid("basis_id").references(() => bases.id),
    customerBasisId: uuid("customer_basis_id").references(() => bases.id),
    productType: text("product_type").default(PRODUCT_TYPE.KEROSENE),
    quantityLiters: decimal("quantity_liters", { precision: 15, scale: 2 }),
    density: decimal("density", { precision: 6, scale: 4 }),
    quantityKg: decimal("quantity_kg", { precision: 15, scale: 2 }).notNull(),
    inputMode: text("input_mode"),
    purchasePrice: decimal("purchase_price", { precision: 19, scale: 5 }),
    purchasePriceId: uuid("purchase_price_id").references(() => prices.id),
    purchasePriceIndex: integer("purchase_price_index").default(0),
    salePrice: decimal("sale_price", { precision: 19, scale: 5 }),
    salePriceId: uuid("sale_price_id").references(() => prices.id),
    salePriceIndex: integer("sale_price_index").default(0),
    purchaseAmount: decimal("purchase_amount", { precision: 15, scale: 2 }),
    saleAmount: decimal("sale_amount", { precision: 15, scale: 2 }),
    carrierId: uuid("carrier_id").references(() => logisticsCarriers.id),
    deliveryLocationId: uuid("delivery_location_id").references(
      () => logisticsDeliveryLocations.id,
    ),
    deliveryTariff: decimal("delivery_tariff", { precision: 19, scale: 5 }),
    deliveryCost: decimal("delivery_cost", { precision: 15, scale: 2 }),
    profit: decimal("profit", { precision: 15, scale: 2 }),
    notes: text("notes"),
    isDraft: boolean("is_draft").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
    deletedAt: timestamp("deleted_at", { mode: "string" }),
    deletedById: uuid("deleted_by_id").references(() => users.id),
  },
  (table) => ({
    dealDateIdx: index("transportation_deal_date_idx").on(table.dealDate),
    createdAtIdx: index("transportation_created_at_idx").on(table.createdAt),
    supplierBasisIdx: index("transportation_supplier_basis_idx").on(
      table.supplierId,
      table.basisId,
    ),
  }),
);

export const transportationRelations = relations(transportation, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [transportation.supplierId],
    references: [suppliers.id],
  }),
  buyer: one(customers, {
    fields: [transportation.buyerId],
    references: [customers.id],
  }),
  carrier: one(logisticsCarriers, {
    fields: [transportation.carrierId],
    references: [logisticsCarriers.id],
  }),
  deliveryLocation: one(logisticsDeliveryLocations, {
    fields: [transportation.deliveryLocationId],
    references: [logisticsDeliveryLocations.id],
  }),
  purchasePrice: one(prices, {
    fields: [transportation.purchasePriceId],
    references: [prices.id],
    relationName: "transportationPurchasePrice",
  }),
  salePrice: one(prices, {
    fields: [transportation.salePriceId],
    references: [prices.id],
    relationName: "transportationSalePrice",
  }),
  basis: one(bases, {
    fields: [transportation.basisId],
    references: [bases.id],
    relationName: "transportationBasis",
  }),
  customerBasis: one(bases, {
    fields: [transportation.customerBasisId],
    references: [bases.id],
    relationName: "transportationCustomerBasis",
  }),
  createdBy: one(users, {
    fields: [transportation.createdById],
    references: [users.id],
  }),
  updatedBy: one(users, {
    fields: [transportation.updatedById],
    references: [users.id],
  }),
}));

export const insertTransportationSchema = z
  .object({
    supplierId: z.string().nullable().optional(),
    buyerId: z.string().nullable().optional(),
    basis: z.string().nullable().optional(),
    customerBasis: z.string().nullable().optional(),
    basisId: z.string().nullable().optional(),
    customerBasisId: z.string().nullable().optional(),
    dealDate: z.string().nullable().optional(),
    productType: z.string().nullable().optional(),
    quantityLiters: z.number().nullable().optional(),
    density: z.number().nullable().optional(),
    quantityKg: z.number().nullable().optional(),
    inputMode: z.string().nullable().optional(),
    purchasePrice: z.number().nullable().optional(),
    purchasePriceId: z.string().nullable().optional(),
    purchasePriceIndex: z.number().nullable().optional(),
    salePrice: z.number().nullable().optional(),
    salePriceId: z.string().nullable().optional(),
    salePriceIndex: z.number().nullable().optional(),
    purchaseAmount: z.number().nullable().optional(),
    saleAmount: z.number().nullable().optional(),
    carrierId: z.string().nullable().optional(),
    deliveryLocationId: z.string().nullable().optional(),
    deliveryTariff: z.number().nullable().optional(),
    deliveryCost: z.number().nullable().optional(),
    profit: z.number().nullable().optional(),
    notes: z.string().nullable().optional(),
    isDraft: z.boolean().default(false),
    createdById: z.string().nullable().optional(),
    updatedById: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.isDraft) {
      if (!data.supplierId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Поставщик обязателен",
          path: ["supplierId"],
        });
      }
      if (!data.buyerId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Покупатель обязателен",
          path: ["buyerId"],
        });
      }
      if (!data.productType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Тип продукта обязателен",
          path: ["productType"],
        });
      }
      if (!data.dealDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Дата сделки обязательна",
          path: ["dealDate"],
        });
      }
      if (data.quantityKg === undefined || data.quantityKg === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Количество (кг) обязательно",
          path: ["quantityKg"],
        });
      }
    }
  });

export type Transportation = typeof transportation.$inferSelect;
export type InsertTransportation = z.infer<typeof insertTransportationSchema>;
