import { eq, desc, sql, or, isNull, and } from "drizzle-orm";
import { db } from "server/db";
import {
  suppliers,
  customers,
  logisticsCarriers,
  logisticsDeliveryLocations,
} from "@shared/schema";
import { transportation } from "../entities/transportation";
import type { Transportation, InsertTransportation } from "../entities/transportation";

export class TransportationStorage {
  async getTransportation(id: string): Promise<Transportation | undefined> {
    return db.query.transportation.findFirst({
      where: and(eq(transportation.id, id), isNull(transportation.deletedAt)),
    });
  }

  async getTransportationDeals(
    offset: number = 0,
    pageSize: number = 20,
    search?: string,
    filters?: Record<string, string[]>,
  ): Promise<{ data: any[]; total: number }> {
    const buildFilterConditions = () => {
      const conditions: any[] = [isNull(transportation.deletedAt)];

      if (filters) {
        if (filters.supplier?.length) {
          conditions.push(sql`${suppliers.name} IN ${filters.supplier}`);
        }
        if (filters.buyer?.length) {
          conditions.push(sql`${customers.name} IN ${filters.buyer}`);
        }
        if (filters.productType?.length) {
          conditions.push(
            sql`${transportation.productType} IN ${filters.productType}`,
          );
        }
        if (filters.deliveryLocation?.length) {
          conditions.push(
            sql`${logisticsDeliveryLocations.name} IN ${filters.deliveryLocation}`,
          );
        }
        if (filters.carrier?.length) {
          conditions.push(
            sql`${logisticsCarriers.name} IN ${filters.carrier}`,
          );
        }
        if (filters.date?.length) {
          conditions.push(
            sql`TO_CHAR(${transportation.dealDate}, 'DD.MM.YYYY') IN ${filters.date}`,
          );
        }
      }

      if (search && search.trim()) {
        const searchPattern = `%${search.trim()}%`;
        conditions.push(
          or(
            sql`${suppliers.name} ILIKE ${searchPattern}`,
            sql`${customers.name} ILIKE ${searchPattern}`,
            sql`${transportation.basis}::text ILIKE ${searchPattern}`,
            sql`${transportation.notes}::text ILIKE ${searchPattern}`,
            sql`${logisticsCarriers.name}::text ILIKE ${searchPattern}`,
            sql`${logisticsDeliveryLocations.name}::text ILIKE ${searchPattern}`,
          ),
        );
      }

      return and(...conditions);
    };

    const filterCondition = buildFilterConditions();

    const rawData = await db
      .select({
        transportation: transportation,
        supplierName: suppliers.name,
        buyerName: customers.name,
        carrierName: sql<string>`${logisticsCarriers.name}`,
        deliveryLocationName: sql<string>`${logisticsDeliveryLocations.name}`,
      })
      .from(transportation)
      .leftJoin(suppliers, eq(transportation.supplierId, suppliers.id))
      .leftJoin(customers, eq(transportation.buyerId, customers.id))
      .leftJoin(
        logisticsCarriers,
        eq(transportation.carrierId, logisticsCarriers.id),
      )
      .leftJoin(
        logisticsDeliveryLocations,
        eq(
          transportation.deliveryLocationId,
          logisticsDeliveryLocations.id,
        ),
      )
      .where(filterCondition)
      .orderBy(desc(transportation.dealDate))
      .limit(pageSize)
      .offset(offset);

    const data = rawData.map((row) => ({
      ...row.transportation,
      supplier: {
        id: row.transportation.supplierId,
        name: row.supplierName || "Не указан",
      },
      buyer: {
        id: row.transportation.buyerId,
        name: row.buyerName || "Не указан",
      },
      carrier: row.transportation.carrierId
        ? {
            id: row.transportation.carrierId,
            name: row.carrierName || "Не указан",
          }
        : null,
      deliveryLocation: row.transportation.deliveryLocationId
        ? {
            id: row.transportation.deliveryLocationId,
            name: row.deliveryLocationName || "Не указано",
          }
        : null,
    }));

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transportation)
      .leftJoin(suppliers, eq(transportation.supplierId, suppliers.id))
      .leftJoin(customers, eq(transportation.buyerId, customers.id))
      .leftJoin(
        logisticsCarriers,
        eq(transportation.carrierId, logisticsCarriers.id),
      )
      .leftJoin(
        logisticsDeliveryLocations,
        eq(
          transportation.deliveryLocationId,
          logisticsDeliveryLocations.id,
        ),
      )
      .where(filterCondition);

    return { data, total: Number(countResult?.count || 0) };
  }

  async createTransportation(data: InsertTransportation): Promise<Transportation> {
    const [created] = await db.insert(transportation).values(data).returning();
    return created;
  }

  async updateTransportation(
    id: string,
    data: Partial<InsertTransportation>,
  ): Promise<Transportation | undefined> {
    const [updated] = await db
      .update(transportation)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
        updatedById: data.updatedById,
      })
      .where(eq(transportation.id, id))
      .returning();
    return updated;
  }

  async deleteTransportation(id: string, userId?: string): Promise<boolean> {
    await db
      .update(transportation)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(transportation.id, id));
    return true;
  }

  async restoreTransportation(
    id: string,
    _oldData: any,
    _userId?: string,
  ): Promise<boolean> {
    await db
      .update(transportation)
      .set({
        deletedAt: null,
        deletedById: null,
      })
      .where(eq(transportation.id, id));
    return true;
  }

  async checkDuplicate(data: {
    dealDate: string;
    supplierId: string;
    buyerId: string;
    productType: string;
    basisId?: string | null;
    customerBasisId?: string | null;
    deliveryLocationId?: string | null;
    quantityKg: number;
  }): Promise<boolean> {
    const existing = await db.query.transportation.findFirst({
      where: and(
        sql`DATE(${transportation.dealDate}) = DATE(${data.dealDate})`,
        eq(transportation.supplierId, data.supplierId),
        eq(transportation.buyerId, data.buyerId),
        eq(transportation.productType, data.productType),
        data.basisId
          ? eq(transportation.basisId, data.basisId)
          : isNull(transportation.basisId),
        data.customerBasisId
          ? eq(transportation.customerBasisId, data.customerBasisId)
          : isNull(transportation.customerBasisId),
        data.deliveryLocationId
          ? eq(transportation.deliveryLocationId, data.deliveryLocationId)
          : isNull(transportation.deliveryLocationId),
        eq(transportation.quantityKg, data.quantityKg.toString()),
        isNull(transportation.deletedAt),
        eq(transportation.isDraft, false),
      ),
    });
    return !!existing;
  }
}
