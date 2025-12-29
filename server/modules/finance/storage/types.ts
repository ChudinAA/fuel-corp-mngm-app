
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { cashflowTransactions, paymentCalendar, priceCalculations } from "../entities/finance";

export type CashflowTransaction = InferSelectModel<typeof cashflowTransactions>;
export type InsertCashflowTransaction = InferInsertModel<typeof cashflowTransactions>;

export type PaymentCalendarItem = InferSelectModel<typeof paymentCalendar>;
export type InsertPaymentCalendarItem = InferInsertModel<typeof paymentCalendar>;

export type PriceCalculation = InferSelectModel<typeof priceCalculations>;
export type InsertPriceCalculation = InferInsertModel<typeof priceCalculations>;
