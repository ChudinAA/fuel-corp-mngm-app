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
import { users } from "@shared/schema";
import { warehouses } from "@shared/schema";
import { aircraftRefueling } from "@shared/schema";
import { movement } from "@shared/schema";
import { bases } from "@shared/schema";
import { opt } from "@shared/schema";

export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  servicePrice: decimal("service_price", { precision: 12, scale: 2 }),
  pvkjPrice: decimal("pvkj_price", { precision: 12, scale: 2 }),
  agentFee: decimal("agent_fee", { precision: 12, scale: 2 }),
  isWarehouse: boolean("is_warehouse").default(false),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  storageCost: decimal("storage_cost", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  deletedById: uuid("deleted_by_id").references(() => users.id),
}, (table) => ({
  nameIdx: index("suppliers_name_idx").on(table.name),
  isActiveIdx: index("suppliers_is_active_idx").on(table.isActive),
  isWarehouseIdx: index("suppliers_is_warehouse_idx").on(table.isWarehouse),
}));

// Junction table for supplier-base many-to-many relationship
export const supplierBases = pgTable(
  "supplier_bases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    baseId: uuid("base_id")
      .notNull()
      .references(() => bases.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => ({
    // Composite unique constraint to prevent duplicate supplier-base pairs
    uniqueSupplierBase: index("unique_supplier_base_idx").on(
      table.supplierId,
      table.baseId
    ),
  })
);

// ============ RELATIONS ============

export const suppliersRelations = relations(suppliers, ({ many, one }) => ({
  warehouse: one(warehouses, {
    fields: [suppliers.warehouseId],
    references: [warehouses.id],
  }),
  supplierBases: many(supplierBases),
  optDeals: many(opt),
  refuelings: many(aircraftRefueling),
  movements: many(movement),
}));

export const supplierBasesRelations = relations(supplierBases, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierBases.supplierId],
    references: [suppliers.id],
  }),
  base: one(bases, { fields: [supplierBases.baseId], references: [bases.id] }),
}));

// ============ INSERT SCHEMAS ============

export const insertSupplierSchema = createInsertSchema(suppliers)
  .omit({ id: true })
  .extend({
    baseIds: z.array(z.string().uuid()).optional(),
  });

// ============ TYPES ============

export type Supplier = typeof suppliers.$inferSelect & {
  baseIds?: string[];
};

export type InsertSupplier = z.infer<typeof insertSupplierSchema>;

export type SupplierBase = typeof supplierBases.$inferSelect;
