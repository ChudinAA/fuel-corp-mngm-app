
import { eq, desc, sql, asc } from "drizzle-orm";
import { db } from "../db";
import {
  warehouses,
  warehouseTransactions,
  wholesaleBases,
  refuelingBases,
  type Warehouse,
  type InsertWarehouse,
  type WarehouseTransaction,
} from "@shared/schema";
import { IWarehouseStorage } from "./types";

export class WarehouseStorage implements IWarehouseStorage {
  async getAllWarehouses(): Promise<Warehouse[]> {
    const warehousesList = await db.select().from(warehouses).orderBy(asc(warehouses.name));

    // Enrich with basis name
    const enrichedWarehouses = await Promise.all(
      warehousesList.map(async (wh) => {
        if (wh.baseId) {
          // Try to find in wholesale bases first
          const [wholesaleBase] = await db.select().from(wholesaleBases).where(eq(wholesaleBases.id, wh.baseId)).limit(1);
          if (wholesaleBase) {
            return { ...wh, basis: wholesaleBase.name };
          }

          // Try refueling bases
          const [refuelingBase] = await db.select().from(refuelingBases).where(eq(refuelingBases.id, wh.baseId)).limit(1);
          if (refuelingBase) {
            return { ...wh, basis: refuelingBase.name };
          }
        }
        return wh;
      })
    );

    return enrichedWarehouses;
  }

  async getWarehouse(id: string): Promise<Warehouse | undefined> {
    const [wh] = await db.select().from(warehouses).where(eq(warehouses.id, id)).limit(1);

    if (!wh) return undefined;

    if (wh.baseId) {
      // Try to find in wholesale bases first
      const [wholesaleBase] = await db.select().from(wholesaleBases).where(eq(wholesaleBases.id, wh.baseId)).limit(1);
      if (wholesaleBase) {
        return { ...wh, basis: wholesaleBase.name };
      }

      // Try refueling bases
      const [refuelingBase] = await db.select().from(refuelingBases).where(eq(refuelingBases.id, wh.baseId)).limit(1);
      if (refuelingBase) {
        return { ...wh, basis: refuelingBase.name };
      }
    }

    return wh;
  }

  async createWarehouse(data: InsertWarehouse): Promise<Warehouse> {
    const [created] = await db.insert(warehouses).values(data).returning();
    return created;
  }

  async updateWarehouse(id: string, data: Partial<InsertWarehouse>): Promise<Warehouse | undefined> {
    const [updated] = await db.update(warehouses).set(data).where(eq(warehouses.id, id)).returning();
    return updated;
  }

  async deleteWarehouse(id: string): Promise<boolean> {
    await db.delete(warehouses).where(eq(warehouses.id, id));
    return true;
  }

  async getWarehouseTransactions(warehouseId: string): Promise<WarehouseTransaction[]> {
    const transactions = await db
      .select()
      .from(warehouseTransactions)
      .where(eq(warehouseTransactions.warehouseId, warehouseId))
      .orderBy(desc(warehouseTransactions.createdAt));

    // Маппим поля из БД в формат для фронтенда
    return transactions.map(tx => ({
      id: tx.id,
      warehouseId: tx.warehouseId,
      transactionType: tx.transactionType,
      sourceType: tx.sourceType,
      sourceId: tx.sourceId,
      quantityKg: tx.quantity,
      balanceBefore: tx.balanceBefore || "0",
      balanceAfter: tx.balanceAfter || "0",
      averageCostBefore: tx.averageCostBefore || "0",
      averageCostAfter: tx.averageCostAfter || "0",
      createdAt: tx.createdAt,
    }));
  }

  async getWarehouseStatsForDashboard(): Promise<any[]> {
    const warehousesList = await db.select().from(warehouses).where(eq(warehouses.isActive, true));
    
    const stats = warehousesList.map(wh => {
      const currentBalance = parseFloat(wh.currentBalance || "0");
      const maxCapacity = parseFloat(wh.storageCost || "100000");
      const percentage = maxCapacity > 0 ? (currentBalance / maxCapacity) * 100 : 0;

      return {
        name: wh.name,
        current: currentBalance,
        max: maxCapacity,
        percentage: percentage,
      };
    });

    return stats;
  }
}
