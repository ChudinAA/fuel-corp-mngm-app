import { relations, sql } from "drizzle-orm";
import { pgTable, uuid, text, date, timestamp, index, check, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";
import { suppliers } from "../../suppliers/entities/suppliers";
import { customers } from "../../customers/entities/customers";
import { logisticsCarriers } from "../../logistics/entities/logistics";

export const counterpartyContracts = pgTable(
  "counterparty_contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    id1c: text("id_1c"),
    contractName: text("contract_name").notNull(),
    contractNumber: text("contract_number").notNull(),
    contractDate: date("contract_date").notNull(),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    buyerId: uuid("buyer_id").references(() => customers.id),
    carrierId: uuid("carrier_id").references(() => logisticsCarriers.id),
    parentContractId: uuid("parent_contract_id"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }),
    createdById: uuid("created_by_id").references(() => users.id),
    updatedById: uuid("updated_by_id").references(() => users.id),
    deletedAt: timestamp("deleted_at", { mode: "string" }),
    deletedById: uuid("deleted_by_id").references(() => users.id),
  },
  (table) => ({
    supplierIdx: index("counterparty_contracts_supplier_idx").on(table.supplierId),
    buyerIdx: index("counterparty_contracts_buyer_idx").on(table.buyerId),
    carrierIdx: index("counterparty_contracts_carrier_idx").on(table.carrierId),
    parentIdx: index("counterparty_contracts_parent_idx").on(table.parentContractId),
    parentFk: foreignKey({
      columns: [table.parentContractId],
      foreignColumns: [table.id],
      name: "counterparty_contracts_parent_fk",
    }),
    counterpartyCheck: check(
      "counterparty_contracts_one_counterparty_check",
      sql`num_nonnulls(${table.supplierId}, ${table.buyerId}, ${table.carrierId}) = 1`,
    ),
  }),
);

export const counterpartyContractsRelations = relations(counterpartyContracts, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [counterpartyContracts.supplierId], references: [suppliers.id] }),
  buyer: one(customers, { fields: [counterpartyContracts.buyerId], references: [customers.id] }),
  carrier: one(logisticsCarriers, { fields: [counterpartyContracts.carrierId], references: [logisticsCarriers.id] }),
  parent: one(counterpartyContracts, {
    fields: [counterpartyContracts.parentContractId],
    references: [counterpartyContracts.id],
    relationName: "contractAppendices",
  }),
  appendices: many(counterpartyContracts, { relationName: "contractAppendices" }),
  createdBy: one(users, { fields: [counterpartyContracts.createdById], references: [users.id] }),
  updatedBy: one(users, { fields: [counterpartyContracts.updatedById], references: [users.id] }),
}));

export const counterpartyContractBaseSchema = createInsertSchema(counterpartyContracts)
  .omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, deletedById: true })
  .extend({
    supplierId: z.string().uuid().nullable().optional(),
    buyerId: z.string().uuid().nullable().optional(),
    carrierId: z.string().uuid().nullable().optional(),
    parentContractId: z.string().uuid().nullable().optional(),
    contractDate: z.string().min(1, "Укажите дату договора"),
  });

export const insertCounterpartyContractSchema = counterpartyContractBaseSchema.superRefine((data, ctx) => {
    const count = [data.supplierId, data.buyerId, data.carrierId].filter(Boolean).length;
    if (count !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Выберите ровно одного контрагента",
        path: ["supplierId"],
      });
    }
  });

export type CounterpartyContract = typeof counterpartyContracts.$inferSelect;
export type InsertCounterpartyContract = z.infer<typeof insertCounterpartyContractSchema>;
