
import { eq, desc, sql, and, gt } from "drizzle-orm";
import { db } from "server/db";
import {
  movement,
  warehouses,
  warehouseTransactions,
  opt,
  aircraftRefueling,
  type Movement,
  type InsertMovement,
} from "@shared/schema";
import { IMovementStorage } from "./types";
import { PRODUCT_TYPE, MOVEMENT_TYPE, TRANSACTION_TYPE, SOURCE_TYPE } from "@shared/constants";

export class MovementStorage implements IMovementStorage {
  async getMovements(page: number, pageSize: number): Promise<{ data: Movement[]; total: number }> {
    const offset = (page - 1) * pageSize;
    
    const data = await db.query.movement.findMany({
      limit: pageSize,
      offset: offset,
      orderBy: (movement, { desc }) => [desc(movement.movementDate)],
      with: {
        supplier: {
          columns: {
            id: true,
            name: true,
          }
        },
        fromWarehouse: {
          columns: {
            id: true,
            name: true,
          }
        },
        toWarehouse: {
          columns: {
            id: true,
            name: true,
          }
        },
        carrier: {
          columns: {
            id: true,
            name: true,
          }
        },
      },
    });

    const enrichedData = data.map((mov) => ({
      ...mov,
      fromName: mov.movementType === MOVEMENT_TYPE.SUPPLY && mov.supplier 
        ? mov.supplier.name 
        : mov.fromWarehouse?.name || null,
      toName: mov.toWarehouse?.name || mov.toWarehouseId,
      carrierName: mov.carrier?.name || null,
    }));

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(movement);
    return { data: enrichedData, total: Number(countResult?.count || 0) };
  }

  async createMovement(data: InsertMovement): Promise<Movement> {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(movement).values(data).returning();

      const quantityKg = parseFloat(created.quantityKg);
      const isPvkj = created.productType === PRODUCT_TYPE.PVKJ;

      // Обработка склада назначения (приход)
      if (created.toWarehouseId) {
        const targetWarehouse = await tx.query.warehouses.findFirst({
          where: eq(warehouses.id, created.toWarehouseId),
        });

        if (targetWarehouse) {
          const totalCost = parseFloat(created.totalCost || "0");

          if (isPvkj) {
            const currentBalance = parseFloat(targetWarehouse.pvkjBalance || "0");
            const currentCost = parseFloat(targetWarehouse.pvkjAverageCost || "0");
            const newBalance = currentBalance + quantityKg;
            const newAverageCost = newBalance > 0
              ? ((currentBalance * currentCost) + totalCost) / newBalance
              : 0;

            await tx.update(warehouses)
              .set({
                pvkjBalance: newBalance.toFixed(2),
                pvkjAverageCost: newAverageCost.toFixed(4),
                updatedAt: sql`NOW()`,
                updatedById: data.createdById,
              })
              .where(eq(warehouses.id, created.toWarehouseId));

            const [transaction] = await tx.insert(warehouseTransactions).values({
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
            }).returning();

            await tx.update(movement)
              .set({ transactionId: transaction.id })
              .where(eq(movement.id, created.id));
          } else {
            const currentBalance = parseFloat(targetWarehouse.currentBalance || "0");
            const currentCost = parseFloat(targetWarehouse.averageCost || "0");
            const newBalance = currentBalance + quantityKg;
            const newAverageCost = newBalance > 0
              ? ((currentBalance * currentCost) + totalCost) / newBalance
              : 0;

            await tx.update(warehouses)
              .set({
                currentBalance: newBalance.toFixed(2),
                averageCost: newAverageCost.toFixed(4),
                updatedAt: sql`NOW()`,
                updatedById: data.createdById,
              })
              .where(eq(warehouses.id, created.toWarehouseId));

            const [transaction] = await tx.insert(warehouseTransactions).values({
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
            }).returning();

            await tx.update(movement)
              .set({ transactionId: transaction.id })
              .where(eq(movement.id, created.id));
          }
        }
      }

      // Обработка склада-источника для внутреннего перемещения (расход)
      if (created.movementType === MOVEMENT_TYPE.INTERNAL && created.fromWarehouseId) {
        const sourceWarehouse = await tx.query.warehouses.findFirst({
          where: eq(warehouses.id, created.fromWarehouseId),
        });

        if (sourceWarehouse) {
          if (isPvkj) {
            const currentBalance = parseFloat(sourceWarehouse.pvkjBalance || "0");
            const currentCost = parseFloat(sourceWarehouse.pvkjAverageCost || "0");
            const newBalance = Math.max(0, currentBalance - quantityKg);

            await tx.update(warehouses)
              .set({
                pvkjBalance: newBalance.toFixed(2),
                updatedAt: sql`NOW()`,
                updatedById: data.createdById
              })
              .where(eq(warehouses.id, created.fromWarehouseId));

            await tx.insert(warehouseTransactions).values({
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

            await tx.update(warehouses)
              .set({
                currentBalance: newBalance.toFixed(2),
                updatedAt: sql`NOW()`,
                updatedById: data.createdById
              })
              .where(eq(warehouses.id, created.fromWarehouseId));

            await tx.insert(warehouseTransactions).values({
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
    });
  }

  private async recalculateDealsAfterMovement(
    tx: any,
    warehouseId: string,
    movementDate: string,
    productType: string,
    newAverageCost: number,
    updatedById?: string
  ) {
    const isPvkj = productType === PRODUCT_TYPE.PVKJ;

    // Получаем все сделки ОПТ после даты перемещения
    const affectedOptDeals = await tx.query.opt.findMany({
      where: and(
        eq(opt.warehouseId, warehouseId),
        gt(opt.dealDate, movementDate)
      ),
      with: {
        transaction: true,
      }
    });

    // Обновляем сделки ОПТ
    for (const deal of affectedOptDeals) {
      if (deal.transactionId) {
        const quantityKg = parseFloat(deal.quantityKg);
        const oldPurchasePrice = parseFloat(deal.purchasePrice || "0");
        
        // Обновляем цену закупки и пересчитываем показатели
        const salePrice = parseFloat(deal.salePrice || "0");
        const deliveryCost = parseFloat(deal.deliveryCost || "0");
        const purchaseAmount = quantityKg * newAverageCost;
        const saleAmount = quantityKg * salePrice;
        const profit = saleAmount - purchaseAmount - deliveryCost;

        await tx.update(opt)
          .set({
            purchasePrice: newAverageCost.toFixed(4),
            purchaseAmount: purchaseAmount.toFixed(2),
            profit: profit.toFixed(2),
            purchasePriceModified: true,
            updatedAt: sql`NOW()`,
            updatedById: updatedById,
          })
          .where(eq(opt.id, deal.id));
      }
    }

    // Получаем все заправки после даты перемещения
    const affectedRefuelings = await tx.query.aircraftRefueling.findMany({
      where: and(
        eq(aircraftRefueling.warehouseId, warehouseId),
        eq(aircraftRefueling.productType, productType),
        gt(aircraftRefueling.refuelingDate, movementDate)
      ),
      with: {
        transaction: true,
      }
    });

    // Обновляем заправки
    for (const refuel of affectedRefuelings) {
      if (refuel.transactionId && refuel.productType !== PRODUCT_TYPE.SERVICE) {
        const quantityKg = parseFloat(refuel.quantityKg);
        const salePrice = parseFloat(refuel.salePrice || "0");
        const purchaseAmount = quantityKg * newAverageCost;
        const saleAmount = quantityKg * salePrice;
        const profit = saleAmount - purchaseAmount;

        await tx.update(aircraftRefueling)
          .set({
            purchasePrice: newAverageCost.toFixed(4),
            purchaseAmount: purchaseAmount.toFixed(2),
            profit: profit.toFixed(2),
            purchasePriceModified: true,
            updatedAt: sql`NOW()`,
            updatedById: updatedById,
          })
          .where(eq(aircraftRefueling.id, refuel.id));
      }
    }
  }

  async updateMovement(id: string, data: Partial<InsertMovement>): Promise<Movement | undefined> {
    return await db.transaction(async (tx) => {
      const currentMovement = await tx.query.movement.findFirst({
        where: eq(movement.id, id),
        with: {
          toWarehouse: true,
          fromWarehouse: true,
          transaction: true,
        }
      });

      if (!currentMovement) return undefined;

      const oldQuantityKg = parseFloat(currentMovement.quantityKg);
      const oldTotalCost = parseFloat(currentMovement.totalCost || "0");
      const newQuantityKg = data.quantityKg ? parseFloat(data.quantityKg.toString()) : oldQuantityKg;
      const newTotalCost = data.totalCost ? parseFloat(data.totalCost.toString()) : oldTotalCost;
      const isPvkj = currentMovement.productType === PRODUCT_TYPE.PVKJ;

      const hasQuantityChanged = oldQuantityKg !== newQuantityKg;
      const hasCostChanged = oldTotalCost !== newTotalCost;
      const needsRecalculation = hasQuantityChanged || hasCostChanged;

      // Обновляем склад назначения, если изменились показатели
      if (needsRecalculation && currentMovement.transactionId && currentMovement.toWarehouseId && currentMovement.toWarehouse) {
        const quantityDiff = newQuantityKg - oldQuantityKg;
        const costDiff = newTotalCost - oldTotalCost;

        if (isPvkj) {
          const currentBalance = parseFloat(currentMovement.toWarehouse.pvkjBalance || "0");
          const currentCost = parseFloat(currentMovement.toWarehouse.pvkjAverageCost || "0");
          
          // Откатываем старую операцию
          const balanceBeforeOldOperation = currentBalance - oldQuantityKg;
          const totalCostBeforeOldOperation = balanceBeforeOldOperation * currentCost;
          
          // Применяем новую операцию
          const newBalance = balanceBeforeOldOperation + newQuantityKg;
          const newTotalCostInWarehouse = totalCostBeforeOldOperation + newTotalCost;
          const newAverageCost = newBalance > 0 ? newTotalCostInWarehouse / newBalance : 0;

          await tx.update(warehouses)
            .set({
              pvkjBalance: newBalance.toFixed(2),
              pvkjAverageCost: newAverageCost.toFixed(4),
              updatedAt: sql`NOW()`,
              updatedById: data.updatedById
            })
            .where(eq(warehouses.id, currentMovement.toWarehouseId));

          await tx.update(warehouseTransactions)
            .set({
              quantity: newQuantityKg.toString(),
              balanceAfter: newBalance.toString(),
              averageCostAfter: newAverageCost.toFixed(4),
              updatedAt: sql`NOW()`,
              updatedById: data.updatedById
            })
            .where(eq(warehouseTransactions.id, currentMovement.transactionId));

          // Пересчитываем связанные сделки
          await this.recalculateDealsAfterMovement(
            tx,
            currentMovement.toWarehouseId,
            currentMovement.movementDate,
            PRODUCT_TYPE.PVKJ,
            newAverageCost,
            data.updatedById
          );
        } else {
          const currentBalance = parseFloat(currentMovement.toWarehouse.currentBalance || "0");
          const currentCost = parseFloat(currentMovement.toWarehouse.averageCost || "0");
          
          // Откатываем старую операцию
          const balanceBeforeOldOperation = currentBalance - oldQuantityKg;
          const totalCostBeforeOldOperation = balanceBeforeOldOperation * currentCost;
          
          // Применяем новую операцию
          const newBalance = balanceBeforeOldOperation + newQuantityKg;
          const newTotalCostInWarehouse = totalCostBeforeOldOperation + newTotalCost;
          const newAverageCost = newBalance > 0 ? newTotalCostInWarehouse / newBalance : 0;

          await tx.update(warehouses)
            .set({
              currentBalance: newBalance.toFixed(2),
              averageCost: newAverageCost.toFixed(4),
              updatedAt: sql`NOW()`,
              updatedById: data.updatedById
            })
            .where(eq(warehouses.id, currentMovement.toWarehouseId));

          await tx.update(warehouseTransactions)
            .set({
              quantity: newQuantityKg.toString(),
              balanceAfter: newBalance.toString(),
              averageCostAfter: newAverageCost.toFixed(4),
              updatedAt: sql`NOW()`,
              updatedById: data.updatedById
            })
            .where(eq(warehouseTransactions.id, currentMovement.transactionId));

          // Пересчитываем связанные сделки
          await this.recalculateDealsAfterMovement(
            tx,
            currentMovement.toWarehouseId,
            currentMovement.movementDate,
            PRODUCT_TYPE.KEROSENE,
            newAverageCost,
            data.updatedById
          );
        }
      }

      // Обновляем склад-источник для внутренних перемещений
      if (needsRecalculation && currentMovement.movementType === MOVEMENT_TYPE.INTERNAL && currentMovement.fromWarehouseId && currentMovement.fromWarehouse) {
        const quantityDiff = newQuantityKg - oldQuantityKg;

        if (isPvkj) {
          const currentBalance = parseFloat(currentMovement.fromWarehouse.pvkjBalance || "0");
          const newBalance = Math.max(0, currentBalance - quantityDiff);

          await tx.update(warehouses)
            .set({
              pvkjBalance: newBalance.toFixed(2),
              updatedAt: sql`NOW()`,
              updatedById: data.updatedById
            })
            .where(eq(warehouses.id, currentMovement.fromWarehouseId));
        } else {
          const currentBalance = parseFloat(currentMovement.fromWarehouse.currentBalance || "0");
          const newBalance = Math.max(0, currentBalance - quantityDiff);

          await tx.update(warehouses)
            .set({
              currentBalance: newBalance.toFixed(2),
              updatedAt: sql`NOW()`,
              updatedById: data.updatedById
            })
            .where(eq(warehouses.id, currentMovement.fromWarehouseId));
        }
      }

      // Обновляем перемещение
      const [updated] = await tx.update(movement).set({
        ...data,
        updatedAt: sql`NOW()`,
        updatedById: data.updatedById
      }).where(eq(movement.id, id)).returning();

      return updated;
    });
  }

  async deleteMovement(id: string): Promise<boolean> {
    await db.transaction(async (tx) => {
      const currentMovement = await tx.query.movement.findFirst({
        where: eq(movement.id, id),
        with: {
          toWarehouse: true,
          fromWarehouse: true,
          transaction: true,
        }
      });

      if (!currentMovement) return;

      const quantityKg = parseFloat(currentMovement.quantityKg);
      const totalCost = parseFloat(currentMovement.totalCost || "0");
      const isPvkj = currentMovement.productType === PRODUCT_TYPE.PVKJ;

      // Откатываем изменения на складе назначения
      if (currentMovement.transactionId && currentMovement.toWarehouseId && currentMovement.toWarehouse) {
        if (isPvkj) {
          const currentBalance = parseFloat(currentMovement.toWarehouse.pvkjBalance || "0");
          const currentCost = parseFloat(currentMovement.toWarehouse.pvkjAverageCost || "0");
          const newBalance = Math.max(0, currentBalance - quantityKg);
          
          // Пересчитываем среднюю себестоимость
          const totalCostBeforeRemoval = currentBalance * currentCost;
          const newTotalCost = Math.max(0, totalCostBeforeRemoval - totalCost);
          const newAverageCost = newBalance > 0 ? newTotalCost / newBalance : 0;

          await tx.update(warehouses)
            .set({
              pvkjBalance: newBalance.toFixed(2),
              pvkjAverageCost: newAverageCost.toFixed(4),
              updatedAt: sql`NOW()`,
            })
            .where(eq(warehouses.id, currentMovement.toWarehouseId));

          // Удаляем транзакцию
          await tx.delete(warehouseTransactions).where(eq(warehouseTransactions.id, currentMovement.transactionId));

          // Пересчитываем связанные сделки
          await this.recalculateDealsAfterMovement(
            tx,
            currentMovement.toWarehouseId,
            currentMovement.movementDate,
            PRODUCT_TYPE.PVKJ,
            newAverageCost,
            undefined
          );
        } else {
          const currentBalance = parseFloat(currentMovement.toWarehouse.currentBalance || "0");
          const currentCost = parseFloat(currentMovement.toWarehouse.averageCost || "0");
          const newBalance = Math.max(0, currentBalance - quantityKg);
          
          // Пересчитываем среднюю себестоимость
          const totalCostBeforeRemoval = currentBalance * currentCost;
          const newTotalCost = Math.max(0, totalCostBeforeRemoval - totalCost);
          const newAverageCost = newBalance > 0 ? newTotalCost / newBalance : 0;

          await tx.update(warehouses)
            .set({
              currentBalance: newBalance.toFixed(2),
              averageCost: newAverageCost.toFixed(4),
              updatedAt: sql`NOW()`,
            })
            .where(eq(warehouses.id, currentMovement.toWarehouseId));

          // Удаляем транзакцию
          await tx.delete(warehouseTransactions).where(eq(warehouseTransactions.id, currentMovement.transactionId));

          // Пересчитываем связанные сделки
          await this.recalculateDealsAfterMovement(
            tx,
            currentMovement.toWarehouseId,
            currentMovement.movementDate,
            PRODUCT_TYPE.KEROSENE,
            newAverageCost,
            undefined
          );
        }
      }

      // Откатываем изменения на складе-источнике для внутренних перемещений
      if (currentMovement.movementType === MOVEMENT_TYPE.INTERNAL && currentMovement.fromWarehouseId && currentMovement.fromWarehouse) {
        if (isPvkj) {
          const currentBalance = parseFloat(currentMovement.fromWarehouse.pvkjBalance || "0");
          const newBalance = currentBalance + quantityKg;

          await tx.update(warehouses)
            .set({
              pvkjBalance: newBalance.toFixed(2),
              updatedAt: sql`NOW()`,
            })
            .where(eq(warehouses.id, currentMovement.fromWarehouseId));
        } else {
          const currentBalance = parseFloat(currentMovement.fromWarehouse.currentBalance || "0");
          const newBalance = currentBalance + quantityKg;

          await tx.update(warehouses)
            .set({
              currentBalance: newBalance.toFixed(2),
              updatedAt: sql`NOW()`,
            })
            .where(eq(warehouses.id, currentMovement.fromWarehouseId));
        }
      }

      await tx.delete(movement).where(eq(movement.id, id));
    });

    return true;
  }
}
