
import { eq, desc, sql, asc } from "drizzle-orm";
import { db } from "../db";
import {
  warehouses,
  warehouseTransactions,
  type Warehouse,
  type InsertWarehouse,
  type WarehouseTransaction,
} from "@shared/schema";
import { IWarehouseStorage } from "./types";
import { PRODUCT_TYPE } from "@shared/constants";

export class WarehouseStorage implements IWarehouseStorage {
  async getAllWarehouses(): Promise<Warehouse[]> {
    const warehousesList = await db.query.warehouses.findMany({
      orderBy: (warehouses, { asc }) => [asc(warehouses.name)],
      with: {
        supplier: {
          columns: {
            id: true,
            name: true,
          }
        }
      }
    });

    // TODO: Рефакторинг baseIds - сейчас это массив, лучше создать связующую таблицу warehouse_bases
    // Это позволит использовать proper relations и foreign keys
    return warehousesList;
  }

  async getWarehouse(id: string): Promise<Warehouse | undefined> {
    const warehouse = await db.query.warehouses.findFirst({
      where: eq(warehouses.id, id),
      with: {
        supplier: {
          columns: {
            id: true,
            name: true,
          }
        }
      }
    });

    return warehouse;
  }

  async createWarehouse(data: InsertWarehouse): Promise<Warehouse> {
    const [created] = await db.insert(warehouses).values(data).returning();
    return created;
  }

  async updateWarehouse(id: string, data: Partial<InsertWarehouse>): Promise<Warehouse | undefined> {
    const [updated] = await db.update(warehouses).set({
      ...data,
      updatedAt: sql`NOW()`
    }).where(eq(warehouses.id, id)).returning();
    return updated;
  }

  async deleteWarehouse(id: string): Promise<boolean> {
    await db.delete(warehouses).where(eq(warehouses.id, id));
    return true;
  }

  async getWarehouseTransactions(warehouseId: string): Promise<WarehouseTransaction[]> {
    const transactions = await db.query.warehouseTransactions.findMany({
      where: eq(warehouseTransactions.warehouseId, warehouseId),
      orderBy: (warehouseTransactions, { desc }) => [desc(warehouseTransactions.createdAt)],
      with: {
        warehouse: {
          columns: {
            id: true,
            name: true,
          }
        },
        createdBy: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    return transactions.map(tx => ({
      id: tx.id,
      warehouseId: tx.warehouseId,
      transactionType: tx.transactionType,
      sourceType: tx.sourceType,
      sourceId: tx.sourceId,
      productType: tx.productType || PRODUCT_TYPE.KEROSENE,
      quantityKg: tx.quantity,
      balanceBefore: tx.balanceBefore || "0",
      balanceAfter: tx.balanceAfter || "0",
      averageCostBefore: tx.averageCostBefore || "0",
      averageCostAfter: tx.averageCostAfter || "0",
      createdAt: tx.createdAt,
    }));
  }

  async getWarehouseStatsForDashboard(): Promise<any[]> {
    const warehousesList = await db.query.warehouses.findMany({
      where: eq(warehouses.isActive, true),
    });

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
