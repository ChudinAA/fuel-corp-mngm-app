import { eq, desc, isNull, and, or, sql, ilike } from "drizzle-orm";
import { db } from "server/db";
import {
  exchangeDeals,
  type ExchangeDeal,
  type InsertExchangeDeal,
} from "../entities/exchange-deals";
import { suppliers } from "../../suppliers/entities/suppliers";
import { customers } from "../../customers/entities/customers";
import { railwayStations, railwayTariffs } from "../../railway/entities/railway";

export class ExchangeDealsStorage {
  async getDeal(id: string): Promise<any | undefined> {
    const result = await db
      .select({
        deal: exchangeDeals,
        sellerName: suppliers.name,
        buyerName: customers.name,
        departureName: sql<string>`ds.name`,
        departureCode: sql<string>`ds.code`,
        destinationName: sql<string>`dest.name`,
        destinationCode: sql<string>`dest.code`,
        tariffZoneName: railwayTariffs.zoneName,
        tariffPricePerTon: railwayTariffs.pricePerTon,
      })
      .from(exchangeDeals)
      .leftJoin(suppliers, eq(exchangeDeals.sellerId, suppliers.id))
      .leftJoin(customers, eq(exchangeDeals.buyerId, customers.id))
      .leftJoin(sql`railway_stations ds`, sql`ds.id = ${exchangeDeals.departureStationId}`)
      .leftJoin(sql`railway_stations dest`, sql`dest.id = ${exchangeDeals.destinationStationId}`)
      .leftJoin(railwayTariffs, eq(exchangeDeals.deliveryTariffId, railwayTariffs.id))
      .where(and(eq(exchangeDeals.id, id), isNull(exchangeDeals.deletedAt)))
      .limit(1);

    if (!result.length) return undefined;
    const row = result[0];
    return {
      ...row.deal,
      sellerName: row.sellerName,
      buyerName: row.buyerName,
      departureName: row.departureName,
      departureCode: row.departureCode,
      destinationName: row.destinationName,
      destinationCode: row.destinationCode,
      tariffZoneName: row.tariffZoneName,
      tariffPricePerTon: row.tariffPricePerTon,
    };
  }

  async getDeals(
    offset: number = 0,
    pageSize: number = 20,
    search?: string,
    filters?: Record<string, string[]>,
  ): Promise<{ data: any[]; total: number }> {
    const buildConditions = () => {
      const conditions: any[] = [isNull(exchangeDeals.deletedAt)];

      if (filters) {
        if (filters.seller?.length) {
          conditions.push(sql`${suppliers.name} IN ${filters.seller}`);
        }
        if (filters.buyer?.length) {
          conditions.push(sql`${customers.name} IN ${filters.buyer}`);
        }
        if (filters.date?.length) {
          conditions.push(
            sql`TO_CHAR(${exchangeDeals.dealDate}, 'DD.MM.YYYY') IN ${filters.date}`,
          );
        }
        if (filters.dealNumber?.length) {
          conditions.push(sql`${exchangeDeals.dealNumber} IN ${filters.dealNumber}`);
        }
      }

      if (search && search.trim()) {
        const pattern = `%${search.trim()}%`;
        conditions.push(
          or(
            ilike(suppliers.name, pattern),
            ilike(customers.name, pattern),
            sql`${exchangeDeals.dealNumber} ILIKE ${pattern}`,
            sql`${exchangeDeals.wagonNumbers} ILIKE ${pattern}`,
          ),
        );
      }

      return and(...conditions);
    };

    const whereClause = buildConditions();

    const rawData = await db
      .select({
        deal: exchangeDeals,
        sellerName: suppliers.name,
        buyerName: customers.name,
        departureName: sql<string>`ds.name`,
        departureCode: sql<string>`ds.code`,
        destinationName: sql<string>`dest.name`,
        destinationCode: sql<string>`dest.code`,
        tariffZoneName: railwayTariffs.zoneName,
        tariffPricePerTon: railwayTariffs.pricePerTon,
      })
      .from(exchangeDeals)
      .leftJoin(suppliers, eq(exchangeDeals.sellerId, suppliers.id))
      .leftJoin(customers, eq(exchangeDeals.buyerId, customers.id))
      .leftJoin(sql`railway_stations ds`, sql`ds.id = ${exchangeDeals.departureStationId}`)
      .leftJoin(sql`railway_stations dest`, sql`dest.id = ${exchangeDeals.destinationStationId}`)
      .leftJoin(railwayTariffs, eq(exchangeDeals.deliveryTariffId, railwayTariffs.id))
      .where(whereClause)
      .orderBy(desc(exchangeDeals.createdAt))
      .limit(pageSize)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(exchangeDeals)
      .leftJoin(suppliers, eq(exchangeDeals.sellerId, suppliers.id))
      .leftJoin(customers, eq(exchangeDeals.buyerId, customers.id))
      .where(whereClause);

    const total = Number(totalResult[0]?.count ?? 0);

    const data = rawData.map((row) => ({
      ...row.deal,
      sellerName: row.sellerName,
      buyerName: row.buyerName,
      departureName: row.departureName,
      departureCode: row.departureCode,
      destinationName: row.destinationName,
      destinationCode: row.destinationCode,
      tariffZoneName: row.tariffZoneName,
      tariffPricePerTon: row.tariffPricePerTon,
    }));

    return { data, total };
  }

  async createDeal(data: InsertExchangeDeal): Promise<ExchangeDeal> {
    const [deal] = await db.insert(exchangeDeals).values(data).returning();
    return deal;
  }

  async updateDeal(id: string, data: Partial<InsertExchangeDeal>, updatedById?: string): Promise<ExchangeDeal | undefined> {
    const [deal] = await db
      .update(exchangeDeals)
      .set({ ...data, updatedAt: new Date().toISOString(), updatedById })
      .where(and(eq(exchangeDeals.id, id), isNull(exchangeDeals.deletedAt)))
      .returning();
    return deal;
  }

  async deleteDeal(id: string, deletedById?: string): Promise<boolean> {
    const [result] = await db
      .update(exchangeDeals)
      .set({ deletedAt: new Date().toISOString(), deletedById })
      .where(and(eq(exchangeDeals.id, id), isNull(exchangeDeals.deletedAt)))
      .returning();
    return !!result;
  }

  async restoreDeal(id: string, data: any): Promise<ExchangeDeal | undefined> {
    const [deal] = await db
      .insert(exchangeDeals)
      .values({ ...data, id, deletedAt: null })
      .onConflictDoUpdate({
        target: exchangeDeals.id,
        set: { ...data, deletedAt: null, updatedAt: new Date().toISOString() },
      })
      .returning();
    return deal;
  }

  async copyDeal(id: string, createdById?: string): Promise<ExchangeDeal | undefined> {
    const original = await db.query.exchangeDeals.findFirst({
      where: and(eq(exchangeDeals.id, id), isNull(exchangeDeals.deletedAt)),
    });
    if (!original) return undefined;

    const { id: _id, createdAt, updatedAt, deletedAt, deletedById, ...rest } = original;
    const [copy] = await db
      .insert(exchangeDeals)
      .values({
        ...rest,
        dealNumber: rest.dealNumber ? `${rest.dealNumber} (копия)` : null,
        isDraft: true,
        createdById,
        createdAt: new Date().toISOString(),
      })
      .returning();
    return copy;
  }
}
