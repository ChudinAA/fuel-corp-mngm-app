import { pgTable, uuid, text, decimal, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { warehouses } from "./warehouses";

export const warehouseServices = pgTable(
  "warehouse_services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    serviceType: text("service_type").notNull(),
    serviceValue: decimal("service_value", { precision: 15, scale: 6 }).notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
  },
  (table) => ({
    warehouseIdIdx: index("warehouse_services_warehouse_id_idx").on(table.warehouseId),
  }),
);

export const warehouseServicesRelations = relations(warehouseServices, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [warehouseServices.warehouseId],
    references: [warehouses.id],
  }),
}));

export const insertWarehouseServiceSchema = createInsertSchema(warehouseServices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WarehouseService = typeof warehouseServices.$inferSelect;
export type InsertWarehouseService = z.infer<typeof insertWarehouseServiceSchema>;
