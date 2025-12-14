import { eq, and, desc, sql, asc } from "drizzle-orm";
import { db } from "../db";
import {
  prices,
  deliveryCost,
  opt,
  aircraftRefueling,
  type Price,
  type InsertPrice,
  type DeliveryCost,
  type InsertDeliveryCost,
} from "@shared/schema";
import type { IPriceStorage } from "./types";

export class PriceStorage implements IPriceStorage {
  async getAllPrices(): Promise<Price[]> {
    const allPrices = await db.select().from(prices).orderBy(desc(prices.dateFrom));
    return allPrices.map(p => this.enrichPriceWithCalculations(p));
  }

  async getPricesByRole(counterpartyRole: string, counterpartyType: string): Promise<Price[]> {
    const filtered = await db.select().from(prices).where(
      and(eq(prices.counterpartyRole, counterpartyRole), eq(prices.counterpartyType, counterpartyType))
    ).orderBy(desc(prices.dateFrom));
    return filtered.map(p => this.enrichPriceWithCalculations(p));
  }

  private enrichPriceWithCalculations(price: Price): Price {
    let dateCheckWarning: string | null = null;
    return {
      ...price,
      dateCheckWarning,
    } as Price;
  }

  async createPrice(data: InsertPrice): Promise<Price> {
    const enrichedData = {
      ...data,
      dateCheckWarning: null,
    };
    const [created] = await db.insert(prices).values(enrichedData).returning();
    return this.enrichPriceWithCalculations(created);
  }

  async updatePrice(id: string, data: Partial<InsertPrice>): Promise<Price | undefined> {
    const [updated] = await db.update(prices).set({
      ...data,
      updatedAt: sql`NOW()`
    }).where(eq(prices.id, id)).returning();
    return updated;
  }

  async deletePrice(id: string): Promise<boolean> {
    await db.delete(prices).where(eq(prices.id, id));
    return true;
  }

  async calculatePriceSelection(
    counterpartyId: string,
    counterpartyType: string,
    basis: string,
    dateFrom: string,
    dateTo: string,
    priceId?: string
  ): Promise<number> {
    let totalVolume = 0;

    if (counterpartyType === "wholesale") {
      // Сделки, где контрагент - поставщик
      const optDealsSupplier = await db.select({
        total: sql<string>`COALESCE(SUM(${opt.quantityKg}), 0)`
      }).from(opt).where(
        and(
          eq(opt.supplierId, counterpartyId),
          eq(opt.basis, basis),
          priceId ? eq(opt.purchasePriceId, priceId) : sql`1=1`
        )
      );

      // Сделки, где контрагент - покупатель
      const optDealsBuyer = await db.select({
        total: sql<string>`COALESCE(SUM(${opt.quantityKg}), 0)`
      }).from(opt).where(
        and(
          eq(opt.buyerId, counterpartyId),
          eq(opt.basis, basis),
          priceId ? eq(opt.salePriceId, priceId) : sql`1=1`
        )
      );

      totalVolume += parseFloat(optDealsSupplier[0]?.total || "0");
      totalVolume += parseFloat(optDealsBuyer[0]?.total || "0");
    } else if (counterpartyType === "refueling") {
      // Сделки, где контрагент - поставщик
      const refuelingDealsSupplier = await db.select({
        total: sql<string>`COALESCE(SUM(${aircraftRefueling.quantityKg}), 0)`
      }).from(aircraftRefueling).where(
        and(
          eq(aircraftRefueling.supplierId, counterpartyId),
          eq(aircraftRefueling.basis, basis),
          priceId ? eq(aircraftRefueling.purchasePriceId, priceId) : sql`1=1`
        )
      );

      // Сделки, где контрагент - покупатель
      const refuelingDealsBuyer = await db.select({
        total: sql<string>`COALESCE(SUM(${aircraftRefueling.quantityKg}), 0)`
      }).from(aircraftRefueling).where(
        and(
          eq(aircraftRefueling.buyerId, counterpartyId),
          eq(aircraftRefueling.basis, basis),
          priceId ? eq(aircraftRefueling.salePriceId, priceId) : sql`1=1`
        )
      );

      totalVolume += parseFloat(refuelingDealsSupplier[0]?.total || "0");
      totalVolume += parseFloat(refuelingDealsBuyer[0]?.total || "0");
    }

    // Обновляем значение в базе данных, если передан priceId
    if (priceId) {
      await db.update(prices).set({
        soldVolume: totalVolume.toString()
      }).where(eq(prices.id, priceId));
    }

    return totalVolume;
  }

  async checkPriceDateOverlaps(
    counterpartyId: string,
    counterpartyType: string,
    counterpartyRole: string,
    basis: string,
    dateFrom: string,
    dateTo: string,
    excludeId?: string
  ): Promise<{ status: string; message: string; overlaps?: { id: string; dateFrom: string; dateTo: string }[] }> {
    const conditions = [
      eq(prices.counterpartyId, counterpartyId),
      eq(prices.counterpartyType, counterpartyType),
      eq(prices.counterpartyRole, counterpartyRole),
      eq(prices.basis, basis),
      eq(prices.isActive, true),
      sql`${prices.dateFrom} <= ${dateTo}`,
      sql`${prices.dateTo} >= ${dateFrom}`
    ];

    if (excludeId) {
      conditions.push(sql`${prices.id} != ${excludeId}`);
    }

    const overlappingPrices = await db.select({
      id: prices.id,
      dateFrom: prices.dateFrom,
      dateTo: prices.dateTo
    }).from(prices).where(and(...conditions));

    if (overlappingPrices.length > 0) {
      for (const price of overlappingPrices) {
        await db.update(prices).set({ dateCheckWarning: "error" }).where(eq(prices.id, price.id));
      }

      return {
        status: "error",
        message: `Обнаружено пересечение дат с ${overlappingPrices.length} ценами. При пересечении цены будут суммироваться!`,
        overlaps: overlappingPrices.map(p => ({
          id: p.id,
          dateFrom: p.dateFrom,
          dateTo: p.dateTo || p.dateFrom
        }))
      };
    }

    return {
      status: "ok",
      message: "Пересечений не обнаружено"
    };
  }

  async getAllDeliveryCosts(): Promise<DeliveryCost[]> {
    return db.select().from(deliveryCost).where(eq(deliveryCost.isActive, true)).orderBy(asc(deliveryCost.fromLocation));
  }

  async createDeliveryCost(data: InsertDeliveryCost): Promise<DeliveryCost> {
    const [created] = await db.insert(deliveryCost).values(data).returning();
    return created;
  }

  async updateDeliveryCost(id: string, data: Partial<InsertDeliveryCost>): Promise<DeliveryCost | undefined> {
    const [updated] = await db.update(deliveryCost).set(data).where(eq(deliveryCost.id, id)).returning();
    return updated;
  }

  async deleteDeliveryCost(id: string): Promise<boolean> {
    await db.delete(deliveryCost).where(eq(deliveryCost.id, id));
    return true;
  }
}