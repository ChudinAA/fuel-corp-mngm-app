import { eq, desc, sql, isNull, and } from "drizzle-orm";
import { db } from "server/db";
import { format } from "date-fns";
import {
  warehouses,
  warehouseBases,
  warehouseTransactions,
  warehouseServices,
  type Warehouse,
  type InsertWarehouse,
  type WarehouseTransaction,
} from "@shared/schema";
import { IWarehouseStorage } from "./types";
import { PRODUCT_TYPE } from "@shared/constants";

export class WarehouseStorage {
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
        warehouseServices: true,
      },
    });

    return warehousesList.map((w) => ({
      ...w,
      baseIds: w.warehouseBases?.map((wb) => wb.baseId) || [],
      services: w.warehouseServices?.map((s) => ({
        id: s.id,
        serviceType: s.serviceType,
        serviceValue: s.serviceValue,
      })) || [],
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
        warehouseServices: true,
      },
    });

    if (!warehouse) return undefined;

    return {
      ...warehouse,
      baseIds: warehouse.warehouseBases?.map((wb) => wb.baseId) || [],
      services: warehouse.warehouseServices?.map((s) => ({
        id: s.id,
        serviceType: s.serviceType,
        serviceValue: s.serviceValue,
      })) || [],
    };
  }

  async createWarehouse(
    data: InsertWarehouse & { baseIds?: string[]; services?: Array<{ serviceType: string; serviceValue: string }> },
  ): Promise<Warehouse> {
    const { baseIds, services, ...warehouseData } = data;

    // Check for duplicates
    const existing = await db.query.warehouses.findFirst({
      where: and(
        eq(warehouses.name, warehouseData.name),
        isNull(warehouses.deletedAt),
      ),
    });

    if (existing) {
      throw new Error("Такая запись уже существует");
    }

    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(warehouses)
        .values(warehouseData)
        .returning();

      if (baseIds && baseIds.length > 0) {
        await tx.insert(warehouseBases).values(
          baseIds.map((baseId) => ({
            warehouseId: created.id,
            baseId,
          })),
        );
      }

      if (services && services.length > 0) {
        await tx.insert(warehouseServices).values(
          services.map((s) => ({
            warehouseId: created.id,
            serviceType: s.serviceType,
            serviceValue: String(s.serviceValue),
          })),
        );
      }

      return {
        ...created,
        baseIds: baseIds || [],
        services: services?.map((s, i) => ({ id: "", ...s })) || [],
      };
    });
  }

  async updateWarehouse(
    id: string,
    data: Partial<InsertWarehouse> & { baseIds?: string[]; services?: Array<{ serviceType: string; serviceValue: string }> },
  ): Promise<Warehouse | undefined> {
    const { baseIds, services, ...warehouseData } = data;

    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(warehouses)
        .set({
          ...warehouseData,
          updatedAt: sql`NOW()`,
        })
        .where(eq(warehouses.id, id))
        .returning();

      if (!updated) return undefined;

      if (baseIds !== undefined) {
        await tx
          .delete(warehouseBases)
          .where(eq(warehouseBases.warehouseId, id));

        if (baseIds.length > 0) {
          await tx.insert(warehouseBases).values(
            baseIds.map((baseId) => ({
              warehouseId: id,
              baseId,
            })),
          );
        }
      }

      if (services !== undefined) {
        await tx
          .delete(warehouseServices)
          .where(eq(warehouseServices.warehouseId, id));

        if (services.length > 0) {
          await tx.insert(warehouseServices).values(
            services.map((s) => ({
              warehouseId: id,
              serviceType: s.serviceType,
              serviceValue: String(s.serviceValue),
            })),
          );
        }
      }

      const warehouseWithRelations = await tx.query.warehouses.findFirst({
        where: eq(warehouses.id, id),
        with: {
          warehouseBases: {
            with: {
              base: true,
            },
          },
          warehouseServices: true,
        },
      });

      if (!warehouseWithRelations) return undefined;

      return {
        ...warehouseWithRelations,
        baseIds:
          warehouseWithRelations.warehouseBases?.map((wb) => wb.baseId) || [],
        services:
          warehouseWithRelations.warehouseServices?.map((s) => ({
            id: s.id,
            serviceType: s.serviceType,
            serviceValue: s.serviceValue,
          })) || [],
      };
    });
  }

  async deleteWarehouse(id: string, userId?: string): Promise<boolean> {
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
      await tx
        .update(warehouses)
        .set({
          deletedAt: null,
          deletedById: null,
        })
        .where(eq(warehouses.id, id));
    });
    return true;
  }

  async getWarehouseTransactions(
    warehouseId: string,
    limit?: number,
    offset?: number,
  ): Promise<{ transactions: any[]; hasMore: boolean }> {
    const transactions = await db.query.warehouseTransactions.findMany({
      where: and(
        eq(warehouseTransactions.warehouseId, warehouseId),
        isNull(warehouseTransactions.deletedAt),
      ),
      orderBy: (warehouseTransactions, { desc }) => [
        desc(warehouseTransactions.transactionDate),
        desc(warehouseTransactions.id),
      ],
      limit: limit ? limit + 1 : undefined,
      offset: offset,
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

    const hasMore = limit ? transactions.length > limit : false;
    const items = limit ? transactions.slice(0, limit) : transactions;

    return {
      transactions: items.map((tx) => ({
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
      })),
      hasMore,
    };
  }

  async getWarehouseMonthlyStats(
    warehouseId: string,
    startOfMonth: Date,
  ): Promise<{ income: number; expense: number; pvkjIncome: number; pvkjExpense: number }> {
    const dateStr = format(startOfMonth, "yyyy-MM-dd");
    const transactions = await db.query.warehouseTransactions.findMany({
      where: and(
        eq(warehouseTransactions.warehouseId, warehouseId),
        isNull(warehouseTransactions.deletedAt),
        sql`${warehouseTransactions.transactionDate} >= ${dateStr}`,
      ),
    });

    let income = 0;
    let expense = 0;
    let pvkjIncome = 0;
    let pvkjExpense = 0;

    transactions.forEach((tx) => {
      const qty = parseFloat(tx.quantity || "0");
      const isPvkj = tx.productType === PRODUCT_TYPE.PVKJ;

      if (qty > 0) {
        if (isPvkj) pvkjIncome += qty;
        else income += qty;
      } else {
        if (isPvkj) pvkjExpense += Math.abs(qty);
        else expense += Math.abs(qty);
      }
    });

    return { income, expense, pvkjIncome, pvkjExpense };
  }

  async getWarehouseBalanceAtDate(
    warehouseId: string,
    date: Date,
    productType: string,
  ): Promise<{ balance: string; averageCost: string }> {
    const dateStr = format(date, "yyyy-MM-dd");

    const [lastTransaction] = await db
      .select()
      .from(warehouseTransactions)
      .where(
        and(
          eq(warehouseTransactions.warehouseId, warehouseId),
          eq(warehouseTransactions.productType, productType),
          sql`CAST(${warehouseTransactions.transactionDate} AS DATE) <= CAST(${dateStr} AS DATE)`,
          isNull(warehouseTransactions.deletedAt),
        ),
      )
      .orderBy(
        desc(warehouseTransactions.transactionDate),
        desc(warehouseTransactions.createdAt),
        desc(warehouseTransactions.id),
      )
      .limit(1);

    return {
      balance: lastTransaction?.balanceAfter || "0",
      averageCost: lastTransaction.averageCostAfter || "0",
    };
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
