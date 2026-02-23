import { db } from "../../../db";
import {
  equipmentMovement,
  type EquipmentMovement,
  type InsertEquipmentMovement,
} from "../entities/equipment-movement";
import { eq, and, isNull, desc, or, ilike, sql } from "drizzle-orm";
import { TRANSACTION_TYPE, SOURCE_TYPE } from "@shared/constants";
import { EquipmentTransactionService } from "../../warehouses-equipment/services/equipment-transaction-service";
import { WarehouseTransactionService } from "server/modules/warehouses/services/warehouse-transaction-service";

export class EquipmentMovementStorage {
  async getMovements(
    offset: number,
    pageSize: number,
    search?: string,
    filters?: Record<string, string[]>,
  ) {
    let query = db
      .select()
      .from(equipmentMovement)
      .where(isNull(equipmentMovement.deletedAt));

    if (search) {
      query = query.where(ilike(equipmentMovement.notes, `%${search}%`));
    }

    const items = await db
      .select({
        id: equipmentMovement.id,
        movementDate: equipmentMovement.movementDate,
        productType: equipmentMovement.productType,
        fromWarehouseId: equipmentMovement.fromWarehouseId,
        toWarehouseId: equipmentMovement.toWarehouseId,
        fromEquipmentId: equipmentMovement.fromEquipmentId,
        toEquipmentId: equipmentMovement.toEquipmentId,
        quantityKg: equipmentMovement.quantityKg,
        costPerKg: equipmentMovement.costPerKg,
        notes: equipmentMovement.notes,
        fromWarehouseName: sql<string>`(SELECT name FROM warehouses WHERE id = ${equipmentMovement.fromWarehouseId})`,
        toWarehouseName: sql<string>`(SELECT name FROM warehouses WHERE id = ${equipmentMovement.toWarehouseId})`,
        fromEquipmentName: sql<string>`(SELECT name FROM equipments WHERE id = ${equipmentMovement.fromEquipmentId})`,
        toEquipmentName: sql<string>`(SELECT name FROM equipments WHERE id = ${equipmentMovement.toEquipmentId})`,
      })
      .from(equipmentMovement)
      .where(isNull(equipmentMovement.deletedAt))
      .limit(pageSize)
      .offset(offset)
      .orderBy(desc(equipmentMovement.movementDate));

    // @ts-ignore - totalResult might be undefined but we handle it with totalCount
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(equipmentMovement)
      .where(isNull(equipmentMovement.deletedAt));

    const totalCount = Number(totalResult?.count || 0);

    return { items, total: totalCount };
  }

  async getMovement(id: string): Promise<EquipmentMovement | undefined> {
    const [item] = await db
      .select()
      .from(equipmentMovement)
      .where(
        and(eq(equipmentMovement.id, id), isNull(equipmentMovement.deletedAt)),
      );
    return item;
  }

  async createMovement(data: any): Promise<EquipmentMovement> {
    return await db.transaction(async (tx) => {
      const [item] = await tx
        .insert(equipmentMovement)
        .values(data)
        .returning();

      if (data.isDraft) {
        return item;
      }

      const quantityKg = parseFloat(item.quantityKg || "0");
      const totalCost = parseFloat(item.totalCost || "0");

      // Destination equipment (income)
      if (item.toEquipmentId) {
        const transaction =
          await EquipmentTransactionService.createTransactionAndUpdateEquipment(
            tx,
            item.toEquipmentId,
            TRANSACTION_TYPE.TRANSFER_IN,
            item.productType,
            SOURCE_TYPE.MOVEMENT,
            item.id,
            quantityKg,
            totalCost,
            item.createdById || undefined,
            item.movementDate,
          );

        await tx
          .update(equipmentMovement)
          .set({ transactionId: transaction.id })
          .where(eq(equipmentMovement.id, item.id));
      }

      // Обработка склада назначения (если возвращаем с ТЗК на склад)
      if (item.toWarehouseId) {
        const { transaction } =
          await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
            tx,
            item.toWarehouseId,
            TRANSACTION_TYPE.TRANSFER_IN,
            item.productType,
            SOURCE_TYPE.MOVEMENT,
            item.id,
            quantityKg,
            totalCost,
            item.createdById || undefined,
            item.movementDate,
          );

        await tx
          .update(equipmentMovement)
          .set({ warehouseTransactionId: transaction.id })
          .where(eq(equipmentMovement.id, item.id));
      }

      if (item.fromWarehouseId) {
        const { transaction: sourceTransaction } =
          await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
            tx,
            item.fromWarehouseId,
            TRANSACTION_TYPE.TRANSFER_OUT,
            item.productType,
            SOURCE_TYPE.MOVEMENT,
            item.id,
            quantityKg,
            0, // При расходе totalCost = 0
            item.createdById || undefined,
            item.movementDate,
          );

        await tx
          .update(equipmentMovement)
          .set({ sourceWarehouseTransactionId: sourceTransaction.id })
          .where(eq(equipmentMovement.id, item.id));
      }

      // Source equipment (expense)
      if (item.fromEquipmentId) {
        const sourceTransaction =
          await EquipmentTransactionService.createTransactionAndUpdateEquipment(
            tx,
            item.fromEquipmentId,
            TRANSACTION_TYPE.TRANSFER_OUT,
            item.productType,
            SOURCE_TYPE.MOVEMENT,
            item.id,
            quantityKg,
            0,
            item.createdById || undefined,
            item.movementDate,
          );

        await tx
          .update(equipmentMovement)
          .set({ sourceTransactionId: sourceTransaction.id })
          .where(eq(equipmentMovement.id, item.id));
      }

      return item;
    });
  }

  async updateMovement(
    id: string,
    data: any,
  ): Promise<EquipmentMovement | undefined> {
    return await db.transaction(async (tx) => {
      const current = await this.getMovement(id);
      if (!current) throw new Error("Запись не найдена");

      const transitioningFromDraft = current.isDraft && data.isDraft === false;

      if (
        data.productType &&
        data.productType !== current.productType &&
        !current.isDraft
      ) {
        throw new Error(
          "Нельзя поменять тип продукта для существующего перемещения",
        );
      }

      if (transitioningFromDraft) {
        const quantityKg = parseFloat(data.quantityKg || "0");
        const totalCost = parseFloat(data.totalCost || "0");

        if (data.toEquipmentId) {
          const transaction =
            await EquipmentTransactionService.createTransactionAndUpdateEquipment(
              tx,
              data.toEquipmentId,
              TRANSACTION_TYPE.TRANSFER_IN,
              data.productType,
              SOURCE_TYPE.MOVEMENT,
              current.id,
              quantityKg,
              totalCost,
              data.updatedById || undefined,
              data.movementDate,
            );
          data.transactionId = transaction.id;
        }

        if (data.toWarehouseId) {
          const { transaction } =
            await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
              tx,
              data.toWarehouseId,
              TRANSACTION_TYPE.TRANSFER_IN,
              data.productType,
              SOURCE_TYPE.MOVEMENT,
              current.id,
              quantityKg,
              totalCost,
              data.createdById || undefined,
              data.movementDate,
            );

          data.warehouseTransactionId = transaction.id;
        }

        if (data.fromWarehouseId) {
          const { transaction: sourceTransaction } =
            await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
              tx,
              data.fromWarehouseId,
              TRANSACTION_TYPE.TRANSFER_OUT,
              data.productType,
              SOURCE_TYPE.MOVEMENT,
              current.id,
              quantityKg,
              0, // При расходе totalCost = 0
              data.createdById || undefined,
              data.movementDate,
            );

          data.sourceWarehouseTransactionId = sourceTransaction.id;
        }

        if (data.fromEquipmentId) {
          const sourceTransaction =
            await EquipmentTransactionService.createTransactionAndUpdateEquipment(
              tx,
              data.fromEquipmentId,
              TRANSACTION_TYPE.TRANSFER_OUT,
              data.productType,
              SOURCE_TYPE.MOVEMENT,
              current.id,
              quantityKg,
              0,
              data.updatedById || undefined,
              data.movementDate,
            );
          data.sourceTransactionId = sourceTransaction.id;
        }
      } else if (!data.isDraft && !current.isDraft) {
        // Logic for updating existing transactions if quantity/cost changed
        const oldQty = parseFloat(current.quantityKg || "0");
        const newQty = parseFloat(data.quantityKg || "0");
        const oldCost = parseFloat(current.totalCost || "0");
        const newCost = parseFloat(data.totalCost || "0");

        if (oldQty !== newQty || oldCost !== newCost) {
          if (data.movementType !== current.movementType) {
            throw new Error(
              "Нельзя поменять тип для существующего перемещения",
            );
          }

          if (current.transactionId && current.toEquipmentId) {
            await EquipmentTransactionService.updateTransactionAndRecalculateEquipment(
              tx,
              current.transactionId,
              current.toEquipmentId,
              oldQty,
              oldCost,
              newQty,
              newCost,
              current.productType,
              data.updatedById || undefined,
              data.movementDate,
            );
          }

          if (current.warehouseTransactionId && current.toWarehouseId) {
            await WarehouseTransactionService.updateTransactionAndRecalculateWarehouse(
              tx,
              current.warehouseTransactionId,
              current.toWarehouseId,
              oldQty,
              oldCost,
              newQty,
              newCost,
              current.productType,
              data.updatedById || undefined,
              data.movementDate || undefined,
            );
          }

          if (current.sourceWarehouseTransactionId && current.fromWarehouseId) {
            await WarehouseTransactionService.updateTransactionAndRecalculateWarehouse(
              tx,
              current.sourceWarehouseTransactionId,
              current.fromWarehouseId,
              oldQty,
              0, // При расходе totalCost = 0
              newQty,
              0, // При расходе totalCost = 0
              current.productType,
              data.updatedById || undefined,
              data.movementDate || undefined,
            );
          }

          if (current.sourceTransactionId && current.fromEquipmentId) {
            await EquipmentTransactionService.updateTransactionAndRecalculateEquipment(
              tx,
              current.sourceTransactionId,
              current.fromEquipmentId,
              oldQty,
              0,
              newQty,
              0,
              current.productType,
              data.updatedById || undefined,
              data.movementDate,
            );
          }
        }
      }

      const [updated] = await tx
        .update(equipmentMovement)
        .set({
          ...data,
          updatedAt: sql`NOW()`,
          updatedById: data.updatedById,
        })
        .where(eq(equipmentMovement.id, id))
        .returning();

      return updated;
    });
  }

  async deleteMovement(id: string, userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      const current = await this.getMovement(id);
      if (!current) return;

      if (current.transactionId) {
        await EquipmentTransactionService.deleteTransactionAndRevertEquipment(
          tx,
          current.transactionId,
          userId,
        );
      }
      if (current.sourceTransactionId) {
        await EquipmentTransactionService.deleteTransactionAndRevertEquipment(
          tx,
          current.sourceTransactionId,
          userId,
        );
      }
      if (current.warehouseTransactionId) {
        await WarehouseTransactionService.deleteTransactionAndRevertWarehouse(
          tx,
          current.warehouseTransactionId,
          userId,
        );
      }
      if (current.sourceWarehouseTransactionId) {
        await WarehouseTransactionService.deleteTransactionAndRevertWarehouse(
          tx,
          current.sourceWarehouseTransactionId,
          userId,
        );
      }

      await tx
        .update(equipmentMovement)
        .set({ deletedAt: new Date().toISOString(), deletedById: userId })
        .where(eq(equipmentMovement.id, id));
    });
  }

  async restoreMovement(
    id: string,
    oldData: any,
    userId: string,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(equipmentMovement)
        .set({ deletedAt: null, deletedById: null })
        .where(eq(equipmentMovement.id, id));

      if (oldData.transactionId) {
        await EquipmentTransactionService.restoreTransactionAndRecalculateEquipment(
          tx,
          oldData.transactionId,
          userId,
        );
      }
      if (oldData.sourceTransactionId) {
        await EquipmentTransactionService.restoreTransactionAndRecalculateEquipment(
          tx,
          oldData.sourceTransactionId,
          userId,
        );
      }
      if (oldData.warehouseTransactionId) {
        await WarehouseTransactionService.restoreTransactionAndRecalculateWarehouse(
          tx,
          oldData.warehouseTransactionId,
          userId,
        );
      }

      if (oldData.sourceWarehouseTransactionId) {
        await WarehouseTransactionService.restoreTransactionAndRecalculateWarehouse(
          tx,
          oldData.sourceWarehouseTransactionId,
          userId,
        );
      }
    });
  }
}
