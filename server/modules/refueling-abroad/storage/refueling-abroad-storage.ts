import { db } from "server/db";
import { eq, and, isNull, desc, asc, gte, lte, or, sql, ilike } from "drizzle-orm";
import { refuelingAbroad, InsertRefuelingAbroad, RefuelingAbroad } from "../entities/refueling-abroad";
import { refuelingAbroadIntermediaries } from "../entities/refueling-abroad-intermediaries";
import { suppliers } from "../../suppliers/entities/suppliers";
import { customers } from "../../customers/entities/customers";

export interface IRefuelingAbroadStorage {
  getAll(offset?: number, limit?: number, search?: string, columnFilters?: Record<string, string[]>): Promise<{ data: RefuelingAbroad[]; total: number }>;
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
  async getAll(
    offset: number = 0,
    limit: number = 20,
    search?: string,
    columnFilters?: Record<string, string[]>,
  ): Promise<{ data: RefuelingAbroad[]; total: number }> {
    const conditions = [isNull(refuelingAbroad.deletedAt)];

    if (search) {
      conditions.push(
        or(
          ilike(refuelingAbroad.aircraftNumber, `%${search}%`),
          ilike(refuelingAbroad.airport, `%${search}%`),
          ilike(refuelingAbroad.country, `%${search}%`),
          ilike(suppliers.name, `%${search}%`),
          ilike(customers.name, `%${search}%`)
        ) as any,
      );
    }

    if (columnFilters) {
      Object.entries(columnFilters).forEach(([columnId, values]) => {
        if (!values || values.length === 0) return;

        if (columnId === "date") {
          const dateConditions = values.map((v) => {
            const [day, month, year] = v.split(".");
            const dateStr = `${year}-${month}-${day}`;
            return sql`DATE(${refuelingAbroad.refuelingDate}) = ${dateStr}`;
          });
          conditions.push(or(...dateConditions) as any);
        } else if (columnId === "productType") {
          conditions.push(sql`${refuelingAbroad.productType} IN ${values}`);
        } else if (columnId === "supplier") {
          conditions.push(
            sql`EXISTS (
              SELECT 1 FROM ${suppliers} 
              WHERE ${suppliers.id} = ${refuelingAbroad.supplierId} 
              AND ${suppliers.name} IN ${values}
            )`,
          );
        } else if (columnId === "buyer") {
          conditions.push(
            sql`EXISTS (
              SELECT 1 FROM ${customers} 
              WHERE ${customers.id} = ${refuelingAbroad.buyerId} 
              AND ${customers.name} IN ${values}
            )`,
          );
        }
      });
    }

    const where = and(...conditions);

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(refuelingAbroad)
      .leftJoin(suppliers, eq(refuelingAbroad.supplierId, suppliers.id))
      .leftJoin(customers, eq(refuelingAbroad.buyerId, customers.id))
      .where(where);

    const data = await db
      .select({
        refuelingAbroad: refuelingAbroad,
        supplier: suppliers,
        buyer: customers,
      })
      .from(refuelingAbroad)
      .leftJoin(suppliers, eq(refuelingAbroad.supplierId, suppliers.id))
      .leftJoin(customers, eq(refuelingAbroad.buyerId, customers.id))
      .where(where)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(refuelingAbroad.refuelingDate), desc(refuelingAbroad.createdAt));

    // Get intermediaries for each deal
    const mappedData = await Promise.all(
      data.map(async (row) => {
        const intermediaries = await db.query.refuelingAbroadIntermediaries.findMany({
          where: eq(refuelingAbroadIntermediaries.refuelingAbroadId, row.refuelingAbroad.id),
          with: {
            intermediary: true,
          },
          orderBy: [asc(refuelingAbroadIntermediaries.orderIndex)],
        });

        return {
          ...row.refuelingAbroad,
          supplier: row.supplier,
          buyer: row.buyer,
          intermediaries,
        };
      })
    );

    return {
      data: mappedData as any,
      total: Number(totalResult?.count || 0),
    };
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
