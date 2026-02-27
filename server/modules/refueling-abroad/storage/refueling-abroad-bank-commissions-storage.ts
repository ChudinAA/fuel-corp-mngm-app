import { db } from "server/db";
import { eq, asc } from "drizzle-orm";
import {
  refuelingAbroadBankCommissions,
  InsertRefuelingAbroadBankCommission,
  RefuelingAbroadBankCommission,
} from "../entities/refueling-abroad-bank-commissions";

export class RefuelingAbroadBankCommissionsStorage {
  async getByRefuelingId(refuelingAbroadId: string): Promise<RefuelingAbroadBankCommission[]> {
    return db
      .select()
      .from(refuelingAbroadBankCommissions)
      .where(eq(refuelingAbroadBankCommissions.refuelingAbroadId, refuelingAbroadId))
      .orderBy(asc(refuelingAbroadBankCommissions.chainPosition));
  }

  async create(data: InsertRefuelingAbroadBankCommission): Promise<RefuelingAbroadBankCommission> {
    const [result] = await db
      .insert(refuelingAbroadBankCommissions)
      .values(this.transformData(data))
      .returning();
    return result;
  }

  async createMany(data: InsertRefuelingAbroadBankCommission[]): Promise<RefuelingAbroadBankCommission[]> {
    if (data.length === 0) return [];
    const results = await db
      .insert(refuelingAbroadBankCommissions)
      .values(data.map((d) => this.transformData(d)))
      .returning();
    return results;
  }

  async deleteByRefuelingId(refuelingAbroadId: string): Promise<number> {
    const results = await db
      .delete(refuelingAbroadBankCommissions)
      .where(eq(refuelingAbroadBankCommissions.refuelingAbroadId, refuelingAbroadId))
      .returning();
    return results.length;
  }

  async replaceForRefueling(
    refuelingAbroadId: string,
    items: Omit<InsertRefuelingAbroadBankCommission, "refuelingAbroadId">[],
  ): Promise<RefuelingAbroadBankCommission[]> {
    await this.deleteByRefuelingId(refuelingAbroadId);
    if (items.length === 0) return [];
    const dataWithId = items.map((item, index) => ({
      ...item,
      refuelingAbroadId,
      chainPosition: item.chainPosition ?? index,
    }));
    return this.createMany(dataWithId);
  }

  private transformData(data: Partial<InsertRefuelingAbroadBankCommission>): any {
    const result: any = { ...data };
    if (data.percent !== undefined) {
      result.percent = data.percent !== null ? String(data.percent) : null;
    }
    if (data.minValue !== undefined) {
      result.minValue = data.minValue !== null ? String(data.minValue) : null;
    }
    return result;
  }
}

export const refuelingAbroadBankCommissionsStorage = new RefuelingAbroadBankCommissionsStorage();
