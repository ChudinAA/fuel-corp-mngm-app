import { db } from "../../../db";
import { priceCalculations } from "../entities/finance";
import type { InsertPriceCalculation } from "./types";
import { eq, and, isNull, desc } from "drizzle-orm";

import { PriceCalculationStorage } from "./price-calculation-storage-class";

export const priceCalculationStorage = new PriceCalculationStorage();

export async function createPriceCalculation(data: InsertPriceCalculation) {
  const [calculation] = await db.insert(priceCalculations).values(data).returning();
  return calculation;
}

export async function getPriceCalculations(filters?: { productType?: string; isTemplate?: boolean }) {
  let query = db.select().from(priceCalculations).where(isNull(priceCalculations.deletedAt));

  if (filters?.productType) {
    query = query.where(eq(priceCalculations.productType, filters.productType)) as typeof query;
  }
  if (filters?.isTemplate !== undefined) {
    query = query.where(eq(priceCalculations.isTemplate, filters.isTemplate)) as typeof query;
  }

  return await query.orderBy(desc(priceCalculations.createdAt));
}

export async function getPriceCalculationById(id: string) {
  const [calculation] = await db
    .select()
    .from(priceCalculations)
    .where(and(eq(priceCalculations.id, id), isNull(priceCalculations.deletedAt)));
  return calculation;
}

export async function updatePriceCalculation(id: string, data: Partial<InsertPriceCalculation>) {
  const [updated] = await db
    .update(priceCalculations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(priceCalculations.id, id))
    .returning();
  return updated;
}

export async function deletePriceCalculation(id: string, userId: string) {
  const [deleted] = await db
    .update(priceCalculations)
    .set({ deletedAt: new Date(), deletedById: userId })
    .where(eq(priceCalculations.id, id))
    .returning();
  return deleted;
}