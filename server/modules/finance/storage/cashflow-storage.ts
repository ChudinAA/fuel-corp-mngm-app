
import { db } from "../../../db";
import { cashflowTransactions } from "../entities/finance";
import type { InsertCashflowTransaction, CashflowTransaction } from "./types";
import { eq, and, isNull, desc, gte, lte, sql } from "drizzle-orm";

export async function createCashflowTransaction(data: InsertCashflowTransaction) {
  const [transaction] = await db.insert(cashflowTransactions).values(data).returning();
  return transaction;
}

export async function getCashflowTransactions(filters?: {
  startDate?: Date;
  endDate?: Date;
  category?: string;
}) {
  let query = db.select().from(cashflowTransactions).where(isNull(cashflowTransactions.deletedAt));

  if (filters?.startDate) {
    query = query.where(gte(cashflowTransactions.transactionDate, filters.startDate)) as typeof query;
  }
  if (filters?.endDate) {
    query = query.where(lte(cashflowTransactions.transactionDate, filters.endDate)) as typeof query;
  }
  if (filters?.category) {
    query = query.where(eq(cashflowTransactions.category, filters.category)) as typeof query;
  }

  return await query.orderBy(desc(cashflowTransactions.transactionDate));
}

export async function getCashflowTransactionById(id: string) {
  const [transaction] = await db
    .select()
    .from(cashflowTransactions)
    .where(and(eq(cashflowTransactions.id, id), isNull(cashflowTransactions.deletedAt)));
  return transaction;
}

export async function updateCashflowTransaction(id: string, data: Partial<InsertCashflowTransaction>) {
  const [updated] = await db
    .update(cashflowTransactions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(cashflowTransactions.id, id))
    .returning();
  return updated;
}

export async function deleteCashflowTransaction(id: string, userId: string) {
  const [deleted] = await db
    .update(cashflowTransactions)
    .set({ deletedAt: new Date(), deletedById: userId })
    .where(eq(cashflowTransactions.id, id))
    .returning();
  return deleted;
}

export async function getCashflowSummary(startDate: Date, endDate: Date) {
  const result = await db
    .select({
      category: cashflowTransactions.category,
      total: sql<number>`COALESCE(SUM(${cashflowTransactions.amount}::numeric), 0)`,
    })
    .from(cashflowTransactions)
    .where(
      and(
        isNull(cashflowTransactions.deletedAt),
        gte(cashflowTransactions.transactionDate, startDate),
        lte(cashflowTransactions.transactionDate, endDate)
      )
    )
    .groupBy(cashflowTransactions.category);

  return result;
}
