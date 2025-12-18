import { eq, desc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  movement,
  warehouses,
  warehouseTransactions,
  suppliers,
  logisticsCarriers,
  type Movement,
  type InsertMovement,
} from "@shared/schema";
import { IMovementStorage } from "./types";
import { PRODUCT_TYPE, MOVEMENT_TYPE, TRANSACTION_TYPE, SOURCE_TYPE } from "@shared/constants";

export class MovementStorage implements IMovementStorage {
  async getMovements(page: number, pageSize: number): Promise<{ data: Movement[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const data = await db.select().from(movement).orderBy(desc(movement.createdAt)).limit(pageSize).offset(offset);

    // Обогащаем данные названиями складов, поставщиков и перевозчиков
    const enrichedData = await Promise.all(
      data.map(async (mov) => {
        let fromName = null;
        let toName = null;
        let carrierName = null;

        // Получаем название склада назначения
        if (mov.toWarehouseId) {
          const [toWarehouse] = await db.select().from(warehouses).where(eq(warehouses.id, mov.toWarehouseId)).limit(1);
          toName = toWarehouse?.name || mov.toWarehouseId;
        }

        // Получаем название источника (склад или поставщик)
        if (mov.movementType === MOVEMENT_TYPE.SUPPLY && mov.supplierId) {
          const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, mov.supplierId)).limit(1);
          fromName = supplier?.name || mov.supplierId;
        } else if (mov.fromWarehouseId) {
          const [fromWarehouse] = await db.select().from(warehouses).where(eq(warehouses.id, mov.fromWarehouseId)).limit(1);
          fromName = fromWarehouse?.name || mov.fromWarehouseId;
        }

        // Получаем название перевозчика
        if (mov.carrierId) {
          const [carrier] = await db.select().from(logisticsCarriers).where(eq(logisticsCarriers.id, mov.carrierId)).limit(1);
          carrierName = carrier?.name || null;
        }

        return {
          ...mov,
          fromName,
          toName,
          carrierName
        };
      })
    );

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(movement);
    return { data: enrichedData, total: Number(countResult?.count || 0) };
  }

  async createMovement(data: InsertMovement): Promise<Movement> {
    const [created] = await db.insert(movement).values(data).returning();

    // Обновляем остатки на складах
    const quantityKg = parseFloat(created.quantityKg);
    const isPvkj = created.productType === PRODUCT_TYPE.PVKJ;

    // Если это покупка или внутреннее перемещение - увеличиваем остаток на складе назначения
    if (created.toWarehouseId) {
      const [targetWarehouse] = await db.select().from(warehouses).where(eq(warehouses.id, created.toWarehouseId)).limit(1);

      if (targetWarehouse) {
        const totalCost = parseFloat(created.totalCost || "0");

        if (isPvkj) {
          // Работаем с ПВКЖ
          const currentBalance = parseFloat(targetWarehouse.pvkjBalance || "0");
          const currentCost = parseFloat(targetWarehouse.pvkjAverageCost || "0");
          const newBalance = currentBalance + quantityKg;
          const newAverageCost = newBalance > 0
            ? ((currentBalance * currentCost) + totalCost) / newBalance
            : 0;

          await db.update(warehouses)
            .set({
              pvkjBalance: newBalance.toFixed(2),
              pvkjAverageCost: newAverageCost.toFixed(4),
              updatedAt: sql`NOW()`,
              updatedById: data.createdById,
            })
            .where(eq(warehouses.id, created.toWarehouseId));

          await db.insert(warehouseTransactions).values({
            warehouseId: created.toWarehouseId,
            transactionType: created.movementType === MOVEMENT_TYPE.SUPPLY ? TRANSACTION_TYPE.RECEIPT : TRANSACTION_TYPE.TRANSFER_IN,
            productType: PRODUCT_TYPE.PVKJ,
            sourceType: SOURCE_TYPE.MOVEMENT,
            sourceId: created.id,
            quantity: quantityKg.toString(),
            balanceBefore: currentBalance.toString(),
            balanceAfter: newBalance.toString(),
            averageCostBefore: currentCost.toString(),
            averageCostAfter: newAverageCost.toString(),
            createdById: data.createdById,
          });
        } else {
          // Работаем с керосином
          const currentBalance = parseFloat(targetWarehouse.currentBalance || "0");
          const currentCost = parseFloat(targetWarehouse.averageCost || "0");
          const newBalance = currentBalance + quantityKg;
          const newAverageCost = newBalance > 0
            ? ((currentBalance * currentCost) + totalCost) / newBalance
            : 0;

          await db.update(warehouses)
            .set({
              currentBalance: newBalance.toFixed(2),
              averageCost: newAverageCost.toFixed(4),
              updatedAt: sql`NOW()`,
              updatedById: data.createdById,
            })
            .where(eq(warehouses.id, created.toWarehouseId));

          await db.insert(warehouseTransactions).values({
            warehouseId: created.toWarehouseId,
            transactionType: created.movementType === MOVEMENT_TYPE.SUPPLY ? TRANSACTION_TYPE.RECEIPT : TRANSACTION_TYPE.TRANSFER_IN,
            productType: PRODUCT_TYPE.KEROSENE,
            sourceType: SOURCE_TYPE.MOVEMENT,
            sourceId: created.id,
            quantity: quantityKg.toString(),
            balanceBefore: currentBalance.toString(),
            balanceAfter: newBalance.toString(),
            averageCostBefore: currentCost.toString(),
            averageCostAfter: newAverageCost.toString(),
            createdById: data.createdById,
          });
        }
      }
    }

    // Если это внутреннее перемещение - уменьшаем остаток на складе-источнике
    if (created.movementType === MOVEMENT_TYPE.INTERNAL && created.fromWarehouseId) {
      const [sourceWarehouse] = await db.select().from(warehouses).where(eq(warehouses.id, created.fromWarehouseId)).limit(1);

      if (sourceWarehouse) {
        if (isPvkj) {
          const currentBalance = parseFloat(sourceWarehouse.pvkjBalance || "0");
          const currentCost = parseFloat(sourceWarehouse.pvkjAverageCost || "0");
          const newBalance = Math.max(0, currentBalance - quantityKg);

          await db.update(warehouses)
            .set({
              pvkjBalance: newBalance.toFixed(2),
              updatedAt: sql`NOW()`,
              updatedById: data.createdById
            })
            .where(eq(warehouses.id, created.fromWarehouseId));

          await db.insert(warehouseTransactions).values({
            warehouseId: created.fromWarehouseId,
            transactionType: TRANSACTION_TYPE.TRANSFER_OUT,
            productType: PRODUCT_TYPE.PVKJ,
            sourceType: SOURCE_TYPE.MOVEMENT,
            sourceId: created.id,
            quantity: (-quantityKg).toString(),
            balanceBefore: currentBalance.toString(),
            balanceAfter: newBalance.toString(),
            averageCostBefore: currentCost.toString(),
            averageCostAfter: currentCost.toString(),
            createdById: data.createdById
          });
        } else {
          const currentBalance = parseFloat(sourceWarehouse.currentBalance || "0");
          const currentCost = parseFloat(sourceWarehouse.averageCost || "0");
          const newBalance = Math.max(0, currentBalance - quantityKg);

          await db.update(warehouses)
            .set({
              currentBalance: newBalance.toFixed(2),
              updatedAt: sql`NOW()`,
              updatedById: data.createdById
            })
            .where(eq(warehouses.id, created.fromWarehouseId));

          await db.insert(warehouseTransactions).values({
            warehouseId: created.fromWarehouseId,
            transactionType: TRANSACTION_TYPE.TRANSFER_OUT,
            productType: PRODUCT_TYPE.KEROSENE,
            sourceType: SOURCE_TYPE.MOVEMENT,
            sourceId: created.id,
            quantity: (-quantityKg).toString(),
            balanceBefore: currentBalance.toString(),
            balanceAfter: newBalance.toString(),
            averageCostBefore: currentCost.toString(),
            averageCostAfter: currentCost.toString(),
            createdById: data.createdById
          });
        }
      }
    }

    return created;
  }

  async updateMovement(id: string, data: Partial<InsertMovement>): Promise<Movement | undefined> {
    const [updated] = await db.update(movement).set({
      ...data,
      updatedAt: sql`NOW()`
    }).where(eq(movement.id, id)).returning();
    return updated;
  }

  async deleteMovement(id: string): Promise<boolean> {
    await db.delete(movement).where(eq(movement.id, id));
    return true;
  }
}