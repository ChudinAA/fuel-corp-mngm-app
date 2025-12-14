
import { eq, desc, sql, or } from "drizzle-orm";
import { db } from "../db";
import {
  aircraftRefueling,
  suppliers,
  customers,
  warehouses,
  warehouseTransactions,
  type AircraftRefueling,
  type InsertAircraftRefueling,
} from "@shared/schema";
import { IAircraftRefuelingStorage } from "./types";

export class AircraftRefuelingStorage implements IAircraftRefuelingStorage {
  async getRefuelings(page: number = 1, pageSize: number = 10, search?: string): Promise<{ data: any[]; total: number }> {
    const offset = (page - 1) * pageSize;

    let query = db.select({
      refueling: aircraftRefueling,
      supplierName: suppliers.name,
      supplierIsWarehouse: suppliers.isWarehouse,
      buyerName: customers.name,
      warehouseName: sql<string>`${warehouses.name}`,
    })
      .from(aircraftRefueling)
      .leftJoin(suppliers, eq(aircraftRefueling.supplierId, suppliers.id))
      .leftJoin(customers, eq(aircraftRefueling.buyerId, customers.id))
      .leftJoin(warehouses, eq(aircraftRefueling.warehouseId, warehouses.id));

    let countQuery = db.select({ count: sql<number>`count(*)` })
      .from(aircraftRefueling)
      .leftJoin(suppliers, eq(aircraftRefueling.supplierId, suppliers.id))
      .leftJoin(customers, eq(aircraftRefueling.buyerId, customers.id));

    if (search && search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      const searchCondition = or(
        sql`${suppliers.name} ILIKE ${searchPattern}`,
        sql`${customers.name} ILIKE ${searchPattern}`,
        sql`${aircraftRefueling.aircraftNumber}::text ILIKE ${searchPattern}`,
        sql`${aircraftRefueling.notes}::text ILIKE ${searchPattern}`
      );
      query = query.where(searchCondition);
      countQuery = countQuery.where(searchCondition);
    }

    const rawData = await query.orderBy(desc(aircraftRefueling.refuelingDate)).limit(pageSize).offset(offset);
    
    const data = rawData.map(row => ({
      ...row.refueling,
      supplier: {
        id: row.refueling.supplierId,
        name: row.supplierName || 'Не указан',
        isWarehouse: row.supplierIsWarehouse || false,
      },
      buyer: {
        id: row.refueling.buyerId,
        name: row.buyerName || 'Не указан',
      },
      warehouse: row.refueling.warehouseId ? {
        id: row.refueling.warehouseId,
        name: row.warehouseName || 'Не указан',
      } : null,
    }));

    const [countResult] = await countQuery;
    return { data, total: Number(countResult?.count || 0) };
  }

  async createRefueling(data: InsertAircraftRefueling): Promise<AircraftRefueling> {
    const [created] = await db.insert(aircraftRefueling).values(data).returning();

    if (created.warehouseId && created.quantityKg) {
      const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, created.warehouseId)).limit(1);

      if (warehouse && warehouse.supplierId) {
        const quantityKg = parseFloat(created.quantityKg);
        const currentBalance = parseFloat(warehouse.currentBalance || "0");
        const newBalance = Math.max(0, currentBalance - quantityKg);

        await db.update(warehouses)
          .set({
            currentBalance: newBalance.toFixed(2),
            updatedAt: sql`NOW()`,
            updatedById: data.createdById
          })
          .where(eq(warehouses.id, created.warehouseId));

        const [transaction] = await db.insert(warehouseTransactions).values({
          warehouseId: created.warehouseId,
          transactionType: 'sale',
          sourceType: 'refueling',
          sourceId: created.id,
          quantity: (-quantityKg).toString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          averageCostBefore: warehouse.averageCost || "0",
          averageCostAfter: warehouse.averageCost || "0",
          createdById: data.createdById
        }).returning();

        await db.update(aircraftRefueling)
          .set({ transactionId: transaction.id })
          .where(eq(aircraftRefueling.id, created.id));
      }
    }

    return created;
  }

  async updateRefueling(id: string, data: Partial<InsertAircraftRefueling>): Promise<AircraftRefueling | undefined> {
    const [currentRefueling] = await db.select().from(aircraftRefueling).where(eq(aircraftRefueling.id, id)).limit(1);
    
    if (!currentRefueling) return undefined;

    if (data.quantityKg && currentRefueling.transactionId && currentRefueling.warehouseId) {
      const oldQuantityKg = parseFloat(currentRefueling.quantityKg);
      const newQuantityKg = parseFloat(data.quantityKg.toString());

      if (oldQuantityKg !== newQuantityKg) {
        const quantityDiff = newQuantityKg - oldQuantityKg;

        const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, currentRefueling.warehouseId)).limit(1);
        const [transaction] = await db.select().from(warehouseTransactions).where(eq(warehouseTransactions.id, currentRefueling.transactionId)).limit(1);

        if (warehouse && transaction) {
          const currentBalance = parseFloat(warehouse.currentBalance || "0");
          const newBalance = Math.max(0, currentBalance - quantityDiff);

          await db.update(warehouses)
            .set({ 
              currentBalance: newBalance.toFixed(2),
              updatedAt: sql`NOW()`,
              updatedById: data.updatedById
            })
            .where(eq(warehouses.id, currentRefueling.warehouseId));

          await db.update(warehouseTransactions)
            .set({
              quantity: (-newQuantityKg).toString(),
              balanceAfter: newBalance.toString(),
              updatedAt: sql`NOW()`,
              updatedById: data.updatedById
            })
            .where(eq(warehouseTransactions.id, currentRefueling.transactionId));
        }
      }
    }

    const [updated] = await db.update(aircraftRefueling).set({
      ...data,
      updatedAt: sql`NOW()`
    }).where(eq(aircraftRefueling.id, id)).returning();

    return updated;
  }

  async deleteRefueling(id: string): Promise<boolean> {
    const [currentRefueling] = await db.select().from(aircraftRefueling).where(eq(aircraftRefueling.id, id)).limit(1);

    if (currentRefueling && currentRefueling.transactionId && currentRefueling.warehouseId) {
      const quantityKg = parseFloat(currentRefueling.quantityKg);

      const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, currentRefueling.warehouseId)).limit(1);

      if (warehouse) {
        const currentBalance = parseFloat(warehouse.currentBalance || "0");
        const newBalance = currentBalance + quantityKg;

        await db.update(warehouses)
          .set({ currentBalance: newBalance.toFixed(2) })
          .where(eq(warehouses.id, currentRefueling.warehouseId));

        await db.delete(warehouseTransactions).where(eq(warehouseTransactions.id, currentRefueling.transactionId));
      }
    }

    await db.delete(aircraftRefueling).where(eq(aircraftRefueling.id, id));
    return true;
  }
}
