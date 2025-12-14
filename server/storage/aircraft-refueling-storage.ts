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
    const [existing] = await db.select().from(aircraftRefueling).where(eq(aircraftRefueling.id, id)).limit(1);

    if (!existing) return undefined;

    const updateData: Partial<InsertAircraftRefueling> = { ...data };

    if (existing.warehouseId && existing.transactionId) {
      const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, existing.warehouseId)).limit(1);
      if (warehouse) {
        const oldQuantity = parseFloat(existing.quantityKg);
        const isPvkj = existing.productType === "pvkj";
        const currentBalance = parseFloat(isPvkj ? (warehouse.pvkjBalance || "0") : (warehouse.currentBalance || "0"));
        const restoredBalance = currentBalance + oldQuantity;

        const restoreData: any = {
          updatedAt: sql`NOW()`,
        };

        if (isPvkj) {
          restoreData.pvkjBalance = restoredBalance.toFixed(2);
        } else {
          restoreData.currentBalance = restoredBalance.toFixed(2);
        }

        await db.update(warehouses).set(restoreData).where(eq(warehouses.id, existing.warehouseId));
      }

      await db.delete(warehouseTransactions).where(eq(warehouseTransactions.id, existing.transactionId));
    }

    if (data.warehouseId) {
      const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, data.warehouseId)).limit(1);
      if (!warehouse) {
        throw new Error("Warehouse not found");
      }

      const quantity = parseFloat(data.quantityKg);
      const isPvkj = data.productType === "pvkj";
      const currentBalance = parseFloat(isPvkj ? (warehouse.pvkjBalance || "0") : (warehouse.currentBalance || "0"));
      const averageCost = isPvkj ? (warehouse.pvkjAverageCost || "0") : (warehouse.averageCost || "0");
      const newBalance = currentBalance - quantity;

      if (newBalance < 0) {
        throw new Error("Insufficient warehouse balance");
      }

      const warehouseUpdateData: any = {
        updatedAt: sql`NOW()`,
        updatedById: data.updatedById
      };

      if (isPvkj) {
        warehouseUpdateData.pvkjBalance = newBalance.toFixed(2);
      } else {
        warehouseUpdateData.currentBalance = newBalance.toFixed(2);
      }

      await db.update(warehouses).set(warehouseUpdateData).where(eq(warehouses.id, data.warehouseId));

      const [transaction] = await db.insert(warehouseTransactions).values({
        warehouseId: data.warehouseId,
        transactionType: "sale",
        productType: data.productType || "kerosene",
        sourceType: "refueling",
        sourceId: id,
        quantity: quantity.toFixed(2),
        balanceBefore: currentBalance.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        averageCostBefore: averageCost,
        averageCostAfter: averageCost,
        createdById: data.createdById,
      }).returning();

      updateData.transactionId = transaction.id;
    }

    const [updated] = await db.update(aircraftRefueling).set({
      ...updateData,
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