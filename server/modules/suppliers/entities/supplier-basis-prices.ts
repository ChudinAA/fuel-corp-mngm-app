import { relations } from "drizzle-orm";
import {
  pgTable,
  decimal,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { suppliers } from "./suppliers";
import { bases } from "../../bases/entities/bases";
import { users } from "../../users/entities/users";

export const supplierBasisPrices = pgTable(
  "supplier_basis_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    basisId: uuid("basis_id")
      .notNull()
      .references(() => bases.id, { onDelete: "cascade" }),
    servicePrice: decimal("service_price", { precision: 12, scale: 6 }),
    pvkjPrice: decimal("pvkj_price", { precision: 12, scale: 6 }),
    agentFee: decimal("agent_fee", { precision: 12, scale: 6 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
  },
  (table) => ({
    supplierBasisIdx: index("supplier_basis_prices_supplier_basis_idx").on(
      table.supplierId,
      table.basisId
    ),
    supplierIdx: index("supplier_basis_prices_supplier_idx").on(table.supplierId),
    basisIdx: index("supplier_basis_prices_basis_idx").on(table.basisId),
  })
);

export const supplierBasisPricesRelations = relations(supplierBasisPrices, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierBasisPrices.supplierId],
    references: [suppliers.id],
  }),
  basis: one(bases, {
    fields: [supplierBasisPrices.basisId],
    references: [bases.id],
  }),
  createdBy: one(users, {
    fields: [supplierBasisPrices.createdById],
    references: [users.id],
    relationName: "supplierBasisPriceCreatedBy",
  }),
}));

export const insertSupplierBasisPriceSchema = createInsertSchema(supplierBasisPrices)
  .omit({ id: true, createdAt: true })
  .extend({
    supplierId: z.string().min(1),
    basisId: z.string().min(1),
    servicePrice: z.coerce.number().optional().nullable(),
    pvkjPrice: z.coerce.number().optional().nullable(),
    agentFee: z.coerce.number().optional().nullable(),
  });

export type SupplierBasisPrice = typeof supplierBasisPrices.$inferSelect;
export type InsertSupplierBasisPrice = z.infer<typeof insertSupplierBasisPriceSchema>;
