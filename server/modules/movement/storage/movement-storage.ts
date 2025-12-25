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
import { WarehouseTransactionService } from "../../warehouses/services/warehouse-transaction-service";
import { WarehouseRecalculationService } from "../../warehouses/services/warehouse-recalculation-service";

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
      const totalCost = parseFloat(created.totalCost || "0");
      const isPvkj = created.productType === PRODUCT_TYPE.PVKJ;

      // Обработка склада назначения (приход)
      if (created.toWarehouseId) {
        const { transaction } = await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
          tx,
          created.toWarehouseId,
          created.movementType === MOVEMENT_TYPE.SUPPLY ? TRANSACTION_TYPE.RECEIPT : TRANSACTION_TYPE.TRANSFER_IN,
          created.productType,
          SOURCE_TYPE.MOVEMENT,
          created.id,
          quantityKg,
          totalCost,
          data.createdById
        );

        await tx.update(movement)
          .set({ transactionId: transaction.id })
          .where(eq(movement.id, created.id));
      }

      // Обработка склада-источника для внутреннего перемещения (расход)
      if (created.movementType === MOVEMENT_TYPE.INTERNAL && created.fromWarehouseId) {
        const { transaction: sourceTransaction } = await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
          tx,
          created.fromWarehouseId,
          TRANSACTION_TYPE.TRANSFER_OUT,
          created.productType,
          SOURCE_TYPE.MOVEMENT,
          created.id,
          quantityKg,
          0, // При расходе totalCost = 0
          data.createdById
        );

        await tx.update(movement)
          .set({ sourceTransactionId: sourceTransaction.id })
          .where(eq(movement.id, created.id));
      }

      return created;
    });
  }

  async updateMovement(id: string, data: Partial<InsertMovement>): Promise<Movement | undefined> {
    return await db.transaction(async (tx) => {
      const currentMovement = await tx.query.movement.findFirst({
        where: eq(movement.id, id),
        with: {
          toWarehouse: true,
          fromWarehouse: true,
          transaction: true,
          sourceTransaction: true,
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
        await WarehouseTransactionService.updateTransactionAndRecalculateWarehouse(
          tx,
          currentMovement.transactionId,
          currentMovement.toWarehouseId,
          oldQuantityKg,
          oldTotalCost,
          newQuantityKg,
          newTotalCost,
          currentMovement.productType,
          data.updatedById
        );
      }

      // Обновляем склад-источник для внутренних перемещений
      if (needsRecalculation && currentMovement.movementType === MOVEMENT_TYPE.INTERNAL && currentMovement.sourceTransactionId && currentMovement.fromWarehouseId && currentMovement.fromWarehouse) {
        await WarehouseTransactionService.updateTransactionAndRecalculateWarehouse(
          tx,
          currentMovement.sourceTransactionId,
          currentMovement.fromWarehouseId,
          oldQuantityKg,
          0,
          newQuantityKg,
          0,
          currentMovement.productType,
          data.updatedById
        );
      }

      // КОМПЛЕКСНЫЙ ПЕРЕСЧЕТ: пересчитываем все затронутые склады и связанные транзакции
      if (needsRecalculation) {
        const affectedWarehouses = WarehouseRecalculationService.getAffectedWarehouses(
          currentMovement,
          currentMovement.movementDate
        );

        await WarehouseRecalculationService.recalculateAllAffectedTransactions(
          tx,
          affectedWarehouses,
          data.updatedById
        );
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
          sourceTransaction: true,
        }
      });

      if (!currentMovement) return;

      const quantityKg = parseFloat(currentMovement.quantityKg);
      const totalCost = parseFloat(currentMovement.totalCost || "0");

      // Откатываем изменения на складе назначения
      if (currentMovement.transactionId && currentMovement.toWarehouseId && currentMovement.toWarehouse) {
        await WarehouseTransactionService.deleteTransactionAndRevertWarehouse(
          tx,
          currentMovement.transactionId,
          currentMovement.toWarehouseId,
          quantityKg,
          totalCost,
          currentMovement.productType
        );
      }

      // Откатываем изменения на складе-источнике для внутренних перемещений
      if (currentMovement.movementType === MOVEMENT_TYPE.INTERNAL && currentMovement.sourceTransactionId && currentMovement.fromWarehouseId && currentMovement.fromWarehouse) {
        await WarehouseTransactionService.deleteTransactionAndRevertWarehouse(
          tx,
          currentMovement.sourceTransactionId,
          currentMovement.fromWarehouseId,
          quantityKg,
          0,
          currentMovement.productType
        );
      }

      // КОМПЛЕКСНЫЙ ПЕРЕСЧЕТ: пересчитываем все затронутые склады и связанные транзакции
      const affectedWarehouses = WarehouseRecalculationService.getAffectedWarehouses(
        currentMovement,
        currentMovement.movementDate
      );

      await WarehouseRecalculationService.recalculateAllAffectedTransactions(
        tx,
        affectedWarehouses,
        undefined
      );

      await tx.delete(movement).where(eq(movement.id, id));
    });

    return true;
  }
}