import { eq, and, desc, sql, asc } from "drizzle-orm";
import { db } from "../../../db";
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
import {
  COUNTERPARTY_TYPE,
  COUNTERPARTY_ROLE,
  PRODUCT_TYPE,
} from "@shared/constants";
import type { IPriceStorage } from "../../../storage/types";

export class PriceStorage implements IPriceStorage {
  async getAllPrices(): Promise<Price[]> {
    const allPrices = await db
      .select()
      .from(prices)
      .orderBy(desc(prices.dateFrom));
    return allPrices.map((p) => this.enrichPriceWithCalculations(p));
  }

  async getPricesByRole(
    counterpartyRole: string,
    counterpartyType: string
  ): Promise<Price[]> {
    const filtered = await db
      .select()
      .from(prices)
      .where(
        and(
          eq(prices.counterpartyRole, counterpartyRole),
          eq(prices.counterpartyType, counterpartyType)
        )
      )
      .orderBy(desc(prices.dateFrom));
    return filtered.map((p) => this.enrichPriceWithCalculations(p));
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

  async updatePrice(
    id: string,
    data: Partial<InsertPrice>
  ): Promise<Price | undefined> {
    const [updated] = await db
      .update(prices)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(prices.id, id))
      .returning();
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

    if (!priceId) {
      return 0;
    }

    // Получаем цену для определения роли контрагента
    const [price] = await db
      .select()
      .from(prices)
      .where(eq(prices.id, priceId))
      .limit(1);
    if (!price) {
      return 0;
    }

    if (counterpartyType === COUNTERPARTY_TYPE.WHOLESALE) {
      if (price.counterpartyRole === COUNTERPARTY_ROLE.SUPPLIER) {
        // Ищем сделки, где этот контрагент - поставщик
        const optDeals = await db
          .select({
            total: sql<string>`COALESCE(SUM(${opt.quantityKg}), 0)`,
          })
          .from(opt)
          .where(
            and(
              eq(opt.supplierId, counterpartyId),
              eq(opt.basis, basis),
              sql`${opt.createdAt}::date >= ${dateFrom}`,
              sql`${opt.createdAt}::date <= ${dateTo}`
            )
          );
        totalVolume += parseFloat(optDeals[0]?.total || "0");
      } else if (price.counterpartyRole === COUNTERPARTY_ROLE.BUYER) {
        // Ищем сделки, где этот контрагент - покупатель
        const optDeals = await db
          .select({
            total: sql<string>`COALESCE(SUM(${opt.quantityKg}), 0)`,
          })
          .from(opt)
          .where(
            and(
              eq(opt.buyerId, counterpartyId),
              eq(opt.basis, basis),
              sql`${opt.createdAt}::date >= ${dateFrom}`,
              sql`${opt.createdAt}::date <= ${dateTo}`
            )
          );
        totalVolume += parseFloat(optDeals[0]?.total || "0");
      }
    } else if (counterpartyType === COUNTERPARTY_TYPE.REFUELING) {
      if (price.counterpartyRole === COUNTERPARTY_ROLE.SUPPLIER) {
        // Ищем сделки, где этот контрагент - поставщик
        const refuelingDeals = await db
          .select({
            total: sql<string>`COALESCE(SUM(${aircraftRefueling.quantityKg}), 0)`,
          })
          .from(aircraftRefueling)
          .where(
            and(
              eq(aircraftRefueling.supplierId, counterpartyId),
              eq(aircraftRefueling.basis, basis),
              sql`${aircraftRefueling.refuelingDate} >= ${dateFrom}`,
              sql`${aircraftRefueling.refuelingDate} <= ${dateTo}`
            )
          );
        totalVolume += parseFloat(refuelingDeals[0]?.total || "0");
      } else if (price.counterpartyRole === COUNTERPARTY_ROLE.BUYER) {
        // Ищем сделки, где этот контрагент - покупатель
        const refuelingDeals = await db
          .select({
            total: sql<string>`COALESCE(SUM(${aircraftRefueling.quantityKg}), 0)`,
          })
          .from(aircraftRefueling)
          .where(
            and(
              eq(aircraftRefueling.buyerId, counterpartyId),
              eq(aircraftRefueling.basis, basis),
              sql`${aircraftRefueling.refuelingDate} >= ${dateFrom}`,
              sql`${aircraftRefueling.refuelingDate} <= ${dateTo}`
            )
          );
        totalVolume += parseFloat(refuelingDeals[0]?.total || "0");
      }
    }

    // Обновляем значение в базе данных
    if (priceId) {
      await db
        .update(prices)
        .set({
          soldVolume: totalVolume.toString(),
        })
        .where(eq(prices.id, priceId));
    }

    return totalVolume;
  }

  async checkPriceDateOverlaps(
    counterpartyId: string,
    counterpartyType: string,
    counterpartyRole: string,
    basis: string,
    productType: string,
    dateFrom: string,
    dateTo: string,
    excludeId?: string
  ): Promise<{
    status: string;
    message: string;
    overlaps?: { id: string; dateFrom: string; dateTo: string }[];
  }> {
    const conditions = [
      eq(prices.counterpartyId, counterpartyId),
      eq(prices.counterpartyType, counterpartyType),
      eq(prices.counterpartyRole, counterpartyRole),
      eq(prices.basis, basis),
      eq(prices.productType, productType),
      eq(prices.isActive, true),
      sql`${prices.dateFrom} <= ${dateTo}`,
      sql`${prices.dateTo} >= ${dateFrom}`,
    ];

    if (excludeId) {
      conditions.push(sql`${prices.id} != ${excludeId}`);
    }

    const overlappingPrices = await db
      .select({
        id: prices.id,
        dateFrom: prices.dateFrom,
        dateTo: prices.dateTo,
      })
      .from(prices)
      .where(and(...conditions));

    if (overlappingPrices.length > 0) {
      for (const price of overlappingPrices) {
        await db
          .update(prices)
          .set({ dateCheckWarning: "error" })
          .where(eq(prices.id, price.id));
      }

      return {
        status: "error",
        message: `Обнаружено пересечение дат с ${overlappingPrices.length} ценами. При пересечении цены будут суммироваться!`,
        overlaps: overlappingPrices.map((p) => ({
          id: p.id,
          dateFrom: p.dateFrom,
          dateTo: p.dateTo || p.dateFrom,
        })),
      };
    }

    return {
      status: "ok",
      message: "Пересечений не обнаружено",
    };
  }
}
