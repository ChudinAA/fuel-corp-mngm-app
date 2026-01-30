import { db } from "server/db";
import { eq, and, isNull, desc, asc, gte, lte, or, sql } from "drizzle-orm";
import { refuelingAbroad, InsertRefuelingAbroad, RefuelingAbroad } from "../entities/refueling-abroad";
import { refuelingAbroadIntermediaries } from "../entities/refueling-abroad-intermediaries";

export interface IRefuelingAbroadStorage {
  getAll(): Promise<RefuelingAbroad[]>;
  getById(id: string): Promise<RefuelingAbroad | undefined>;
  getByIdIncludingDeleted(id: string): Promise<RefuelingAbroad | undefined>;
  getByDateRange(from: Date, to: Date): Promise<RefuelingAbroad[]>;
  getBySupplierId(supplierId: string): Promise<RefuelingAbroad[]>;
  getByBuyerId(buyerId: string): Promise<RefuelingAbroad[]>;
  getByStorageCardId(storageCardId: string): Promise<RefuelingAbroad[]>;
  getByIntermediaryId(intermediaryId: string): Promise<RefuelingAbroad[]>;
  create(data: InsertRefuelingAbroad, userId?: string): Promise<RefuelingAbroad>;
  update(id: string, data: Partial<InsertRefuelingAbroad>, userId?: string): Promise<RefuelingAbroad | undefined>;
  softDelete(id: string, userId?: string): Promise<boolean>;
  restore(id: string, userId?: string): Promise<RefuelingAbroad | undefined>;
  getDrafts(): Promise<RefuelingAbroad[]>;
  getDeleted(): Promise<RefuelingAbroad[]>;
}

export class RefuelingAbroadStorage implements IRefuelingAbroadStorage {
  async getAll(): Promise<RefuelingAbroad[]> {
    return db.query.refuelingAbroad.findMany({
      where: isNull(refuelingAbroad.deletedAt),
      orderBy: [desc(refuelingAbroad.refuelingDate), desc(refuelingAbroad.createdAt)],
      with: {
        supplier: true,
        buyer: true,
        storageCard: true,
        intermediaries: {
          with: {
            intermediary: true
          },
          orderBy: [asc(refuelingAbroadIntermediaries.orderIndex)]
        }
      }
    }) as any;
  }

  async getById(id: string): Promise<RefuelingAbroad | undefined> {
    return db.query.refuelingAbroad.findFirst({
      where: and(eq(refuelingAbroad.id, id), isNull(refuelingAbroad.deletedAt)),
      with: {
        supplier: true,
        buyer: true,
        storageCard: true,
        intermediaries: {
          with: {
            intermediary: true
          },
          orderBy: [asc(refuelingAbroadIntermediaries.orderIndex)]
        }
      }
    }) as any;
  }

  async getByIdIncludingDeleted(id: string): Promise<RefuelingAbroad | undefined> {
    const [result] = await db
      .select()
      .from(refuelingAbroad)
      .where(eq(refuelingAbroad.id, id));
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

  async restore(id: string, userId?: string): Promise<RefuelingAbroad | undefined> {
    const [result] = await db
      .update(refuelingAbroad)
      .set({
        deletedAt: null,
        deletedById: null,
        updatedAt: new Date().toISOString(),
        updatedById: userId,
      })
      .where(eq(refuelingAbroad.id, id))
      .returning();
    return result;
  }

  async getDeleted(): Promise<RefuelingAbroad[]> {
    return db
      .select()
      .from(refuelingAbroad)
      .where(sql`${refuelingAbroad.deletedAt} IS NOT NULL`)
      .orderBy(desc(refuelingAbroad.deletedAt));
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

  private transformData(data: Partial<InsertRefuelingAbroad>): any {
    const result: any = { ...data };
    
    if (data.quantityLiters !== undefined) {
      result.quantityLiters = data.quantityLiters !== null ? String(data.quantityLiters) : null;
    }
    if (data.density !== undefined) {
      result.density = data.density !== null ? String(data.density) : null;
    }
    if (data.quantityKg !== undefined) {
      result.quantityKg = data.quantityKg !== null ? String(data.quantityKg) : null;
    }
    if (data.exchangeRateValue !== undefined) {
      result.exchangeRateValue = data.exchangeRateValue !== null ? String(data.exchangeRateValue) : null;
    }
    if (data.purchaseExchangeRateValue !== undefined) {
      result.purchaseExchangeRateValue = data.purchaseExchangeRateValue !== null ? String(data.purchaseExchangeRateValue) : null;
    }
    if (data.saleExchangeRateValue !== undefined) {
      result.saleExchangeRateValue = data.saleExchangeRateValue !== null ? String(data.saleExchangeRateValue) : null;
    }
    if (data.purchasePriceUsd !== undefined) {
      result.purchasePriceUsd = data.purchasePriceUsd !== null ? String(data.purchasePriceUsd) : null;
    }
    if (data.purchasePriceRub !== undefined) {
      result.purchasePriceRub = data.purchasePriceRub !== null ? String(data.purchasePriceRub) : null;
    }
    if (data.salePriceUsd !== undefined) {
      result.salePriceUsd = data.salePriceUsd !== null ? String(data.salePriceUsd) : null;
    }
    if (data.salePriceRub !== undefined) {
      result.salePriceRub = data.salePriceRub !== null ? String(data.salePriceRub) : null;
    }
    if (data.purchaseAmountUsd !== undefined) {
      result.purchaseAmountUsd = data.purchaseAmountUsd !== null ? String(data.purchaseAmountUsd) : null;
    }
    if (data.purchaseAmountRub !== undefined) {
      result.purchaseAmountRub = data.purchaseAmountRub !== null ? String(data.purchaseAmountRub) : null;
    }
    if (data.saleAmountUsd !== undefined) {
      result.saleAmountUsd = data.saleAmountUsd !== null ? String(data.saleAmountUsd) : null;
    }
    if (data.saleAmountRub !== undefined) {
      result.saleAmountRub = data.saleAmountRub !== null ? String(data.saleAmountRub) : null;
    }
    if (data.profitUsd !== undefined) {
      result.profitUsd = data.profitUsd !== null ? String(data.profitUsd) : null;
    }
    if (data.profitRub !== undefined) {
      result.profitRub = data.profitRub !== null ? String(data.profitRub) : null;
    }
    if (data.intermediaryCommissionUsd !== undefined) {
      result.intermediaryCommissionUsd = data.intermediaryCommissionUsd !== null ? String(data.intermediaryCommissionUsd) : null;
    }
    if (data.intermediaryCommissionRub !== undefined) {
      result.intermediaryCommissionRub = data.intermediaryCommissionRub !== null ? String(data.intermediaryCommissionRub) : null;
    }
    
    return result;
  }
}

export const refuelingAbroadStorage = new RefuelingAbroadStorage();
