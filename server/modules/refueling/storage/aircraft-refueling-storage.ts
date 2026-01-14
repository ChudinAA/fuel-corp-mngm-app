import { eq, desc, sql, or, isNull, and } from "drizzle-orm";
import { db } from "server/db";
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
import { PRODUCT_TYPE, SOURCE_TYPE, TRANSACTION_TYPE } from "@shared/constants";

export class AircraftRefuelingStorage implements IAircraftRefuelingStorage {
  async getRefueling(id: string): Promise<AircraftRefueling | undefined> {
    return db.query.aircraftRefueling.findFirst({
      where: and(
        eq(aircraftRefueling.id, id),
        isNull(aircraftRefueling.deletedAt),
      ),
    });
  }

  async getRefuelings(
    page: number = 1,
    pageSize: number = 10,
    search?: string,
  ): Promise<{ data: any[]; total: number }> {
    const offset = (page - 1) * pageSize;

    // Если есть поиск, используем старый подход с joins
    if (search && search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      const searchCondition = and(
        or(
          sql`${suppliers.name} ILIKE ${searchPattern}`,
          sql`${customers.name} ILIKE ${searchPattern}`,
          sql`${aircraftRefueling.aircraftNumber}::text ILIKE ${searchPattern}`,
          sql`${aircraftRefueling.notes}::text ILIKE ${searchPattern}`,
        ),
        isNull(aircraftRefueling.deletedAt),
      );

      const rawData = await db
        .select({
          refueling: aircraftRefueling,
          supplierName: suppliers.name,
          supplierIsWarehouse: suppliers.isWarehouse,
          buyerName: customers.name,
          warehouseName: sql<string>`${warehouses.name}`,
        })
        .from(aircraftRefueling)
        .leftJoin(suppliers, eq(aircraftRefueling.supplierId, suppliers.id))
        .leftJoin(customers, eq(aircraftRefueling.buyerId, customers.id))
        .leftJoin(warehouses, eq(aircraftRefueling.warehouseId, warehouses.id))
        .where(searchCondition)
        .orderBy(desc(aircraftRefueling.refuelingDate))
        .limit(pageSize)
        .offset(offset);

      const data = rawData.map((row) => ({
        ...row.refueling,
        supplier: {
          id: row.refueling.supplierId,
          name: row.supplierName || "Не указан",
          isWarehouse: row.supplierIsWarehouse || false,
        },
        buyer: {
          id: row.refueling.buyerId,
          name: row.buyerName || "Не указан",
        },
        warehouse: row.refueling.warehouseId
          ? {
              id: row.refueling.warehouseId,
              name: row.warehouseName || "Не указан",
            }
          : null,
      }));

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(aircraftRefueling)
        .leftJoin(suppliers, eq(aircraftRefueling.supplierId, suppliers.id))
        .leftJoin(customers, eq(aircraftRefueling.buyerId, customers.id))
        .where(searchCondition);

      return { data, total: Number(countResult?.count || 0) };
    }

    // Без поиска используем query API с relations
    const data = await db.query.aircraftRefueling.findMany({
      where: isNull(aircraftRefueling.deletedAt),
      limit: pageSize,
      offset: offset,
      orderBy: (aircraftRefueling, { desc }) => [
        desc(aircraftRefueling.refuelingDate),
      ],
      with: {
        supplier: {
          columns: {
            id: true,
            name: true,
            isWarehouse: true,
          },
        },
        buyer: {
          columns: {
            id: true,
            name: true,
          },
        },
        warehouse: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aircraftRefueling)
      .where(isNull(aircraftRefueling.deletedAt));

    return {
      data: data.map((item) => ({
        ...item,
        supplier: item.supplier || {
          id: item.supplierId,
          name: "Не указан",
          isWarehouse: false,
        },
        buyer: item.buyer || { id: item.buyerId, name: "Не указан" },
      })),
      total: Number(countResult?.count || 0),
    };
  }

  async createRefueling(
    data: InsertAircraftRefueling,
  ): Promise<AircraftRefueling> {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(aircraftRefueling)
        .values(data)
        .returning();

      // Для услуги заправки не создаем транзакции на складе
      if (data.warehouseId && data.productType !== PRODUCT_TYPE.SERVICE) {
        const warehouse = await tx.query.warehouses.findFirst({
          where: eq(warehouses.id, data.warehouseId),
        });

        if (!warehouse) {
          throw new Error("Warehouse not found");
        }

        const quantity = parseFloat(data.quantityKg);
        const isPvkj = data.productType === PRODUCT_TYPE.PVKJ;

        const currentBalance = parseFloat(
          isPvkj
            ? warehouse.pvkjBalance || "0"
            : warehouse.currentBalance || "0",
        );
        const averageCost = isPvkj
          ? warehouse.pvkjAverageCost || "0"
          : warehouse.averageCost || "0";
        const newBalance = Math.max(0, currentBalance - quantity);

        const updateData: any = {
          updatedAt: sql`NOW()`,
          updatedById: data.createdById,
        };

        if (isPvkj) {
          updateData.pvkjBalance = newBalance.toFixed(2);
        } else {
          updateData.currentBalance = newBalance.toFixed(2);
        }

        await tx
          .update(warehouses)
          .set(updateData)
          .where(eq(warehouses.id, data.warehouseId));

        const [transaction] = await tx
          .insert(warehouseTransactions)
          .values({
            warehouseId: data.warehouseId,
            transactionType: TRANSACTION_TYPE.SALE,
            productType: data.productType || PRODUCT_TYPE.KEROSENE,
            sourceType: SOURCE_TYPE.REFUELING,
            sourceId: created.id,
            quantity: (-quantity).toString(),
            balanceBefore: currentBalance.toString(),
            balanceAfter: newBalance.toString(),
            averageCostBefore: averageCost,
            averageCostAfter: averageCost,
            createdById: data.createdById,
          })
          .returning();

        await tx
          .update(aircraftRefueling)
          .set({ transactionId: transaction.id })
          .where(eq(aircraftRefueling.id, created.id));
      }

      return created;
    });
  }

  async updateRefueling(
    id: string,
    data: Partial<InsertAircraftRefueling>,
  ): Promise<AircraftRefueling | undefined> {
    return await db.transaction(async (tx) => {
      const currentRefueling = await tx.query.aircraftRefueling.findFirst({
        where: eq(aircraftRefueling.id, id),
        with: {
          warehouse: true,
          transaction: true,
        },
      });

      if (!currentRefueling) return undefined;

      // Для услуг заправки пропускаем обновление склада
      if (
        data.quantityKg &&
        currentRefueling.transactionId &&
        currentRefueling.warehouseId &&
        currentRefueling.productType !== PRODUCT_TYPE.SERVICE
      ) {
        const oldQuantityKg = parseFloat(currentRefueling.quantityKg);
        const newQuantityKg = parseFloat(data.quantityKg.toString());

        if (oldQuantityKg !== newQuantityKg) {
          const quantityDiff = newQuantityKg - oldQuantityKg;

          if (currentRefueling.warehouse && currentRefueling.transaction) {
            const isPvkj = currentRefueling.productType === PRODUCT_TYPE.PVKJ;
            const currentBalance = parseFloat(
              isPvkj
                ? currentRefueling.warehouse.pvkjBalance || "0"
                : currentRefueling.warehouse.currentBalance || "0",
            );
            const newBalance = Math.max(0, currentBalance - quantityDiff);

            const warehouseUpdateData: any = {
              updatedAt: sql`NOW()`,
              updatedById: data.updatedById,
            };

            if (isPvkj) {
              warehouseUpdateData.pvkjBalance = newBalance.toFixed(2);
            } else {
              warehouseUpdateData.currentBalance = newBalance.toFixed(2);
            }

            await tx
              .update(warehouses)
              .set(warehouseUpdateData)
              .where(eq(warehouses.id, currentRefueling.warehouseId));

            await tx
              .update(warehouseTransactions)
              .set({
                quantity: (-newQuantityKg).toString(),
                balanceAfter: newBalance.toString(),
                updatedAt: sql`NOW()`,
                updatedById: data.updatedById,
              })
              .where(
                eq(warehouseTransactions.id, currentRefueling.transactionId),
              );
          }
        }
      }

      const [updated] = await tx
        .update(aircraftRefueling)
        .set({
          ...data,
          updatedAt: sql`NOW()`,
        })
        .where(eq(aircraftRefueling.id, id))
        .returning();

      return updated;
    });
  }

  async deleteRefueling(id: string, userId?: string): Promise<boolean> {
    await db.transaction(async (tx) => {
      const currentRefueling = await tx.query.aircraftRefueling.findFirst({
        where: eq(aircraftRefueling.id, id),
        with: {
          warehouse: true,
        },
      });

      // Для услуг заправки пропускаем восстановление баланса на складе
      if (
        currentRefueling &&
        currentRefueling.transactionId &&
        currentRefueling.warehouseId &&
        currentRefueling.productType !== PRODUCT_TYPE.SERVICE
      ) {
        const quantityKg = parseFloat(currentRefueling.quantityKg);
        const isPvkj = currentRefueling.productType === PRODUCT_TYPE.PVKJ;

        if (currentRefueling.warehouse) {
          const currentBalance = parseFloat(
            isPvkj
              ? currentRefueling.warehouse.pvkjBalance || "0"
              : currentRefueling.warehouse.currentBalance || "0",
          );
          const newBalance = currentBalance + quantityKg;

          const updateData: any = {
            updatedAt: sql`NOW()`,
            updatedById: userId,
          };

          if (isPvkj) {
            updateData.pvkjBalance = newBalance.toFixed(2);
          } else {
            updateData.currentBalance = newBalance.toFixed(2);
          }

          await tx
            .update(warehouses)
            .set(updateData)
            .where(eq(warehouses.id, currentRefueling.warehouseId));

          // Soft delete транзакции
          await tx
            .update(warehouseTransactions)
            .set({
              deletedAt: sql`NOW()`,
              deletedById: userId,
            })
            .where(
              eq(warehouseTransactions.id, currentRefueling.transactionId),
            );
        }
      }

      await tx
        .update(aircraftRefueling)
        .set({
          deletedAt: sql`NOW()`,
          deletedById: userId,
        })
        .where(eq(aircraftRefueling.id, id));
    });

    return true;
  }

  async getUsedVolumeByPrice(priceId: string): Promise<number> {
    const [result] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${aircraftRefueling.quantityKg}), 0)`,
      })
      .from(aircraftRefueling)
      .where(and(eq(aircraftRefueling.salePriceId, priceId), isNull(aircraftRefueling.deletedAt)));
    return parseFloat(result?.total || "0");
  }

  async restoreRefueling(id: string, oldData: any, userId?: string): Promise<boolean> {
    await db.transaction(async (tx) => {
      // Restore the aircraft refueling record
      await tx
        .update(aircraftRefueling)
        .set({
          deletedAt: null,
          deletedById: null,
        })
        .where(eq(aircraftRefueling.id, id));

      // Restore associated transaction if exists and not a service
      if (oldData.transactionId && oldData.productType !== PRODUCT_TYPE.SERVICE) {
        await tx
          .update(warehouseTransactions)
          .set({
            deletedAt: null,
            deletedById: null,
          })
          .where(eq(warehouseTransactions.id, oldData.transactionId));

        // Recalculate warehouse balance
        if (oldData.warehouseId && oldData.quantityKg) {
          const warehouse = await tx.query.warehouses.findFirst({
            where: eq(warehouses.id, oldData.warehouseId),
          });

          if (warehouse) {
            const quantityKg = parseFloat(oldData.quantityKg);
            const isPvkj = oldData.productType === PRODUCT_TYPE.PVKJ;
            const currentBalance = parseFloat(
              isPvkj ? warehouse.pvkjBalance || "0" : warehouse.currentBalance || "0"
            );
            const newBalance = Math.max(0, currentBalance - quantityKg);

            const updateData: any = {
              updatedAt: sql`NOW()`,
              updatedById: userId,
            };

            if (isPvkj) {
              updateData.pvkjBalance = newBalance.toFixed(2);
            } else {
              updateData.currentBalance = newBalance.toFixed(2);
            }

            await tx
              .update(warehouses)
              .set(updateData)
              .where(eq(warehouses.id, oldData.warehouseId));
          }
        }
      }
    });

    return true;
  }

  async getAllAircraftRefuelings(): Promise<any[]> {
    const data = await db.query.aircraftRefueling.findMany({
      where: isNull(aircraftRefueling.deletedAt),
      orderBy: (aircraftRefueling, { desc }) => [desc(aircraftRefueling.refuelingDate)],
      with: {
        base: {
          columns: {
            id: true,
            name: true,
          },
        },
        warehouse: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    return data;
  }
}