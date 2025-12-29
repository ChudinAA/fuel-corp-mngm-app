
import { db } from "../../../db";
import { priceCalculations } from "../entities/finance";
import type { InsertPriceCalculation, PriceCalculation } from "./types";
import { eq, and, isNull, desc, sql } from "drizzle-orm";

export interface IPriceCalculationStorage {
  getPriceCalculation(id: string): Promise<PriceCalculation | undefined>;
  getPriceCalculations(filters?: { productType?: string; isTemplate?: boolean }): Promise<PriceCalculation[]>;
  createPriceCalculation(data: InsertPriceCalculation): Promise<PriceCalculation>;
  updatePriceCalculation(id: string, data: Partial<InsertPriceCalculation>): Promise<PriceCalculation | undefined>;
  deletePriceCalculation(id: string, userId?: string): Promise<boolean>;
  restorePriceCalculation(id: string, userId?: string): Promise<boolean>;
}

export class PriceCalculationStorage implements IPriceCalculationStorage {
  async getPriceCalculation(id: string): Promise<PriceCalculation | undefined> {
    const [calculation] = await db
      .select()
      .from(priceCalculations)
      .where(and(eq(priceCalculations.id, id), isNull(priceCalculations.deletedAt)))
      .limit(1);
    return calculation;
  }

  async getPriceCalculations(filters?: { productType?: string; isTemplate?: boolean }): Promise<PriceCalculation[]> {
    let query = db.select().from(priceCalculations).where(isNull(priceCalculations.deletedAt));

    if (filters?.productType) {
      query = query.where(eq(priceCalculations.productType, filters.productType)) as typeof query;
    }
    if (filters?.isTemplate !== undefined) {
      query = query.where(eq(priceCalculations.isTemplate, filters.isTemplate)) as typeof query;
    }

    return await query.orderBy(desc(priceCalculations.createdAt));
  }

  async createPriceCalculation(data: InsertPriceCalculation): Promise<PriceCalculation> {
    const [calculation] = await db.insert(priceCalculations).values(data).returning();
    return calculation;
  }

  async updatePriceCalculation(id: string, data: Partial<InsertPriceCalculation>): Promise<PriceCalculation | undefined> {
    const [updated] = await db
      .update(priceCalculations)
      .set({ ...data, updatedAt: sql`NOW()` })
      .where(eq(priceCalculations.id, id))
      .returning();
    return updated;
  }

  async deletePriceCalculation(id: string, userId?: string): Promise<boolean> {
    await db
      .update(priceCalculations)
      .set({ deletedAt: sql`NOW()`, deletedById: userId })
      .where(eq(priceCalculations.id, id));
    return true;
  }

  async restorePriceCalculation(id: string, userId?: string): Promise<boolean> {
    await db
      .update(priceCalculations)
      .set({ deletedAt: null, deletedById: null })
      .where(eq(priceCalculations.id, id));
    return true;
  }
}
