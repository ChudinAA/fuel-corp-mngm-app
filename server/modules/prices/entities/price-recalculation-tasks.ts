import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { prices } from "./prices";

export const PRICE_RECALC_DEAL_TYPE = {
  OPT: "opt",
  REFUELING: "refueling",
  MOVEMENT: "movement",
  TRANSPORTATION: "transportation",
} as const;

export const PRICE_RECALC_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  DONE: "done",
  SKIPPED: "skipped",
  FAILED: "failed",
} as const;

export const priceRecalculationTasks = pgTable(
  "price_recalculation_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    priceId: uuid("price_id").notNull().references(() => prices.id),
    dealType: text("deal_type").notNull(),
    dealId: uuid("deal_id").notNull(),
    status: text("status").notNull().default(PRICE_RECALC_STATUS.PENDING),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { mode: "string" }),
    errorMessage: text("error_message"),
  },
  (table) => ({
    priceIdIdx: index("idx_price_recalc_tasks_price_id_drizzle").on(table.priceId),
    statusIdx: index("idx_price_recalc_tasks_status_drizzle").on(table.status),
  }),
);

export const insertPriceRecalculationTaskSchema = createInsertSchema(priceRecalculationTasks).omit({ id: true });

export type PriceRecalculationTask = typeof priceRecalculationTasks.$inferSelect;
export type InsertPriceRecalculationTask = z.infer<typeof insertPriceRecalculationTaskSchema>;
