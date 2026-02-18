import { eq, desc, sql, and, gt, isNull, or } from "drizzle-orm";
import { db } from "server/db";
import {
  movement,
  warehouses,
  warehouseTransactions,
  logisticsCarriers,
  opt,
  aircraftRefueling,
  type Movement,
  type InsertMovement,
  suppliers,
} from "@shared/schema";
import { IMovementStorage } from "./types";
import {
  PRODUCT_TYPE,
  MOVEMENT_TYPE,
  TRANSACTION_TYPE,
  SOURCE_TYPE,
} from "@shared/constants";
import { WarehouseTransactionService } from "../../warehouses/services/warehouse-transaction-service";

export class MovementStorage implements IMovementStorage {
  async getMovement(id: string): Promise<Movement | undefined> {
    return db.query.movement.findFirst({
      where: and(eq(movement.id, id), isNull(movement.deletedAt)),
      with: {
        fromWarehouse: true,
        toWarehouse: true,
        carrier: true,
        createdBy: {
          columns: {
            id: true,
            username: true,
            email: true,
          },
        },
        updatedBy: {
          columns: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
  }

  async getMovements(
    offset: number,
    pageSize: number,
    search?: string,
    filters?: Record<string, string[]>,
  ): Promise<{ data: any[]; total: number }> {
    const baseConditions: any[] = [isNull(movement.deletedAt)];

    if (filters) {
      if (filters.date?.length) {
        baseConditions.push(
          sql`TO_CHAR(${movement.movementDate}, 'DD.MM.YYYY') IN (${sql.join(
            filters.date.map((v) => sql`${v}`),
            sql`, `,
          )})`,
        );
      }
      if (filters.type?.length) {
        baseConditions.push(
          sql`${movement.movementType} IN (${sql.join(
            filters.type.map((v) => sql`${v}`),
            sql`, `,
          )})`,
        );
      }
      if (filters.product?.length) {
        baseConditions.push(
          sql`${movement.productType} IN (${sql.join(
            filters.product.map((v) => sql`${v}`),
            sql`, `,
          )})`,
        );
      }
      if (filters.from?.length) {
        baseConditions.push(
          or(
            and(
              eq(movement.movementType, MOVEMENT_TYPE.SUPPLY),
              sql`(SELECT name FROM suppliers WHERE id = ${movement.supplierId}) IN (${sql.join(
                filters.from.map((v) => sql`${v}`),
                sql`, `,
              )})`,
            ),
            and(
              eq(movement.movementType, MOVEMENT_TYPE.INTERNAL),
              sql`(SELECT name FROM warehouses WHERE id = ${movement.fromWarehouseId}) IN (${sql.join(
                filters.from.map((v) => sql`${v}`),
                sql`, `,
              )})`,
            ),
          ),
        );
      }
      if (filters.to?.length) {
        baseConditions.push(
          sql`(SELECT name FROM warehouses WHERE id = ${movement.toWarehouseId}) IN (${sql.join(
            filters.to.map((v) => sql`${v}`),
            sql`, `,
          )})`,
        );
      }
      if (filters.carrier?.length) {
        baseConditions.push(
          sql`(SELECT name FROM logistics_carriers WHERE id = ${movement.carrierId}) IN (${sql.join(
            filters.carrier.map((v) => sql`${v}`),
            sql`, `,
          )})`,
        );
      }
    }

    if (search && search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      baseConditions.push(
        or(
          sql`(SELECT name FROM suppliers WHERE id = ${movement.supplierId}) ILIKE ${searchPattern}`,
          sql`(SELECT name FROM warehouses WHERE id = ${movement.fromWarehouseId}) ILIKE ${searchPattern}`,
          sql`(SELECT name FROM warehouses WHERE id = ${movement.toWarehouseId}) ILIKE ${searchPattern}`,
          sql`(SELECT name FROM logistics_carriers WHERE id = ${movement.carrierId}) ILIKE ${searchPattern}`,
        ),
      );
    }

    const whereCondition = and(...baseConditions);

    const data = await db.query.movement.findMany({
      where: whereCondition,
      limit: pageSize,
      offset: offset,
      orderBy: (movement, { desc }) => [desc(movement.movementDate)],
      with: {
        supplier: {
          columns: {
            id: true,
            name: true,
          },
        },
        fromWarehouse: {
          columns: {
            id: true,
            name: true,
          },
        },
        toWarehouse: {
          columns: {
            id: true,
            name: true,
          },
        },
        carrier: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    const enrichedData = data.map((mov) => ({
      ...mov,
      fromName:
        mov.movementType === MOVEMENT_TYPE.SUPPLY && mov.supplier
          ? (mov.supplier as any).name
          : (mov.fromWarehouse as any)?.name || null,
      toName: (mov.toWarehouse as any)?.name || mov.toWarehouseId,
      carrierName: (mov.carrier as any)?.name || null,
    }));

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(movement)
      .where(whereCondition);
    return {
      data: enrichedData as any[],
      total: Number(countResult?.count || 0),
    };
  }

  async createMovement(data: any): Promise<Movement> {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(movement).values(data).returning();

      if (data.isDraft) {
        return created;
      }

      const quantityKg = parseFloat(created.quantityKg);
      const totalCost = parseFloat(created.totalCost || "0");

      // Обработка склада назначения (приход)
      if (created.toWarehouseId) {
        const { transaction } =
          await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
            tx,
            created.toWarehouseId,
            created.movementType === MOVEMENT_TYPE.SUPPLY
              ? TRANSACTION_TYPE.RECEIPT
              : TRANSACTION_TYPE.TRANSFER_IN,
            created.productType,
            SOURCE_TYPE.MOVEMENT,
            created.id,
            quantityKg,
            totalCost,
            data.createdById,
            data.movementDate,
          );

        await tx
          .update(movement)
          .set({ transactionId: transaction.id })
          .where(eq(movement.id, created.id));
      }

      // Обработка склада-источника для внутреннего перемещения (расход)
      if (
        created.movementType === MOVEMENT_TYPE.INTERNAL &&
        created.fromWarehouseId
      ) {
        const { transaction: sourceTransaction } =
          await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
            tx,
            created.fromWarehouseId,
            TRANSACTION_TYPE.TRANSFER_OUT,
            created.productType,
            SOURCE_TYPE.MOVEMENT,
            created.id,
            quantityKg,
            0, // При расходе totalCost = 0
            data.createdById,
            data.movementDate,
          );

        await tx
          .update(movement)
          .set({ sourceTransactionId: sourceTransaction.id })
          .where(eq(movement.id, created.id));
      }

      return created;
    });
  }

  async updateMovement(
    id: string,
    data: any,
  ): Promise<Movement | undefined> {
    return await db.transaction(async (tx) => {
      const currentMovement = await tx.query.movement.findFirst({
        where: eq(movement.id, id),
      });

      if (!currentMovement) {
        throw new Error("Перемещение не найдено");
      }

      if (data.productType !== currentMovement.productType) {
        throw new Error(
          "Нельзя поменять тип продукта для существующего перемещения",
        );
      }

      const oldQuantityKg = parseFloat(currentMovement.quantityKg);
      const oldTotalCost = parseFloat(currentMovement.totalCost || "0");
      const newQuantityKg = data.quantityKg
        ? parseFloat(data.quantityKg.toString())
        : oldQuantityKg;
      const newTotalCost = data.totalCost
        ? parseFloat(data.totalCost.toString())
        : oldTotalCost;

      const hasQuantityChanged = oldQuantityKg !== newQuantityKg;
      const hasCostChanged = oldTotalCost !== newTotalCost;
      const needsRecalculation = (hasQuantityChanged || hasCostChanged) && !data.isDraft;

      // Обновляем склад назначения, если изменились показатели
      if (
        needsRecalculation &&
        currentMovement.transactionId &&
        currentMovement.toWarehouseId
      ) {
        if (data.toWarehouseId !== currentMovement.toWarehouseId) {
          throw new Error(
            "Нельзя поменять склад назначения для существующего перемещения",
          );
        }

        await WarehouseTransactionService.updateTransactionAndRecalculateWarehouse(
          tx,
          currentMovement.transactionId,
          currentMovement.toWarehouseId,
          oldQuantityKg,
          oldTotalCost,
          newQuantityKg,
          newTotalCost,
          currentMovement.productType,
          data.updatedById || undefined,
          data.movementDate || undefined,
        );
      }

      // Обновляем склад-источник для внутренних перемещений
      if (
        needsRecalculation &&
        currentMovement.movementType === MOVEMENT_TYPE.INTERNAL &&
        currentMovement.sourceTransactionId &&
        currentMovement.fromWarehouseId
      ) {
        if (data.fromWarehouseId && data.fromWarehouseId !== currentMovement.fromWarehouseId) {
          throw new Error(
            "Нельзя поменять склад-источник для существующего перемещения",
          );
        }

        await WarehouseTransactionService.updateTransactionAndRecalculateWarehouse(
          tx,
          currentMovement.sourceTransactionId,
          currentMovement.fromWarehouseId,
          oldQuantityKg,
          0, // При расходе totalCost = 0
          newQuantityKg,
          0, // При расходе totalCost = 0
          currentMovement.productType,
          data.updatedById || undefined,
          data.movementDate || undefined,
        );
      }

      const [updated] = await tx
        .update(movement)
        .set({
          ...data,
          updatedAt: sql`NOW()`,
          updatedById: data.updatedById,
        })
        .where(eq(movement.id, id))
        .returning();

      return updated;
    });
  }

  async deleteMovement(id: string, userId?: string): Promise<boolean> {
    await db.transaction(async (tx) => {
      const currentMovement = await tx.query.movement.findFirst({
        where: eq(movement.id, id),
      });

      if (!currentMovement) {
        throw new Error("Перемещение не найдено");
      }

      // Откатываем изменения на складе назначения
      if (currentMovement.transactionId) {
        await WarehouseTransactionService.deleteTransactionAndRevertWarehouse(
          tx,
          currentMovement.transactionId,
          userId,
        );
      }

      // Откатываем изменения на складе-источнике для внутренних перемещений
      if (
        currentMovement.movementType === MOVEMENT_TYPE.INTERNAL &&
        currentMovement.sourceTransactionId
      ) {
        await WarehouseTransactionService.deleteTransactionAndRevertWarehouse(
          tx,
          currentMovement.sourceTransactionId,
          userId,
        );
      }

      // Soft delete
      await tx
        .update(movement)
        .set({
          deletedAt: sql`NOW()`,
          deletedById: userId,
        })
        .where(eq(movement.id, id));
    });

    return true;
  }

  async restoreMovement(
    id: string,
    oldData: any,
    userId?: string,
  ): Promise<boolean> {
    await db.transaction(async (tx) => {
      // Restore the movement record
      await tx
        .update(movement)
        .set({
          deletedAt: null,
          deletedById: null,
        })
        .where(eq(movement.id, id));

      // Restore associated transactions
      if (oldData.transactionId) {
        await WarehouseTransactionService.restoreTransactionAndRecalculateWarehouse(
          tx,
          oldData.transactionId,
          userId,
        );
      }

      if (oldData.sourceTransactionId) {
        await WarehouseTransactionService.restoreTransactionAndRecalculateWarehouse(
          tx,
          oldData.sourceTransactionId,
          userId,
        );
      }
    });

    return true;
  }
}
