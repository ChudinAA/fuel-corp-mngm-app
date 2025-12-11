
import { eq, desc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  movement,
  warehouses,
  warehouseTransactions,
  wholesaleSuppliers,
  refuelingProviders,
  type Movement,
  type InsertMovement,
} from "@shared/schema";
import { IMovementStorage } from "./types";

export class MovementStorage implements IMovementStorage {
  async getMovements(page: number, pageSize: number): Promise<{ data: Movement[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const data = await db.select().from(movement).orderBy(desc(movement.movementDate)).limit(pageSize).offset(offset);

    // Обогащаем данные названиями складов и поставщиков
    const enrichedData = await Promise.all(
      data.map(async (mov) => {
        let fromName = null;
        let toName = null;

        // Получаем название склада назначения
        if (mov.toWarehouseId) {
          const [toWarehouse] = await db.select().from(warehouses).where(eq(warehouses.id, mov.toWarehouseId)).limit(1);
          toName = toWarehouse?.name || mov.toWarehouseId;
        }

        // Получаем название источника (склад или поставщик)
        if (mov.movementType === 'supply' && mov.supplierId) {
          // Ищем в оптовых поставщиках
          const [wholesaleSupplier] = await db.select().from(wholesaleSuppliers).where(eq(wholesaleSuppliers.id, mov.supplierId)).limit(1);
          if (wholesaleSupplier) {
            fromName = wholesaleSupplier.name;
          } else {
            // Ищем в заправочных провайдерах
            const [refuelingProvider] = await db.select().from(refuelingProviders).where(eq(refuelingProviders.id, mov.supplierId)).limit(1);
            fromName = refuelingProvider?.name || mov.supplierId;
          }
        } else if (mov.fromWarehouseId) {
          const [fromWarehouse] = await db.select().from(warehouses).where(eq(warehouses.id, mov.fromWarehouseId)).limit(1);
          fromName = fromWarehouse?.name || mov.fromWarehouseId;
        }

        return {
          ...mov,
          fromName,
          toName
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

    // Если это поставка или внутреннее перемещение - увеличиваем остаток на складе назначения
    if (created.toWarehouseId) {
      const [targetWarehouse] = await db.select().from(warehouses).where(eq(warehouses.id, created.toWarehouseId)).limit(1);

      if (targetWarehouse) {
        const currentBalance = parseFloat(targetWarehouse.currentBalance || "0");
        const currentCost = parseFloat(targetWarehouse.averageCost || "0");
        const totalCost = parseFloat(created.totalCost || "0");

        // Рассчитываем новую среднюю стоимость
        const newBalance = currentBalance + quantityKg;
        const newAverageCost = newBalance > 0
          ? ((currentBalance * currentCost) + totalCost) / newBalance
          : 0;

        await db.update(warehouses)
          .set({
            currentBalance: newBalance.toFixed(2),
            averageCost: newAverageCost.toFixed(4)
          })
          .where(eq(warehouses.id, created.toWarehouseId));

        // Создаем запись транзакции (приход)
        await db.insert(warehouseTransactions).values({
          warehouseId: created.toWarehouseId,
          transactionType: created.movementType === 'supply' ? 'receipt' : 'transfer_in',
          sourceType: 'movement',
          sourceId: created.id,
          quantity: quantityKg.toString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          averageCostBefore: currentCost.toString(),
          averageCostAfter: newAverageCost.toString(),
          transactionDate: created.movementDate,
        });
      }
    }

    // Если это внутреннее перемещение - уменьшаем остаток на складе-источнике
    if (created.movementType === 'internal' && created.fromWarehouseId) {
      const [sourceWarehouse] = await db.select().from(warehouses).where(eq(warehouses.id, created.fromWarehouseId)).limit(1);

      if (sourceWarehouse) {
        const currentBalance = parseFloat(sourceWarehouse.currentBalance || "0");
        const currentCost = parseFloat(sourceWarehouse.averageCost || "0");
        const newBalance = Math.max(0, currentBalance - quantityKg);

        await db.update(warehouses)
          .set({
            currentBalance: newBalance.toFixed(2)
          })
          .where(eq(warehouses.id, created.fromWarehouseId));

        // Создаем запись транзакции (расход)
        await db.insert(warehouseTransactions).values({
          warehouseId: created.fromWarehouseId,
          transactionType: 'transfer_out',
          sourceType: 'movement',
          sourceId: created.id,
          quantity: (-quantityKg).toString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          averageCostBefore: currentCost.toString(),
          averageCostAfter: currentCost.toString(),
          transactionDate: created.movementDate,
        });
      }
    }

    return created;
  }

  async updateMovement(id: string, data: Partial<InsertMovement>): Promise<Movement | undefined> {
    const [updated] = await db.update(movement).set(data).where(eq(movement.id, id)).returning();
    return updated;
  }

  async deleteMovement(id: string): Promise<boolean> {
    await db.delete(movement).where(eq(movement.id, id));
    return true;
  }
}
