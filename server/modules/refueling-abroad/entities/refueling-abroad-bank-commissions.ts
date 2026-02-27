import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  decimal,
  timestamp,
  uuid,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { refuelingAbroad } from "./refueling-abroad";

export const refuelingAbroadBankCommissions = pgTable(
  "refueling_abroad_bank_commissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    refuelingAbroadId: uuid("refueling_abroad_id")
      .notNull()
      .references(() => refuelingAbroad.id, { onDelete: "cascade" }),
    chainPosition: integer("chain_position").default(0).notNull(),
    commissionType: text("commission_type").notNull().default("percent"),
    percent: decimal("percent", { precision: 10, scale: 4 }),
    minValue: decimal("min_value", { precision: 15, scale: 4 }),
    bankName: text("bank_name"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => ({
    refuelingAbroadIdx: index("rabc_refueling_abroad_idx").on(
      table.refuelingAbroadId,
    ),
    chainPositionIdx: index("rabc_chain_position_idx").on(
      table.refuelingAbroadId,
      table.chainPosition,
    ),
  }),
);

export const refuelingAbroadBankCommissionsRelations = relations(
  refuelingAbroadBankCommissions,
  ({ one }) => ({
    refuelingAbroad: one(refuelingAbroad, {
      fields: [refuelingAbroadBankCommissions.refuelingAbroadId],
      references: [refuelingAbroad.id],
    }),
  }),
);

export const insertRefuelingAbroadBankCommissionSchema = createInsertSchema(
  refuelingAbroadBankCommissions,
)
  .omit({ id: true, createdAt: true })
  .extend({
    refuelingAbroadId: z.string(),
    chainPosition: z.number().default(0),
    commissionType: z.enum(["percent", "percent_min"]).default("percent"),
    percent: z.number().nullable().optional(),
    minValue: z.number().nullable().optional(),
    bankName: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  });

export type RefuelingAbroadBankCommission =
  typeof refuelingAbroadBankCommissions.$inferSelect;
export type InsertRefuelingAbroadBankCommission = z.infer<
  typeof insertRefuelingAbroadBankCommissionSchema
>;
