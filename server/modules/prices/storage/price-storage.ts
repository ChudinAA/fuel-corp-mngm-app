import { eq, and, desc, sql, asc, isNull, or } from "drizzle-orm";
import { db } from "server/db";
import {
  prices,
  deliveryCost,
  opt,
  aircraftRefueling,
  type Price,
  type InsertPrice,
  type DeliveryCost,
  type InsertDeliveryCost,
  movement,
} from "@shared/schema";
import {
  COUNTERPARTY_TYPE,
  COUNTERPARTY_ROLE,
  PRODUCT_TYPE,
} from "@shared/constants";
import type { IPriceStorage } from "../../../storage/types";

export class PriceStorage implements IPriceStorage {
  async getAllPrices(filters?: {
    dateFrom?: string;
    dateTo?: string;
    counterpartyType?: string;
    counterpartyRole?: string;
    counterpartyId?: string;
    basis?: string;
    productType?: string;
    limit?: number;
    offset?: number;
  }): Promise<Price[]> {
    const conditions = [isNull(prices.deletedAt)];

    if (filters) {
      if (filters.dateFrom)
        conditions.push(sql`${prices.dateTo} >= ${filters.dateFrom}`);
      if (filters.dateTo)
        conditions.push(sql`${prices.dateFrom} <= ${filters.dateTo}`);
      if (filters.counterpartyType)
        conditions.push(eq(prices.counterpartyType, filters.counterpartyType));
      if (filters.counterpartyRole)
        conditions.push(eq(prices.counterpartyRole, filters.counterpartyRole));
      if (filters.counterpartyId)
        conditions.push(eq(prices.counterpartyId, filters.counterpartyId));
      if (filters.basis) conditions.push(eq(prices.basis, filters.basis));
      if (filters.productType)
        conditions.push(eq(prices.productType, filters.productType));
    }

    const query = db
      .select()
      .from(prices)
      .where(and(...conditions))
      .orderBy(desc(prices.dateTo));

    if (filters?.limit !== undefined) {
      query.limit(filters.limit);
    }
    if (filters?.offset !== undefined) {
      query.offset(filters.offset);
    }

    const allPrices = await query;
    return allPrices;
  }

  async getPrice(id: string): Promise<Price | undefined> {
    const [price] = await db
      .select()
      .from(prices)
      .where(and(eq(prices.id, id), isNull(prices.deletedAt)))
      .limit(1);
    return price;
  }

  async getPricesByRole(
    counterpartyRole: string,
    counterpartyType: string,
  ): Promise<Price[]> {
    const filtered = await db
      .select()
      .from(prices)
      .where(
        and(
          eq(prices.counterpartyRole, counterpartyRole),
          eq(prices.counterpartyType, counterpartyType),
          isNull(prices.deletedAt),
        ),
      )
      .orderBy(desc(prices.dateFrom));
    return filtered;
  }

  async createPrice(data: InsertPrice): Promise<Price> {
    const enrichedData = {
      ...data,
      dateCheckWarning: null,
    };
    const [created] = await db.insert(prices).values(enrichedData).returning();
    return created;
  }

  async updatePrice(
    id: string,
    data: Partial<InsertPrice>,
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

  async deletePrice(id: string, userId?: string): Promise<boolean> {
    // Soft delete
    await db
      .update(prices)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(prices.id, id));
    return true;
  }

  async restorePrice(id: string, userId?: string): Promise<boolean> {
    await db
      .update(prices)
      .set({
        deletedAt: null,
        deletedById: null,
      })
      .where(eq(prices.id, id));
    return true;
  }

  async calculatePriceSelection(
    counterpartyId: string,
    counterpartyType: string,
    basis: string,
    dateFrom: string,
    dateTo: string,
    priceId?: string,
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
      const [optVolume] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${opt.quantityKg}), 0)`,
        })
        .from(opt)
        .where(
          and(
            or(eq(opt.salePriceId, priceId), eq(opt.purchasePriceId, priceId)),
            isNull(opt.deletedAt),
            eq(opt.isDraft, false),
          ),
        );

      const [movementVolume] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${movement.quantityKg}), 0)`,
        })
        .from(movement)
        .where(
          and(
            eq(movement.purchasePriceId, priceId),
            isNull(movement.deletedAt),
          ),
        );

      totalVolume =
        parseFloat(optVolume.total || "0") +
        parseFloat(movementVolume.total || "0");
    } else if (counterpartyType === COUNTERPARTY_TYPE.REFUELING) {
      const [result] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${aircraftRefueling.quantityKg}), 0)`,
        })
        .from(aircraftRefueling)
        .where(
          and(
            or(
              eq(aircraftRefueling.salePriceId, priceId),
              eq(aircraftRefueling.purchasePriceId, priceId),
            ),
            isNull(aircraftRefueling.deletedAt),
            eq(aircraftRefueling.isDraft, false),
          ),
        );
      totalVolume = parseFloat(result?.total || "0");
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
    excludeId?: string,
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
