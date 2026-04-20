import { eq, desc, sql, isNull, and } from "drizzle-orm";
import { db } from "server/db";
import {
  exchange,
  movement,
  suppliers,
  type Exchange,
  type InsertExchange,
} from "@shared/schema";
import { IExchangeStorage } from "./types";
import {
  MOVEMENT_TYPE,
  TRANSACTION_TYPE,
  SOURCE_TYPE,
} from "@shared/constants";
import { WarehouseTransactionService } from "../../warehouses/services/warehouse-transaction-service";

export class ExchangeStorage implements IExchangeStorage {
  async getExchange(id: string): Promise<Exchange | undefined> {
    return db.query.exchange.findFirst({
      where: and(eq(exchange.id, id), isNull(exchange.deletedAt)),
    });
  }

  async getExchangeDeals(
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{ data: Exchange[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const data = await db
      .select()
      .from(exchange)
      .where(isNull(exchange.deletedAt))
      .orderBy(desc(exchange.dealDate))
      .limit(pageSize)
      .offset(offset);
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(exchange)
      .where(isNull(exchange.deletedAt));
    return { data, total: Number(countResult?.count || 0) };
  }

  async createExchange(data: InsertExchange): Promise<Exchange> {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(exchange).values(data).returning();

      // Если выбран покупатель-склад и подтверждено получение → создаём Перемещение
      if (created.buyerSupplierId && created.isReceivedAtWarehouse) {
        const supplier = await tx.query.suppliers.findFirst({
          where: eq(suppliers.id, created.buyerSupplierId),
        });

        if (supplier?.warehouseId) {
          const quantityKg = parseFloat(created.quantityKg || "0");
          const totalAmount = parseFloat(created.totalAmount || "0");

          // Создаём запись Перемещения
          const [createdMovement] = await tx
            .insert(movement)
            .values({
              movementDate: created.dealDate,
              movementType: MOVEMENT_TYPE.SUPPLY,
              productType: created.productType,
              supplierId: null,
              toWarehouseId: supplier.warehouseId,
              quantityKg: created.quantityKg,
              totalCost: created.totalAmount,
              purchasePrice: created.pricePerKg,
              isDraft: false,
              fromExchange: true,
              exchangeId: created.id,
              notes: created.notes || null,
              createdById: data.createdById || null,
            })
            .returning();

          // Создаём транзакцию пополнения склада
          const { transaction: warehouseTx } =
            await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
              tx,
              supplier.warehouseId,
              TRANSACTION_TYPE.RECEIPT,
              created.productType,
              SOURCE_TYPE.MOVEMENT,
              createdMovement.id,
              quantityKg,
              totalAmount,
              data.createdById || undefined,
              created.dealDate,
            );

          // Обновляем движение с transactionId
          await tx
            .update(movement)
            .set({ transactionId: warehouseTx.id })
            .where(eq(movement.id, createdMovement.id));

          // Сохраняем ссылку на перемещение в сделке биржи
          const [updated] = await tx
            .update(exchange)
            .set({ movementId: createdMovement.id })
            .where(eq(exchange.id, created.id))
            .returning();

          return updated;
        }
      }

      return created;
    });
  }

  async updateExchange(
    id: string,
    data: Partial<InsertExchange>,
  ): Promise<Exchange | undefined> {
    return await db.transaction(async (tx) => {
      const currentExchange = await tx.query.exchange.findFirst({
        where: and(eq(exchange.id, id), isNull(exchange.deletedAt)),
      });

      if (!currentExchange) return undefined;

      const wasReceived = currentExchange.isReceivedAtWarehouse;
      const isNowReceived = data.isReceivedAtWarehouse ?? wasReceived;
      const hasBuyer =
        data.buyerSupplierId !== undefined
          ? data.buyerSupplierId
          : currentExchange.buyerSupplierId;

      // Флаг: только что подтвердили получение (было false, стало true)
      const transitioningToReceived = !wasReceived && isNowReceived;
      // Флаг: отозвали подтверждение (было true, стало false)
      const transitioningFromReceived = wasReceived && !isNowReceived;

      const [updated] = await tx
        .update(exchange)
        .set({
          ...data,
          updatedAt: sql`NOW()`,
        })
        .where(eq(exchange.id, id))
        .returning();

      // Если убрали подтверждение → удаляем перемещение
      if (transitioningFromReceived && currentExchange.movementId) {
        const existingMovement = await tx.query.movement.findFirst({
          where: eq(movement.id, currentExchange.movementId),
        });
        if (existingMovement && !existingMovement.deletedAt) {
          // Откатываем транзакцию склада
          if (existingMovement.transactionId) {
            await WarehouseTransactionService.deleteTransactionAndRevertWarehouse(
              tx,
              existingMovement.transactionId,
              data.updatedById || undefined,
            );
          }
          // Мягкое удаление перемещения
          await tx
            .update(movement)
            .set({
              deletedAt: sql`NOW()`,
              deletedById: data.updatedById || null,
            })
            .where(eq(movement.id, currentExchange.movementId));
        }
        await tx
          .update(exchange)
          .set({ movementId: null })
          .where(eq(exchange.id, id));
        return {
          ...updated,
          movementId: null,
        };
      }

      // Если только что подтвердили получение → создаём перемещение
      if (transitioningToReceived && hasBuyer) {
        const supplier = await tx.query.suppliers.findFirst({
          where: eq(suppliers.id, hasBuyer),
        });
        if (supplier?.warehouseId) {
          const quantityKg = parseFloat(
            (data.quantityKg ?? currentExchange.quantityKg ?? "0").toString(),
          );
          const totalAmount = parseFloat(
            (data.totalAmount ?? currentExchange.totalAmount ?? "0").toString(),
          );
          const productType =
            data.productType ?? currentExchange.productType;
          const dealDate = data.dealDate ?? currentExchange.dealDate;
          const pricePerKg =
            data.pricePerKg ?? currentExchange.pricePerKg ?? "0";

          const [createdMovement] = await tx
            .insert(movement)
            .values({
              movementDate: dealDate,
              movementType: MOVEMENT_TYPE.SUPPLY,
              productType,
              supplierId: null,
              toWarehouseId: supplier.warehouseId,
              quantityKg: quantityKg.toString(),
              totalCost: totalAmount.toString(),
              purchasePrice: pricePerKg.toString(),
              isDraft: false,
              fromExchange: true,
              exchangeId: id,
              notes: data.notes ?? currentExchange.notes ?? null,
              createdById: data.updatedById || null,
            })
            .returning();

          const { transaction: warehouseTx } =
            await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
              tx,
              supplier.warehouseId,
              TRANSACTION_TYPE.RECEIPT,
              productType,
              SOURCE_TYPE.MOVEMENT,
              createdMovement.id,
              quantityKg,
              totalAmount,
              data.updatedById || undefined,
              dealDate,
            );

          await tx
            .update(movement)
            .set({ transactionId: warehouseTx.id })
            .where(eq(movement.id, createdMovement.id));

          await tx
            .update(exchange)
            .set({ movementId: createdMovement.id })
            .where(eq(exchange.id, id));

          return {
            ...updated,
            movementId: createdMovement.id,
          };
        }
      }

      // Если уже есть перемещение и изменились объём/сумма → пересчитываем
      if (
        wasReceived &&
        isNowReceived &&
        currentExchange.movementId &&
        !transitioningToReceived
      ) {
        const existingMovement = await tx.query.movement.findFirst({
          where: and(
            eq(movement.id, currentExchange.movementId),
            isNull(movement.deletedAt),
          ),
        });

        if (existingMovement) {
          const oldQuantityKg = parseFloat(existingMovement.quantityKg || "0");
          const oldTotalCost = parseFloat(existingMovement.totalCost || "0");
          const newQuantityKg = data.quantityKg
            ? parseFloat(data.quantityKg.toString())
            : oldQuantityKg;
          const newTotalAmount =
            data.quantityKg && data.pricePerKg
              ? parseFloat(data.quantityKg.toString()) *
                parseFloat(data.pricePerKg.toString())
              : data.totalAmount
                ? parseFloat(data.totalAmount.toString())
                : oldTotalCost;

          const hasQuantityChanged = oldQuantityKg !== newQuantityKg;
          const hasCostChanged = oldTotalCost !== newTotalAmount;

          if (hasQuantityChanged || hasCostChanged) {
            if (existingMovement.transactionId && existingMovement.toWarehouseId) {
              await WarehouseTransactionService.updateTransactionAndRecalculateWarehouse(
                tx,
                existingMovement.transactionId,
                existingMovement.toWarehouseId,
                oldQuantityKg,
                oldTotalCost,
                newQuantityKg,
                newTotalAmount,
                existingMovement.productType,
                data.updatedById || undefined,
                data.dealDate || undefined,
              );
            }
          }

          // Синхронизируем поля перемещения с биржей
          await tx
            .update(movement)
            .set({
              quantityKg: newQuantityKg.toString(),
              totalCost: newTotalAmount.toString(),
              purchasePrice: (
                data.pricePerKg ?? currentExchange.pricePerKg ?? "0"
              ).toString(),
              productType:
                data.productType ?? existingMovement.productType,
              movementDate:
                data.dealDate ?? existingMovement.movementDate,
              notes:
                data.notes !== undefined
                  ? data.notes
                  : existingMovement.notes,
              updatedAt: sql`NOW()`,
              updatedById: data.updatedById || null,
            })
            .where(eq(movement.id, currentExchange.movementId));
        }
      }

      return updated;
    });
  }

  async deleteExchange(id: string, userId?: string): Promise<boolean> {
    await db.transaction(async (tx) => {
      const currentExchange = await tx.query.exchange.findFirst({
        where: and(eq(exchange.id, id), isNull(exchange.deletedAt)),
      });

      // Если есть связанное перемещение — удаляем его вместе
      if (currentExchange?.movementId) {
        const existingMovement = await tx.query.movement.findFirst({
          where: and(
            eq(movement.id, currentExchange.movementId),
            isNull(movement.deletedAt),
          ),
        });
        if (existingMovement) {
          if (existingMovement.transactionId) {
            await WarehouseTransactionService.deleteTransactionAndRevertWarehouse(
              tx,
              existingMovement.transactionId,
              userId,
            );
          }
          await tx
            .update(movement)
            .set({
              deletedAt: sql`NOW()`,
              deletedById: userId || null,
            })
            .where(eq(movement.id, currentExchange.movementId));
        }
      }

      await tx
        .update(exchange)
        .set({
          deletedAt: sql`NOW()`,
          deletedById: userId,
        })
        .where(eq(exchange.id, id));
    });
    return true;
  }

  async restoreExchange(id: string, userId?: string): Promise<boolean> {
    await db
      .update(exchange)
      .set({
        deletedAt: null,
        deletedById: null,
      })
      .where(eq(exchange.id, id));
    return true;
  }
}
