import { eq, isNull, sql, and } from "drizzle-orm";
import { db } from "server/db";
import {
  currencies,
  type Currency,
  type InsertCurrency,
} from "../entities/currencies";

export class CurrenciesStorage {
  async getAllCurrencies(): Promise<Currency[]> {
    return await db.query.currencies.findMany({
      where: isNull(currencies.deletedAt),
      orderBy: [currencies.code],
    });
  }

  async getActiveCurrencies(): Promise<Currency[]> {
    return await db.query.currencies.findMany({
      where: and(
        isNull(currencies.deletedAt),
        eq(currencies.isActive, true)
      ),
      orderBy: [currencies.code],
    });
  }

  async getCurrency(id: string): Promise<Currency | undefined> {
    return await db.query.currencies.findFirst({
      where: and(eq(currencies.id, id), isNull(currencies.deletedAt)),
    });
  }

  async getCurrencyByCode(code: string): Promise<Currency | undefined> {
    return await db.query.currencies.findFirst({
      where: and(eq(currencies.code, code), isNull(currencies.deletedAt)),
    });
  }

  async createCurrency(data: InsertCurrency): Promise<Currency> {
    const existing = await db.query.currencies.findFirst({
      where: and(
        eq(currencies.code, data.code),
        isNull(currencies.deletedAt)
      ),
    });

    if (existing) {
      throw new Error("Валюта с таким кодом уже существует");
    }

    const [created] = await db
      .insert(currencies)
      .values(data)
      .returning();

    return created;
  }

  async updateCurrency(
    id: string,
    data: Partial<InsertCurrency>
  ): Promise<Currency | undefined> {
    const [updated] = await db
      .update(currencies)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(currencies.id, id))
      .returning();

    return updated;
  }

  async deleteCurrency(
    id: string,
    deletedById?: string
  ): Promise<boolean> {
    const [deleted] = await db
      .update(currencies)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: deletedById || null,
      })
      .where(eq(currencies.id, id))
      .returning();

    return !!deleted;
  }
}
