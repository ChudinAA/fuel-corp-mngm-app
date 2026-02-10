import { db } from "server/db";
import { eq, and, asc } from "drizzle-orm";
import {
  refuelingAbroadIntermediaries,
  InsertRefuelingAbroadIntermediary,
  RefuelingAbroadIntermediary,
} from "../entities/refueling-abroad-intermediaries";
import { suppliers } from "@shared/schema";

export interface IRefuelingAbroadIntermediariesStorage {
  getByRefuelingId(refuelingAbroadId: string): Promise<RefuelingAbroadIntermediary[]>;
  getByRefuelingIdWithDetails(refuelingAbroadId: string): Promise<(RefuelingAbroadIntermediary & { intermediary: { id: string; name: string } })[]>;
  create(data: InsertRefuelingAbroadIntermediary): Promise<RefuelingAbroadIntermediary>;
  createMany(data: InsertRefuelingAbroadIntermediary[]): Promise<RefuelingAbroadIntermediary[]>;
  update(id: string, data: Partial<InsertRefuelingAbroadIntermediary>): Promise<RefuelingAbroadIntermediary | undefined>;
  delete(id: string): Promise<boolean>;
  deleteByRefuelingId(refuelingAbroadId: string): Promise<number>;
  replaceForRefueling(refuelingAbroadId: string, intermediaries: Omit<InsertRefuelingAbroadIntermediary, "refuelingAbroadId">[]): Promise<RefuelingAbroadIntermediary[]>;
}

export class RefuelingAbroadIntermediariesStorage implements IRefuelingAbroadIntermediariesStorage {
  async getByRefuelingId(refuelingAbroadId: string): Promise<RefuelingAbroadIntermediary[]> {
    return db
      .select()
      .from(refuelingAbroadIntermediaries)
      .where(eq(refuelingAbroadIntermediaries.refuelingAbroadId, refuelingAbroadId))
      .orderBy(asc(refuelingAbroadIntermediaries.orderIndex));
  }

  async getByRefuelingIdWithDetails(refuelingAbroadId: string): Promise<(RefuelingAbroadIntermediary & { intermediary: { id: string; name: string } })[]> {
    const results = await db
      .select({
        id: refuelingAbroadIntermediaries.id,
        refuelingAbroadId: refuelingAbroadIntermediaries.refuelingAbroadId,
        intermediaryId: refuelingAbroadIntermediaries.intermediaryId,
        orderIndex: refuelingAbroadIntermediaries.orderIndex,
        commissionFormula: refuelingAbroadIntermediaries.commissionFormula,
        manualCommissionUsd: refuelingAbroadIntermediaries.manualCommissionUsd,
        commissionUsd: refuelingAbroadIntermediaries.commissionUsd,
        commissionRub: refuelingAbroadIntermediaries.commissionRub,
        buyCurrencyId: refuelingAbroadIntermediaries.buyCurrencyId,
        sellCurrencyId: refuelingAbroadIntermediaries.sellCurrencyId,
        buyExchangeRate: refuelingAbroadIntermediaries.buyExchangeRate,
        sellExchangeRate: refuelingAbroadIntermediaries.sellExchangeRate,
        crossConversionCost: refuelingAbroadIntermediaries.crossConversionCost,
        notes: refuelingAbroadIntermediaries.notes,
        intermediary: {
          id: suppliers.id,
          name: suppliers.name,
        },
      })
      .from(refuelingAbroadIntermediaries)
      .leftJoin(suppliers, eq(refuelingAbroadIntermediaries.intermediaryId, suppliers.id))
      .where(eq(refuelingAbroadIntermediaries.refuelingAbroadId, refuelingAbroadId))
      .orderBy(asc(refuelingAbroadIntermediaries.orderIndex));
    
    return results as any;
  }

  async create(data: InsertRefuelingAbroadIntermediary): Promise<RefuelingAbroadIntermediary> {
    const [result] = await db
      .insert(refuelingAbroadIntermediaries)
      .values(this.transformData(data))
      .returning();
    return result;
  }

  async createMany(data: InsertRefuelingAbroadIntermediary[]): Promise<RefuelingAbroadIntermediary[]> {
    if (data.length === 0) return [];
    
    const results = await db
      .insert(refuelingAbroadIntermediaries)
      .values(data.map(d => this.transformData(d)))
      .returning();
    return results;
  }

  async update(id: string, data: Partial<InsertRefuelingAbroadIntermediary>): Promise<RefuelingAbroadIntermediary | undefined> {
    const [result] = await db
      .update(refuelingAbroadIntermediaries)
      .set(this.transformData(data))
      .where(eq(refuelingAbroadIntermediaries.id, id))
      .returning();
    return result;
  }

  async delete(id: string): Promise<boolean> {
    const [result] = await db
      .delete(refuelingAbroadIntermediaries)
      .where(eq(refuelingAbroadIntermediaries.id, id))
      .returning();
    return !!result;
  }

  async deleteByRefuelingId(refuelingAbroadId: string): Promise<number> {
    const results = await db
      .delete(refuelingAbroadIntermediaries)
      .where(eq(refuelingAbroadIntermediaries.refuelingAbroadId, refuelingAbroadId))
      .returning();
    return results.length;
  }

  async replaceForRefueling(
    refuelingAbroadId: string,
    intermediaries: Omit<InsertRefuelingAbroadIntermediary, "refuelingAbroadId">[]
  ): Promise<RefuelingAbroadIntermediary[]> {
    await this.deleteByRefuelingId(refuelingAbroadId);
    
    if (intermediaries.length === 0) return [];
    
    const dataWithRefuelingId = intermediaries.map((item, index) => ({
      ...item,
      refuelingAbroadId,
      orderIndex: item.orderIndex ?? index,
    }));
    
    return this.createMany(dataWithRefuelingId);
  }

  private transformData(data: Partial<InsertRefuelingAbroadIntermediary>): any {
    const result: any = { ...data };
    
    if (data.commissionFormula !== undefined) {
      result.commissionFormula = data.commissionFormula;
    }
    if (data.manualCommissionUsd !== undefined) {
      result.manualCommissionUsd = data.manualCommissionUsd !== null ? String(data.manualCommissionUsd) : null;
    }
    if (data.commissionUsd !== undefined) {
      result.commissionUsd = data.commissionUsd !== null ? String(data.commissionUsd) : null;
    }
    if (data.commissionRub !== undefined) {
      result.commissionRub = data.commissionRub !== null ? String(data.commissionRub) : null;
    }
    if (data.buyExchangeRate !== undefined) {
      result.buyExchangeRate = data.buyExchangeRate !== null ? String(data.buyExchangeRate) : null;
    }
    if (data.sellExchangeRate !== undefined) {
      result.sellExchangeRate = data.sellExchangeRate !== null ? String(data.sellExchangeRate) : null;
    }
    if (data.crossConversionCost !== undefined) {
      result.crossConversionCost = data.crossConversionCost !== null ? String(data.crossConversionCost) : null;
    }
    if (data.crossConversionCostRub !== undefined) {
      result.crossConversionCostRub = data.crossConversionCostRub !== null ? String(data.crossConversionCostRub) : null;
    }
    
    return result;
  }
}

export const refuelingAbroadIntermediariesStorage = new RefuelingAbroadIntermediariesStorage();
