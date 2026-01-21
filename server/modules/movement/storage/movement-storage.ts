import { eq, desc, sql, and, gt, isNull, or } from "drizzle-orm";
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
import {
  PRODUCT_TYPE,
  MOVEMENT_TYPE,
  TRANSACTION_TYPE,
  SOURCE_TYPE,
} from "@shared/constants";
import { WarehouseTransactionService } from "../../warehouses/services/warehouse-transaction-service";
import { WarehouseRecalculationService } from "../../warehouses/services/warehouse-recalculation-service";

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
    page: number,
    pageSize: number,
    filters?: Record<string, string[]>,
  ): Promise<{ data: Movement[]; total: number }> {
    const offset = (page - 1) * pageSize;

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

  async createMovement(data: InsertMovement): Promise<Movement> {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(movement).values(data).returning();

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
    data: Partial<InsertMovement>,
  ): Promise<Movement | undefined> {
    console.log("\n========== НАЧАЛО ОБНОВЛЕНИЯ ПЕРЕМЕЩЕНИЯ ==========");
    console.log("Movement ID:", id);
    console.log("Update data:", data);

    return await db.transaction(async (tx) => {
      const currentMovement = await tx.query.movement.findFirst({
        where: eq(movement.id, id),
        with: {
          toWarehouse: true,
          fromWarehouse: true,
          transaction: true,
          sourceTransaction: true,
        },
      });

      if (!currentMovement) {
        console.log("❌ Перемещение не найдено");
        return undefined;
      }

      console.log("✓ Текущее перемещение найдено:", {
        id: currentMovement.id,
        type: currentMovement.movementType,
        productType: currentMovement.productType,
        date: currentMovement.movementDate,
        fromWarehouse: currentMovement.fromWarehouse?.name,
        toWarehouse: currentMovement.toWarehouse?.name,
      });

      if (data.productType !== currentMovement.productType) {
        throw new Error("You can`t change productType for active movement");
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
      const needsRecalculation = hasQuantityChanged || hasCostChanged;

      console.log("Сравнение значений:", {
        oldQuantityKg,
        newQuantityKg,
        hasQuantityChanged,
        oldTotalCost,
        newTotalCost,
        hasCostChanged,
        needsRecalculation,
      });

      // Обновляем склад назначения, если изменились показатели
      if (
        needsRecalculation &&
        currentMovement.transactionId &&
        currentMovement.toWarehouseId &&
        currentMovement.toWarehouse
      ) {
        console.log("\n--- ШАГ 1: Обновление склада назначения ---");
        console.log("Склад:", currentMovement.toWarehouse.name);
        console.log("Transaction ID:", currentMovement.transactionId);

        await WarehouseTransactionService.updateTransactionAndRecalculateWarehouse(
          tx,
          currentMovement.transactionId,
          currentMovement.toWarehouseId,
          oldQuantityKg,
          oldTotalCost,
          newQuantityKg,
          newTotalCost,
          currentMovement.productType,
          data.updatedById,
          data.movementDate,
        );

        console.log("✓ Склад назначения обновлен");
      }

      // Обновляем склад-источник для внутренних перемещений
      if (
        needsRecalculation &&
        currentMovement.movementType === MOVEMENT_TYPE.INTERNAL &&
        currentMovement.sourceTransactionId &&
        currentMovement.fromWarehouseId &&
        currentMovement.fromWarehouse
      ) {
        console.log(
          "\n--- ШАГ 2: Обновление склада-источника (внутреннее перемещение) ---",
        );
        console.log("Склад:", currentMovement.fromWarehouse.name);
        console.log(
          "Source Transaction ID:",
          currentMovement.sourceTransactionId,
        );

        await WarehouseTransactionService.updateTransactionAndRecalculateWarehouse(
          tx,
          currentMovement.sourceTransactionId,
          currentMovement.fromWarehouseId,
          oldQuantityKg,
          0, // При расходе totalCost = 0
          newQuantityKg,
          0, // При расходе totalCost = 0
          currentMovement.productType,
          data.updatedById,
          data.movementDate,
        );

        console.log("✓ Склад-источник обновлен");
      }

      // Временное отключение комплексного пересчета - race condition problem
      // КОМПЛЕКСНЫЙ ПЕРЕСЧЕТ: пересчитываем все затронутые склады и связанные транзакции
      // if (needsRecalculation) {
      //   console.log('\n--- ШАГ 3: КОМПЛЕКСНЫЙ ПЕРЕСЧЕТ всех затронутых складов ---');

      //   const affectedWarehouses = WarehouseRecalculationService.getAffectedWarehouses(
      //     currentMovement,
      //     currentMovement.movementDate
      //   );

      //   console.log('Затронутые склады:', affectedWarehouses.map(w => ({
      //     warehouseId: w.warehouseId,
      //     afterDate: w.afterDate,
      //     productType: w.productType,
      //   })));

      //   await WarehouseRecalculationService.recalculateAllAffectedTransactions(
      //     tx,
      //     affectedWarehouses,
      //     data.updatedById
      //   );

      //   console.log('✓ Комплексный пересчет завершен');
      // } else {
      //   console.log('\n⚠ Пересчет не требуется (значения не изменились)');
      // }

      // Обновляем перемещение
      console.log("\n--- ШАГ 4: Обновление записи перемещения в БД ---");
      const [updated] = await tx
        .update(movement)
        .set({
          ...data,
          updatedAt: sql`NOW()`,
          updatedById: data.updatedById,
        })
        .where(eq(movement.id, id))
        .returning();

      console.log("✓ Перемещение обновлено в БД");
      console.log("========== ОБНОВЛЕНИЕ ПЕРЕМЕЩЕНИЯ ЗАВЕРШЕНО ==========\n");

      return updated;
    });
  }

  async deleteMovement(id: string, userId?: string): Promise<boolean> {
    console.log("\n========== НАЧАЛО УДАЛЕНИЯ ПЕРЕМЕЩЕНИЯ ==========");
    console.log("Movement ID:", id);

    await db.transaction(async (tx) => {
      const currentMovement = await tx.query.movement.findFirst({
        where: eq(movement.id, id),
        with: {
          toWarehouse: true,
          fromWarehouse: true,
          transaction: true,
          sourceTransaction: true,
        },
      });

      if (!currentMovement) {
        console.log("❌ Перемещение не найдено");
        return;
      }

      console.log("✓ Перемещение найдено:", {
        id: currentMovement.id,
        type: currentMovement.movementType,
        productType: currentMovement.productType,
        date: currentMovement.movementDate,
        fromWarehouse: currentMovement.fromWarehouse?.name,
        toWarehouse: currentMovement.toWarehouse?.name,
      });

      const quantityKg = parseFloat(currentMovement.quantityKg);
      const totalCost = parseFloat(currentMovement.totalCost || "0");

      console.log("Параметры для отката:", { quantityKg, totalCost });

      // Откатываем изменения на складе назначения
      if (
        currentMovement.transactionId &&
        currentMovement.toWarehouseId &&
        currentMovement.toWarehouse
      ) {
        console.log("\n--- ШАГ 1: Откат изменений на складе назначения ---");
        console.log("Склад:", currentMovement.toWarehouse.name);
        console.log("Transaction ID:", currentMovement.transactionId);

        await WarehouseTransactionService.deleteTransactionAndRevertWarehouse(
          tx,
          currentMovement.transactionId,
          currentMovement.toWarehouseId,
          quantityKg,
          totalCost,
          currentMovement.productType,
          userId,
        );

        console.log("✓ Откат на складе назначения выполнен");
      }

      // Откатываем изменения на складе-источнике для внутренних перемещений
      if (
        currentMovement.movementType === MOVEMENT_TYPE.INTERNAL &&
        currentMovement.sourceTransactionId &&
        currentMovement.fromWarehouseId &&
        currentMovement.fromWarehouse
      ) {
        console.log("\n--- ШАГ 2: Откат изменений на складе-источнике ---");
        console.log("Склад:", currentMovement.fromWarehouse.name);
        console.log(
          "Source Transaction ID:",
          currentMovement.sourceTransactionId,
        );

        await WarehouseTransactionService.deleteTransactionAndRevertWarehouse(
          tx,
          currentMovement.sourceTransactionId,
          currentMovement.fromWarehouseId,
          quantityKg,
          0,
          currentMovement.productType,
          userId,
        );

        console.log("✓ Откат на складе-источнике выполнен");
      }

      // КОМПЛЕКСНЫЙ ПЕРЕСЧЕТ: пересчитываем все затронутые склады и связанные транзакции
      // console.log('\n--- ШАГ 3: КОМПЛЕКСНЫЙ ПЕРЕСЧЕТ после удаления ---');

      // const affectedWarehouses = WarehouseRecalculationService.getAffectedWarehouses(
      //   currentMovement,
      //   currentMovement.movementDate
      // );

      // console.log('Затронутые склады:', affectedWarehouses.map(w => ({
      //   warehouseId: w.warehouseId,
      //   afterDate: w.afterDate,
      //   productType: w.productType,
      // })));

      // await WarehouseRecalculationService.recalculateAllAffectedTransactions(
      //   tx,
      //   affectedWarehouses,
      //   undefined
      // );

      // console.log('✓ Комплексный пересчет завершен');

      console.log("\n--- ШАГ 4: Удаление записи перемещения из БД ---");
      // Soft delete
      await tx
        .update(movement)
        .set({
          deletedAt: sql`NOW()`,
          deletedById: userId,
        })
        .where(eq(movement.id, id));
      console.log("✓ Запись перемещения удалена");
      console.log("========== УДАЛЕНИЕ ПЕРЕМЕЩЕНИЯ ЗАВЕРШЕНО ==========\n");
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
        await tx
          .update(warehouseTransactions)
          .set({
            deletedAt: null,
            deletedById: null,
          })
          .where(eq(warehouseTransactions.id, oldData.transactionId));
      }

      if (oldData.sourceTransactionId) {
        await tx
          .update(warehouseTransactions)
          .set({
            deletedAt: null,
            deletedById: null,
          })
          .where(eq(warehouseTransactions.id, oldData.sourceTransactionId));
      }

      // Recalculate warehouse balances
      // This is complex and should use the same logic as createMovement
      // For simplicity, we'll just restore the transactions
      // The warehouse balances will be recalculated on next transaction
    });

    return true;
  }
}
