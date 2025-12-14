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

    if (data.warehouseId) {
      const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, data.warehouseId)).limit(1);
      if (!warehouse) {
        throw new Error("Warehouse not found");
      }

      const quantity = parseFloat(data.quantityKg);
      const isPvkj = data.productType === "pvkj";

      // Для ПВКЖ используем pvkjBalance, для керосина - currentBalance
      const currentBalance = parseFloat(isPvkj ? (warehouse.pvkjBalance || "0") : (warehouse.currentBalance || "0"));
      const averageCost = isPvkj ? (warehouse.pvkjAverageCost || "0") : (warehouse.averageCost || "0");
      const newBalance = Math.max(0, currentBalance - quantity);

      // Обновляем соответствующий баланс
      const updateData: any = {
        updatedAt: sql`NOW()`,
        updatedById: data.createdById
      };

      if (isPvkj) {
        updateData.pvkjBalance = newBalance.toFixed(2);
      } else {
        updateData.currentBalance = newBalance.toFixed(2);
      }

      await db.update(warehouses).set(updateData).where(eq(warehouses.id, data.warehouseId));

      const [transaction] = await db.insert(warehouseTransactions).values({
        warehouseId: data.warehouseId,
        transactionType: "sale",
        productType: data.productType || "kerosene",
        sourceType: "refueling",
        sourceId: created.id,
        quantity: (-quantity).toString(),
        balanceBefore: currentBalance.toString(),
        balanceAfter: newBalance.toString(),
        averageCostBefore: averageCost,
        averageCostAfter: averageCost,
        createdById: data.createdById,
      }).returning();

      await db.update(aircraftRefueling)
        .set({ transactionId: transaction.id })
        .where(eq(aircraftRefueling.id, created.id));
    }

    return created;
  }

  async updateRefueling(id: string, data: Partial<InsertAircraftRefueling>): Promise<AircraftRefueling | undefined> {
    const [currentRefueling] = await db.select().from(aircraftRefueling).where(eq(aircraftRefueling.id, id)).limit(1);
    
    if (!currentRefueling) return undefined;

    // Проверяем изменилось ли количество КГ и есть ли привязанная транзакция
    if (data.quantityKg && currentRefueling.transactionId && currentRefueling.warehouseId) {
      const oldQuantityKg = parseFloat(currentRefueling.quantityKg);
      const newQuantityKg = parseFloat(data.quantityKg.toString());

      if (oldQuantityKg !== newQuantityKg) {
        // quantityDiff показывает на сколько увеличилась продажа
        // Если положительное - нужно списать еще больше со склада
        // Если отрицательное - нужно вернуть обратно на склад
        const quantityDiff = newQuantityKg - oldQuantityKg;

        // Получаем склад и текущую транзакцию
        const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, currentRefueling.warehouseId)).limit(1);
        const [transaction] = await db.select().from(warehouseTransactions).where(eq(warehouseTransactions.id, currentRefueling.transactionId)).limit(1);

        if (warehouse && transaction) {
          const isPvkj = currentRefueling.productType === "pvkj";
          const currentBalance = parseFloat(isPvkj ? (warehouse.pvkjBalance || "0") : (warehouse.currentBalance || "0"));
          // Уменьшаем баланс на разницу (если quantityDiff отрицательный, баланс увеличится)
          const newBalance = Math.max(0, currentBalance - quantityDiff);

          // Обновляем баланс склада
          const warehouseUpdateData: any = {
            updatedAt: sql`NOW()`,
            updatedById: data.updatedById
          };

          if (isPvkj) {
            warehouseUpdateData.pvkjBalance = newBalance.toFixed(2);
          } else {
            warehouseUpdateData.currentBalance = newBalance.toFixed(2);
          }

          await db.update(warehouses)
            .set(warehouseUpdateData)
            .where(eq(warehouses.id, currentRefueling.warehouseId));

          // Обновляем транзакцию - там хранится полное количество продажи (отрицательное)
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

    // Обновляем сделку
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
      const isPvkj = currentRefueling.productType === "pvkj";

      const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, currentRefueling.warehouseId)).limit(1);

      if (warehouse) {
        const currentBalance = parseFloat(isPvkj ? (warehouse.pvkjBalance || "0") : (warehouse.currentBalance || "0"));
        const newBalance = currentBalance + quantityKg;

        const updateData: any = {
          updatedAt: sql`NOW()`,
        };

        if (isPvkj) {
          updateData.pvkjBalance = newBalance.toFixed(2);
        } else {
          updateData.currentBalance = newBalance.toFixed(2);
        }

        await db.update(warehouses).set(updateData).where(eq(warehouses.id, currentRefueling.warehouseId));

        await db.delete(warehouseTransactions).where(eq(warehouseTransactions.id, currentRefueling.transactionId));
      }
    }

    await db.delete(aircraftRefueling).where(eq(aircraftRefueling.id, id));
    return true;
  }
}