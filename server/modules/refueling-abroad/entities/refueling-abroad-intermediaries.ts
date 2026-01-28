import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  decimal,
  uuid,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { suppliers } from "@shared/schema";
import { refuelingAbroad } from "./refueling-abroad";

export const refuelingAbroadIntermediaries = pgTable(
  "refueling_abroad_intermediaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    refuelingAbroadId: uuid("refueling_abroad_id")
      .notNull()
      .references(() => refuelingAbroad.id, { onDelete: "cascade" }),
    intermediaryId: uuid("intermediary_id")
      .notNull()
      .references(() => suppliers.id),
    orderIndex: integer("order_index").default(0).notNull(),
    
    commissionFormula: text("commission_formula"),
    commissionUsd: decimal("commission_usd", { precision: 15, scale: 4 }),
    commissionRub: decimal("commission_rub", { precision: 15, scale: 2 }),
    
    notes: text("notes"),
  },
  (table) => ({
    refuelingAbroadIdx: index("rai_refueling_abroad_idx").on(table.refuelingAbroadId),
    intermediaryIdx: index("rai_intermediary_idx").on(table.intermediaryId),
    orderIdx: index("rai_order_idx").on(table.refuelingAbroadId, table.orderIndex),
  }),
);

export const refuelingAbroadIntermediariesRelations = relations(
  refuelingAbroadIntermediaries,
  ({ one }) => ({
    refuelingAbroad: one(refuelingAbroad, {
      fields: [refuelingAbroadIntermediaries.refuelingAbroadId],
      references: [refuelingAbroad.id],
    }),
    intermediary: one(suppliers, {
      fields: [refuelingAbroadIntermediaries.intermediaryId],
      references: [suppliers.id],
    }),
  }),
);

export const insertRefuelingAbroadIntermediarySchema = createInsertSchema(refuelingAbroadIntermediaries)
  .omit({ id: true })
  .extend({
    refuelingAbroadId: z.string(),
    intermediaryId: z.string(),
    orderIndex: z.number().optional().default(0),
    commissionFormula: z.string().nullable().optional(),
    commissionUsd: z.number().nullable().optional(),
    commissionRub: z.number().nullable().optional(),
    notes: z.string().nullable().optional(),
  });

export type RefuelingAbroadIntermediary = typeof refuelingAbroadIntermediaries.$inferSelect;
export type InsertRefuelingAbroadIntermediary = z.infer<typeof insertRefuelingAbroadIntermediarySchema>;
