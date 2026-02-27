import { db } from "server/db";
import { eq, asc } from "drizzle-orm";
import {
  refuelingAbroadExchangeRates,
  InsertRefuelingAbroadExchangeRate,
  RefuelingAbroadExchangeRate,
} from "../entities/refueling-abroad-exchange-rates";

export class RefuelingAbroadExchangeRatesStorage {
  async getByRefuelingId(refuelingAbroadId: string): Promise<RefuelingAbroadExchangeRate[]> {
    return db
      .select()
      .from(refuelingAbroadExchangeRates)
      .where(eq(refuelingAbroadExchangeRates.refuelingAbroadId, refuelingAbroadId))
      .orderBy(asc(refuelingAbroadExchangeRates.chainPosition));
  }

  async create(data: InsertRefuelingAbroadExchangeRate): Promise<RefuelingAbroadExchangeRate> {
    const [result] = await db
      .insert(refuelingAbroadExchangeRates)
      .values(this.transformData(data))
      .returning();
    return result;
  }

  async createMany(data: InsertRefuelingAbroadExchangeRate[]): Promise<RefuelingAbroadExchangeRate[]> {
    if (data.length === 0) return [];
    const results = await db
      .insert(refuelingAbroadExchangeRates)
      .values(data.map((d) => this.transformData(d)))
      .returning();
    return results;
  }

  async deleteByRefuelingId(refuelingAbroadId: string): Promise<number> {
    const results = await db
      .delete(refuelingAbroadExchangeRates)
      .where(eq(refuelingAbroadExchangeRates.refuelingAbroadId, refuelingAbroadId))
      .returning();
    return results.length;
  }

  async replaceForRefueling(
    refuelingAbroadId: string,
    items: Omit<InsertRefuelingAbroadExchangeRate, "refuelingAbroadId">[],
  ): Promise<RefuelingAbroadExchangeRate[]> {
    await this.deleteByRefuelingId(refuelingAbroadId);
    if (items.length === 0) return [];
    const dataWithId = items.map((item, index) => ({
      ...item,
      refuelingAbroadId,
      chainPosition: item.chainPosition ?? index,
    }));
    return this.createMany(dataWithId);
  }

  private transformData(data: Partial<InsertRefuelingAbroadExchangeRate>): any {
    const result: any = { ...data };
    if (data.rate !== undefined) {
      result.rate = data.rate !== null ? String(data.rate) : null;
    }
    return result;
  }
}

export const refuelingAbroadExchangeRatesStorage = new RefuelingAbroadExchangeRatesStorage();
