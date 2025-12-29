
import { pgTable, uuid, text, timestamp, numeric, date, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "../../users/entities/users";

// Cashflow transactions table
export const cashflowTransactions = pgTable("cashflow_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionDate: timestamp("transaction_date").notNull(),
  category: text("category").notNull(), // income, expense, transfer
  subcategory: text("subcategory"), // salary, fuel_purchase, services, etc.
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").default("RUB").notNull(),
  description: text("description"),
  counterparty: text("counterparty"),
  paymentMethod: text("payment_method"), // cash, bank_transfer, card
  referenceType: text("reference_type"), // opt, refueling, movement, etc.
  referenceId: uuid("reference_id"),
  isPlanned: boolean("is_planned").default(false),
  notes: text("notes"),
  
  // Audit fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  deletedById: uuid("deleted_by_id").references(() => users.id),
}, (table) => ({
  dateIdx: index("cashflow_date_idx").on(table.transactionDate),
  categoryIdx: index("cashflow_category_idx").on(table.category),
  referenceIdx: index("cashflow_reference_idx").on(table.referenceType, table.referenceId),
}));

// Payment calendar table
export const paymentCalendar = pgTable("payment_calendar", {
  id: uuid("id").primaryKey().defaultRandom(),
  dueDate: date("due_date").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").default("RUB").notNull(),
  category: text("category").notNull(), // payable, receivable
  counterparty: text("counterparty"),
  status: text("status").default("pending").notNull(), // pending, paid, overdue, cancelled
  paidDate: date("paid_date"),
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }),
  referenceType: text("reference_type"),
  referenceId: uuid("reference_id"),
  isRecurring: boolean("is_recurring").default(false),
  recurringPattern: jsonb("recurring_pattern"), // {frequency: 'monthly', interval: 1}
  notes: text("notes"),
  
  // Audit fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  deletedById: uuid("deleted_by_id").references(() => users.id),
}, (table) => ({
  dueDateIdx: index("payment_due_date_idx").on(table.dueDate),
  statusIdx: index("payment_status_idx").on(table.status),
  categoryIdx: index("payment_category_idx").on(table.category),
}));

// Price calculation templates
export const priceCalculations = pgTable("price_calculations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  productType: text("product_type").notNull(), // kerosene, pvkj, service
  
  // Cost components
  purchasePrice: numeric("purchase_price", { precision: 15, scale: 2 }),
  deliveryCost: numeric("delivery_cost", { precision: 15, scale: 2 }),
  storageCost: numeric("storage_cost", { precision: 15, scale: 2 }),
  serviceFee: numeric("service_fee", { precision: 15, scale: 2 }),
  agentFee: numeric("agent_fee", { precision: 15, scale: 2 }),
  otherCosts: numeric("other_costs", { precision: 15, scale: 2 }),
  
  // Markup configuration
  markupType: text("markup_type").default("percentage"), // percentage, fixed
  markupValue: numeric("markup_value", { precision: 15, scale: 2 }),
  
  // Calculated results
  totalCost: numeric("total_cost", { precision: 15, scale: 2 }),
  sellingPrice: numeric("selling_price", { precision: 15, scale: 2 }),
  margin: numeric("margin", { precision: 15, scale: 2 }),
  marginPercentage: numeric("margin_percentage", { precision: 5, scale: 2 }),
  
  isTemplate: boolean("is_template").default(false),
  isActive: boolean("is_active").default(true),
  
  // Audit fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  deletedById: uuid("deleted_by_id").references(() => users.id),
}, (table) => ({
  productTypeIdx: index("price_calc_product_type_idx").on(table.productType),
  activeIdx: index("price_calc_active_idx").on(table.isActive),
}));

// Relations
export const cashflowTransactionsRelations = relations(cashflowTransactions, ({ one }) => ({
  createdBy: one(users, {
    fields: [cashflowTransactions.createdById],
    references: [users.id],
  }),
  updatedBy: one(users, {
    fields: [cashflowTransactions.updatedById],
    references: [users.id],
  }),
}));

export const paymentCalendarRelations = relations(paymentCalendar, ({ one }) => ({
  createdBy: one(users, {
    fields: [paymentCalendar.createdById],
    references: [users.id],
  }),
  updatedBy: one(users, {
    fields: [paymentCalendar.updatedById],
    references: [users.id],
  }),
}));

export const priceCalculationsRelations = relations(priceCalculations, ({ one }) => ({
  createdBy: one(users, {
    fields: [priceCalculations.createdById],
    references: [users.id],
  }),
  updatedBy: one(users, {
    fields: [priceCalculations.updatedById],
    references: [users.id],
  }),
}));
