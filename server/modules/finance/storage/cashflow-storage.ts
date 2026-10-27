
import { db } from "../../../db";
import { cashflowTransactions } from "../entities/finance";
import type { InsertCashflowTransaction, CashflowTransaction } from "./types";
import { eq, and, isNull, desc, gte, lte, sql } from "drizzle-orm";

export interface ICashflowStorage {
  getCashflowTransaction(id: string): Promise<CashflowTransaction | undefined>;
  getCashflowTransactions(filters?: {
    startDate?: Date;
    endDate?: Date;
    category?: string;
  }): Promise<CashflowTransaction[]>;
  getCashflowSummary(startDate: Date, endDate: Date): Promise<any[]>;
  createCashflowTransaction(data: InsertCashflowTransaction): Promise<CashflowTransaction>;
  updateCashflowTransaction(id: string, data: Partial<InsertCashflowTransaction>): Promise<CashflowTransaction | undefined>;
  deleteCashflowTransaction(id: string, userId?: string): Promise<boolean>;
  restoreCashflowTransaction(id: string, userId?: string): Promise<boolean>;
}

export class CashflowStorage implements ICashflowStorage {
  async getCashflowTransaction(id: string): Promise<CashflowTransaction | undefined> {
    const [transaction] = await db
      .select()
      .from(cashflowTransactions)
      .where(and(eq(cashflowTransactions.id, id), isNull(cashflowTransactions.deletedAt)))
      .limit(1);
    return transaction;
  }

  async getCashflowTransactions(filters?: {
    startDate?: Date;
    endDate?: Date;
    category?: string;
  }): Promise<CashflowTransaction[]> {
    const conditions = [isNull(cashflowTransactions.deletedAt)];
    if (filters?.startDate) {
      conditions.push(gte(cashflowTransactions.transactionDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(cashflowTransactions.transactionDate, filters.endDate));
    }
    if (filters?.category) {
      conditions.push(eq(cashflowTransactions.category, filters.category));
    }

    return db
      .select()
      .from(cashflowTransactions)
      .where(and(...conditions))
      .orderBy(desc(cashflowTransactions.transactionDate));
  }

  async getCashflowSummary(startDate: Date, endDate: Date): Promise<any[]> {
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

  async createCashflowTransaction(data: InsertCashflowTransaction): Promise<CashflowTransaction> {
    const [transaction] = await db.insert(cashflowTransactions).values(data).returning();
    return transaction;
  }

  async updateCashflowTransaction(id: string, data: Partial<InsertCashflowTransaction>): Promise<CashflowTransaction | undefined> {
    const [updated] = await db
      .update(cashflowTransactions)
      .set({ ...data, updatedAt: sql`NOW()` })
      .where(eq(cashflowTransactions.id, id))
      .returning();
    return updated;
  }

  async deleteCashflowTransaction(id: string, userId?: string): Promise<boolean> {
    await db
      .update(cashflowTransactions)
      .set({ deletedAt: sql`NOW()`, deletedById: userId })
      .where(eq(cashflowTransactions.id, id));
    return true;
  }

  async restoreCashflowTransaction(id: string, userId?: string, transaction: any = db): Promise<boolean> {
    await transaction
      .update(cashflowTransactions)
      .set({ deletedAt: null, deletedById: null })
      .where(eq(cashflowTransactions.id, id));
    return true;
  }
}

export const cashflowStorage = new CashflowStorage();
