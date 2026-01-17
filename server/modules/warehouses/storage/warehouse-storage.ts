import { eq, desc, sql, asc, isNull, and } from "drizzle-orm";
import { db } from "server/db";
import {
  warehouses,
  warehouseBases,
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
      where: isNull(warehouses.deletedAt),
      orderBy: (warehouses, { asc }) => [asc(warehouses.name)],
      with: {
        supplier: {
          columns: {
            id: true,
            name: true,
          },
        },
        warehouseBases: {
          with: {
            base: true,
          },
        },
      },
    });

    // Map to include baseIds for backward compatibility
    return warehousesList.map((w) => ({
      ...w,
      baseIds: w.warehouseBases?.map((wb) => wb.baseId) || [],
    }));
  }

  async getWarehouse(id: string): Promise<Warehouse | undefined> {
    const warehouse = await db.query.warehouses.findFirst({
      where: and(eq(warehouses.id, id), isNull(warehouses.deletedAt)),
      with: {
        supplier: {
          columns: {
            id: true,
            name: true,
          },
        },
        warehouseBases: {
          with: {
            base: true,
          },
        },
      },
    });

    if (!warehouse) return undefined;

    // Map to include baseIds for backward compatibility
    return {
      ...warehouse,
      baseIds: warehouse.warehouseBases?.map((wb) => wb.baseId) || [],
    };
  }

  async createWarehouse(
    data: InsertWarehouse & { baseIds?: string[] },
  ): Promise<Warehouse> {
    const { baseIds, ...warehouseData } = data;

    // Check for duplicates
    const existing = await db.query.warehouses.findFirst({
      where: and(eq(warehouses.name, warehouseData.name), isNull(warehouses.deletedAt)),
    });

    if (existing) {
      throw new Error("Такая запись уже существует");
    }

    return await db.transaction(async (tx) => {
      // Create warehouse
      const [created] = await tx
        .insert(warehouses)
        .values(warehouseData)
        .returning();

      // Create warehouse-base relations
      if (baseIds && baseIds.length > 0) {
        await tx.insert(warehouseBases).values(
          baseIds.map((baseId) => ({
            warehouseId: created.id,
            baseId,
          })),
        );
      }

      return {
        ...created,
        baseIds: baseIds || [],
      };
    });
  }

  async updateWarehouse(
    id: string,
    data: Partial<InsertWarehouse> & { baseIds?: string[] },
  ): Promise<Warehouse | undefined> {
    const { baseIds, ...warehouseData } = data;

    return await db.transaction(async (tx) => {
      // Update warehouse
      const [updated] = await tx
        .update(warehouses)
        .set({
          ...warehouseData,
          updatedAt: sql`NOW()`,
        })
        .where(eq(warehouses.id, id))
        .returning();

      if (!updated) return undefined;

      // Update warehouse-base relations if baseIds provided
      if (baseIds !== undefined) {
        // Delete existing relations
        await tx
          .delete(warehouseBases)
          .where(eq(warehouseBases.warehouseId, id));

        // Create new relations
        if (baseIds.length > 0) {
          await tx.insert(warehouseBases).values(
            baseIds.map((baseId) => ({
              warehouseId: id,
              baseId,
            })),
          );
        }
      }

      // Fetch the updated warehouse with bases
      const warehouseWithBases = await tx.query.warehouses.findFirst({
        where: eq(warehouses.id, id),
        with: {
          warehouseBases: {
            with: {
              base: true,
            },
          },
        },
      });

      if (!warehouseWithBases) return undefined;

      return {
        ...warehouseWithBases,
        baseIds:
          warehouseWithBases.warehouseBases?.map((wb) => wb.baseId) || [],
      };
    });
  }

  async deleteWarehouse(id: string, userId?: string): Promise<boolean> {
    // Soft delete
    await db
      .update(warehouses)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(warehouses.id, id));
    return true;
  }

  async restoreWarehouse(id: string, userId?: string): Promise<boolean> {
    await db.transaction(async (tx) => {
      // Restore the warehouse
      await tx
        .update(warehouses)
        .set({
          deletedAt: null,
          deletedById: null,
        })
        .where(eq(warehouses.id, id));

      // Note: warehouse-base relations are not deleted on soft delete,
      // so no need to restore them
    });
    return true;
  }

  async getWarehouseTransactions(
    warehouseId: string,
  ): Promise<WarehouseTransaction[]> {
    const transactions = await db.query.warehouseTransactions.findMany({
      where: and(
        eq(warehouseTransactions.warehouseId, warehouseId),
        isNull(warehouseTransactions.deletedAt),
      ),
      orderBy: (warehouseTransactions, { desc }) => [
        desc(warehouseTransactions.transactionDate),
      ],
      with: {
        warehouse: {
          columns: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return transactions.map((tx) => ({
      id: tx.id,
      warehouseId: tx.warehouseId,
      transactionType: tx.transactionType,
      sourceType: tx.sourceType,
      sourceId: tx.sourceId,
      productType: tx.productType || PRODUCT_TYPE.KEROSENE,
      quantityKg: tx.quantity,
      sum: tx.sum,
      price: tx.price,
      transactionDate: tx.transactionDate,
      balanceBefore: tx.balanceBefore || "0",
      balanceAfter: tx.balanceAfter || "0",
      averageCostBefore: tx.averageCostBefore || "0",
      averageCostAfter: tx.averageCostAfter || "0",
      createdAt: tx.createdAt,
    }));
  }

  async getWarehouseBalanceAtDate(
    warehouseId: string,
    date: Date,
  ): Promise<string> {
    const result = await db
      .select({
        balance: sql<string>`COALESCE(SUM(
          CASE 
            WHEN ${warehouseTransactions.transactionType} = 'IN' THEN ${warehouseTransactions.quantity}
            WHEN ${warehouseTransactions.transactionType} = 'OUT' THEN -${warehouseTransactions.quantity}
            ELSE 0
          END
        ), 0)`,
      })
      .from(warehouseTransactions)
      .where(
        and(
          eq(warehouseTransactions.warehouseId, warehouseId),
          sql`${warehouseTransactions.transactionDate} <= ${date.toISOString()}`,
          isNull(warehouseTransactions.deletedAt),
        ),
      );

    return result[0]?.balance || "0";
  }

  async getWarehouseStatsForDashboard(): Promise<any[]> {
    const warehousesList = await db.query.warehouses.findMany({
      where: and(eq(warehouses.isActive, true), isNull(warehouses.deletedAt)),
    });

    const stats = warehousesList.map((wh) => {
      const currentBalance = parseFloat(wh.currentBalance || "0");
      const maxCapacity = parseFloat(wh.storageCost || "100000");
      const percentage =
        maxCapacity > 0 ? (currentBalance / maxCapacity) * 100 : 0;

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
