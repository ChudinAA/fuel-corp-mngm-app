import { db } from "server/db";
import { eq, and, isNull, desc, asc, gte, lte, or, sql } from "drizzle-orm";
import { refuelingAbroad, InsertRefuelingAbroad, RefuelingAbroad } from "../entities/refueling-abroad";

export interface IRefuelingAbroadStorage {
  getAll(): Promise<RefuelingAbroad[]>;
  getById(id: string): Promise<RefuelingAbroad | undefined>;
  getByDateRange(from: Date, to: Date): Promise<RefuelingAbroad[]>;
  getBySupplierId(supplierId: string): Promise<RefuelingAbroad[]>;
  getByBuyerId(buyerId: string): Promise<RefuelingAbroad[]>;
  getByStorageCardId(storageCardId: string): Promise<RefuelingAbroad[]>;
  getByIntermediaryId(intermediaryId: string): Promise<RefuelingAbroad[]>;
  create(data: InsertRefuelingAbroad, userId?: string): Promise<RefuelingAbroad>;
  update(id: string, data: Partial<InsertRefuelingAbroad>, userId?: string): Promise<RefuelingAbroad | undefined>;
  softDelete(id: string, userId?: string): Promise<boolean>;
  getDrafts(): Promise<RefuelingAbroad[]>;
}

export class RefuelingAbroadStorage implements IRefuelingAbroadStorage {
  async getAll(): Promise<RefuelingAbroad[]> {
    return db
      .select()
      .from(refuelingAbroad)
      .where(isNull(refuelingAbroad.deletedAt))
      .orderBy(desc(refuelingAbroad.refuelingDate), desc(refuelingAbroad.createdAt));
  }

  async getById(id: string): Promise<RefuelingAbroad | undefined> {
    const [result] = await db
      .select()
      .from(refuelingAbroad)
      .where(and(eq(refuelingAbroad.id, id), isNull(refuelingAbroad.deletedAt)));
    return result;
  }

  async getByDateRange(from: Date, to: Date): Promise<RefuelingAbroad[]> {
    return db
      .select()
      .from(refuelingAbroad)
      .where(
        and(
          isNull(refuelingAbroad.deletedAt),
          gte(refuelingAbroad.refuelingDate, from.toISOString()),
          lte(refuelingAbroad.refuelingDate, to.toISOString())
        )
      )
      .orderBy(desc(refuelingAbroad.refuelingDate));
  }

  async getBySupplierId(supplierId: string): Promise<RefuelingAbroad[]> {
    return db
      .select()
      .from(refuelingAbroad)
      .where(
        and(
          eq(refuelingAbroad.supplierId, supplierId),
          isNull(refuelingAbroad.deletedAt)
        )
      )
      .orderBy(desc(refuelingAbroad.refuelingDate));
  }

  async getByBuyerId(buyerId: string): Promise<RefuelingAbroad[]> {
    return db
      .select()
      .from(refuelingAbroad)
      .where(
        and(
          eq(refuelingAbroad.buyerId, buyerId),
          isNull(refuelingAbroad.deletedAt)
        )
      )
      .orderBy(desc(refuelingAbroad.refuelingDate));
  }

  async getByStorageCardId(storageCardId: string): Promise<RefuelingAbroad[]> {
    return db
      .select()
      .from(refuelingAbroad)
      .where(
        and(
          eq(refuelingAbroad.storageCardId, storageCardId),
          isNull(refuelingAbroad.deletedAt)
        )
      )
      .orderBy(desc(refuelingAbroad.refuelingDate));
  }

  async getByIntermediaryId(intermediaryId: string): Promise<RefuelingAbroad[]> {
    return db
      .select()
      .from(refuelingAbroad)
      .where(
        and(
          eq(refuelingAbroad.intermediaryId, intermediaryId),
          isNull(refuelingAbroad.deletedAt)
        )
      )
      .orderBy(desc(refuelingAbroad.refuelingDate));
  }

  async create(data: InsertRefuelingAbroad, userId?: string): Promise<RefuelingAbroad> {
    const [result] = await db
      .insert(refuelingAbroad)
      .values({
        ...this.transformData(data),
        createdById: userId,
      })
      .returning();
    return result;
  }

  async update(
    id: string,
    data: Partial<InsertRefuelingAbroad>,
    userId?: string
  ): Promise<RefuelingAbroad | undefined> {
    const [result] = await db
      .update(refuelingAbroad)
      .set({
        ...this.transformData(data),
        updatedAt: new Date().toISOString(),
        updatedById: userId,
      })
      .where(and(eq(refuelingAbroad.id, id), isNull(refuelingAbroad.deletedAt)))
      .returning();
    return result;
  }

  async softDelete(id: string, userId?: string): Promise<boolean> {
    const [result] = await db
      .update(refuelingAbroad)
      .set({
        deletedAt: new Date().toISOString(),
        deletedById: userId,
      })
      .where(and(eq(refuelingAbroad.id, id), isNull(refuelingAbroad.deletedAt)))
      .returning();
    return !!result;
  }

  async getDrafts(): Promise<RefuelingAbroad[]> {
    return db
      .select()
      .from(refuelingAbroad)
      .where(
        and(
          eq(refuelingAbroad.isDraft, true),
          isNull(refuelingAbroad.deletedAt)
        )
      )
      .orderBy(desc(refuelingAbroad.createdAt));
  }

  private transformData(data: Partial<InsertRefuelingAbroad>) {
    return {
      ...data,
      quantityLiters: data.quantityLiters !== undefined ? String(data.quantityLiters) : undefined,
      density: data.density !== undefined ? String(data.density) : undefined,
      quantityKg: data.quantityKg !== undefined ? String(data.quantityKg) : undefined,
      exchangeRateValue: data.exchangeRateValue !== undefined ? String(data.exchangeRateValue) : undefined,
      purchasePriceUsd: data.purchasePriceUsd !== undefined ? String(data.purchasePriceUsd) : undefined,
      purchasePriceRub: data.purchasePriceRub !== undefined ? String(data.purchasePriceRub) : undefined,
      salePriceUsd: data.salePriceUsd !== undefined ? String(data.salePriceUsd) : undefined,
      salePriceRub: data.salePriceRub !== undefined ? String(data.salePriceRub) : undefined,
      purchaseAmountUsd: data.purchaseAmountUsd !== undefined ? String(data.purchaseAmountUsd) : undefined,
      purchaseAmountRub: data.purchaseAmountRub !== undefined ? String(data.purchaseAmountRub) : undefined,
      saleAmountUsd: data.saleAmountUsd !== undefined ? String(data.saleAmountUsd) : undefined,
      saleAmountRub: data.saleAmountRub !== undefined ? String(data.saleAmountRub) : undefined,
      profitUsd: data.profitUsd !== undefined ? String(data.profitUsd) : undefined,
      profitRub: data.profitRub !== undefined ? String(data.profitRub) : undefined,
      intermediaryCommissionUsd: data.intermediaryCommissionUsd !== undefined ? String(data.intermediaryCommissionUsd) : undefined,
      intermediaryCommissionRub: data.intermediaryCommissionRub !== undefined ? String(data.intermediaryCommissionRub) : undefined,
    };
  }
}

export const refuelingAbroadStorage = new RefuelingAbroadStorage();
