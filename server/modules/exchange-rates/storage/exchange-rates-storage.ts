import { eq, desc, sql, isNull, and, lte } from "drizzle-orm";
import { db } from "server/db";
import {
  exchangeRates,
  type ExchangeRate,
  type InsertExchangeRate,
} from "../entities/exchange-rates";

export class ExchangeRatesStorage {
  async getAllExchangeRates(): Promise<ExchangeRate[]> {
    return await db.query.exchangeRates.findMany({
      where: isNull(exchangeRates.deletedAt),
      orderBy: [desc(exchangeRates.rateDate), desc(exchangeRates.createdAt)],
    });
  }

  async getExchangeRate(id: string): Promise<ExchangeRate | undefined> {
    return await db.query.exchangeRates.findFirst({
      where: and(eq(exchangeRates.id, id), isNull(exchangeRates.deletedAt)),
    });
  }

  async getLatestRateByCurrency(currency: string): Promise<ExchangeRate | undefined> {
    return await db.query.exchangeRates.findFirst({
      where: and(
        eq(exchangeRates.currency, currency),
        isNull(exchangeRates.deletedAt)
      ),
      orderBy: [desc(exchangeRates.rateDate)],
    });
  }

  async getLatestRateByCurrencyPair(
    currency: string,
    targetCurrency: string
  ): Promise<ExchangeRate | undefined> {
    return await db.query.exchangeRates.findFirst({
      where: and(
        eq(exchangeRates.currency, currency),
        eq(exchangeRates.targetCurrency, targetCurrency),
        isNull(exchangeRates.deletedAt)
      ),
      orderBy: [desc(exchangeRates.rateDate)],
    });
  }

  async getRateByDateAndCurrency(
    currency: string,
    date: string
  ): Promise<ExchangeRate | undefined> {
    return await db.query.exchangeRates.findFirst({
      where: and(
        eq(exchangeRates.currency, currency),
        lte(exchangeRates.rateDate, date),
        isNull(exchangeRates.deletedAt)
      ),
      orderBy: [desc(exchangeRates.rateDate)],
    });
  }

  async getRateByDateAndCurrencyPair(
    currency: string,
    targetCurrency: string,
    date: string
  ): Promise<ExchangeRate | undefined> {
    return await db.query.exchangeRates.findFirst({
      where: and(
        eq(exchangeRates.currency, currency),
        eq(exchangeRates.targetCurrency, targetCurrency),
        lte(exchangeRates.rateDate, date),
        isNull(exchangeRates.deletedAt)
      ),
      orderBy: [desc(exchangeRates.rateDate)],
    });
  }

  async createExchangeRate(data: InsertExchangeRate): Promise<ExchangeRate> {
    const targetCurrency = data.targetCurrency || "RUB";
    
    const existing = await db.query.exchangeRates.findFirst({
      where: and(
        eq(exchangeRates.currency, data.currency),
        eq(exchangeRates.targetCurrency, targetCurrency),
        eq(exchangeRates.rateDate, data.rateDate),
        isNull(exchangeRates.deletedAt)
      ),
    });

    if (existing) {
      throw new Error("Курс для этой валютной пары на указанную дату уже существует");
    }

    const [created] = await db
      .insert(exchangeRates)
      .values({
        ...data,
        targetCurrency,
        rate: String(data.rate),
      })
      .returning();

    return created;
  }

  async updateExchangeRate(
    id: string,
    data: Partial<InsertExchangeRate>
  ): Promise<ExchangeRate | undefined> {
    const updateData: any = {
      ...data,
      updatedAt: sql`NOW()`,
    };

    if (data.rate !== undefined) {
      updateData.rate = String(data.rate);
    }

    const [updated] = await db
      .update(exchangeRates)
      .set(updateData)
      .where(eq(exchangeRates.id, id))
      .returning();

    return updated;
  }

  async deleteExchangeRate(
    id: string,
    deletedById?: string
  ): Promise<boolean> {
    const [deleted] = await db
      .update(exchangeRates)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: deletedById || null,
      })
      .where(eq(exchangeRates.id, id))
      .returning();

    return !!deleted;
  }
}
