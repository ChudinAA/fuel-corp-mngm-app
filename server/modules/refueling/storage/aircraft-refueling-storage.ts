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
import { WarehouseTransactionService } from "server/modules/warehouses/services/warehouse-transaction-service";

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
    offset: number = 0,
    pageSize: number = 20,
    search?: string,
    filters?: Record<string, string[]>,
  ): Promise<{ data: any[]; total: number }> {
    const baseConditions: any[] = [isNull(aircraftRefueling.deletedAt)];

    if (search && search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      baseConditions.push(
        or(
          sql`${suppliers.name} ILIKE ${searchPattern}`,
          sql`${customers.name} ILIKE ${searchPattern}`,
          sql`${aircraftRefueling.aircraftNumber}::text ILIKE ${searchPattern}`,
          sql`${aircraftRefueling.notes}::text ILIKE ${searchPattern}`,
        ),
      );
    }

    if (filters) {
      if (filters.supplier?.length) {
        baseConditions.push(sql`${suppliers.name} IN ${filters.supplier}`);
      }
      if (filters.buyer?.length) {
        baseConditions.push(sql`${customers.name} IN ${filters.buyer}`);
      }
      if (filters.productType?.length) {
        baseConditions.push(
          sql`${aircraftRefueling.productType} IN ${filters.productType}`,
        );
      }
      if (filters.date?.length) {
        // Convert dates to string format for comparison
        baseConditions.push(
          sql`TO_CHAR(${aircraftRefueling.refuelingDate}, 'DD.MM.YYYY') IN ${filters.date}`,
        );
      }
    }

    const whereCondition = and(...baseConditions);

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
      .where(whereCondition)
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
      .where(whereCondition);

    return { data, total: Number(countResult?.count || 0) };
  }

  async createRefueling(
    data: InsertAircraftRefueling,
  ): Promise<AircraftRefueling> {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(aircraftRefueling)
        .values(data)
        .returning();

      // Для услуги заправки или черновика не создаем транзакции на складе
      if (
        !created.isDraft &&
        created.warehouseId &&
        (created.productType === PRODUCT_TYPE.KEROSENE ||
          created.productType === PRODUCT_TYPE.PVKJ)
      ) {
        const { transaction } =
          await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
            tx,
            created.warehouseId,
            TRANSACTION_TYPE.SALE,
            created.productType,
            SOURCE_TYPE.REFUELING,
            created.id,
            parseFloat(created.quantityKg),
            parseFloat(created.purchaseAmount || "0"),
            data.createdById,
            created.refuelingDate,
          );

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
      });

      if (!currentRefueling) {
        throw new Error("Deal not found");
      }

      // Логика перехода из черновика в готовую заправку
      const transitioningFromDraft =
        currentRefueling.isDraft && data.isDraft === false;

      if (
        transitioningFromDraft &&
        data.warehouseId &&
        data.quantityKg &&
        (data.productType === PRODUCT_TYPE.KEROSENE ||
          data.productType === PRODUCT_TYPE.PVKJ)
      ) {
        const { transaction } =
          await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
            tx,
            data.warehouseId,
            TRANSACTION_TYPE.SALE,
            data.productType,
            SOURCE_TYPE.REFUELING,
            currentRefueling.id,
            data.quantityKg,
            data.purchaseAmount || 0,
            data.updatedById,
            data.refuelingDate,
          );

        data.transactionId = transaction.id;
      }
      // Проверяем изменилось ли количество КГ и есть ли привязанная транзакция (для НЕ черновиков)
      else if (
        !currentRefueling.isDraft &&
        data.quantityKg &&
        currentRefueling.transactionId &&
        currentRefueling.warehouseId &&
        (currentRefueling.productType === PRODUCT_TYPE.KEROSENE ||
          currentRefueling.productType === PRODUCT_TYPE.PVKJ)
      ) {
        if (data.productType !== currentRefueling.productType) {
          throw new Error(
            "Нельзя поменять тип продукта для существующей сделки",
          );
        }

        if (data.warehouseId !== currentRefueling.warehouseId) {
          throw new Error(
            "Нельзя поменять склад-источник для существующей сделки",
          );
        }

        const oldQuantityKg = parseFloat(currentRefueling.quantityKg);
        const newQuantityKg = parseFloat(data.quantityKg.toString());
        const oldTotalCost = parseFloat(currentRefueling.purchaseAmount || "0");
        const newTotalCost = data.purchaseAmount || 0;

        if (oldQuantityKg !== newQuantityKg) {
          await WarehouseTransactionService.updateTransactionAndRecalculateWarehouse(
            tx,
            currentRefueling.transactionId,
            currentRefueling.warehouseId,
            oldQuantityKg,
            oldTotalCost,
            newQuantityKg,
            newTotalCost,
            currentRefueling.productType,
            data.updatedById,
            data.refuelingDate,
          );
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
        (currentRefueling.productType === PRODUCT_TYPE.KEROSENE ||
          currentRefueling.productType === PRODUCT_TYPE.PVKJ)
      ) {
        const quantityKg = parseFloat(currentRefueling.quantityKg);
        const totalCost = parseFloat(currentRefueling.purchaseAmount || "0");

        await WarehouseTransactionService.deleteTransactionAndRevertWarehouse(
          tx,
          currentRefueling.transactionId,
          currentRefueling.warehouseId,
          quantityKg,
          totalCost,
          currentRefueling.productType,
          userId,
        );
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
    return parseFloat(result?.total || "0");
  }

  async checkDuplicate(data: {
    refuelingDate: string;
    supplierId: string;
    buyerId: string;
    basis: string;
    quantityKg: number;
  }): Promise<boolean> {
    const existing = await db.query.aircraftRefueling.findFirst({
      where: and(
        sql`DATE(${aircraftRefueling.refuelingDate}) = DATE(${data.refuelingDate})`,
        eq(aircraftRefueling.supplierId, data.supplierId),
        eq(aircraftRefueling.buyerId, data.buyerId),
        eq(aircraftRefueling.basis, data.basis),
        eq(aircraftRefueling.quantityKg, data.quantityKg.toString()),
        isNull(aircraftRefueling.deletedAt),
        eq(aircraftRefueling.isDraft, false),
      ),
    });
    return !!existing;
  }

  async restoreRefueling(
    id: string,
    oldData: any,
    userId?: string,
  ): Promise<boolean> {
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
      if (
        oldData.transactionId &&
        oldData.productType !== PRODUCT_TYPE.SERVICE
      ) {
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
              isPvkj
                ? warehouse.pvkjBalance || "0"
                : warehouse.currentBalance || "0",
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
      orderBy: (aircraftRefueling, { desc }) => [
        desc(aircraftRefueling.refuelingDate),
      ],
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
