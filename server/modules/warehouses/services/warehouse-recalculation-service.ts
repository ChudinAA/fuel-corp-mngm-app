
import { eq, and, gt, sql, or } from "drizzle-orm";
import { warehouses, warehouseTransactions, opt, aircraftRefueling, movement } from "@shared/schema";
import { PRODUCT_TYPE, TRANSACTION_TYPE, SOURCE_TYPE } from "@shared/constants";

/**
 * Сервис для комплексного пересчета транзакций и сделок после изменения перемещений
 * 
 * Основные задачи:
 * 1. Пересчет всех транзакций склада после определенной даты с учетом изменения себестоимости
 * 2. Каскадное обновление связанных сделок (ОПТ и Заправки)
 * 3. Обработка внутренних перемещений, затрагивающих несколько складов
 */
export class WarehouseRecalculationService {
  /**
   * Полный пересчет всех транзакций и сделок после изменения перемещения
   * 
   * @param tx - Database transaction
   * @param affectedWarehouses - Массив затронутых складов с датами и типами продуктов
   * @param updatedById - ID пользователя, вносящего изменения
   */
  static async recalculateAllAffectedTransactions(
    tx: any,
    affectedWarehouses: Array<{
      warehouseId: string;
      afterDate: string;
      productType: string;
    }>,
    updatedById?: string
  ) {
    // Обрабатываем каждый затронутый склад
    for (const { warehouseId, afterDate, productType } of affectedWarehouses) {
      await this.recalculateWarehouseChain(
        tx,
        warehouseId,
        afterDate,
        productType,
        updatedById
      );
    }
  }

  /**
   * Пересчитывает всю цепочку транзакций для конкретного склада
   * 
   * Алгоритм:
   * 1. Получаем начальное состояние склада на момент afterDate
   * 2. Получаем все транзакции после этой даты в хронологическом порядке
   * 3. Последовательно пересчитываем каждую транзакцию
   * 4. Для каждой транзакции обновляем связанные сделки
   */
  private static async recalculateWarehouseChain(
    tx: any,
    warehouseId: string,
    afterDate: string,
    productType: string,
    updatedById?: string
  ) {
    const isPvkj = productType === PRODUCT_TYPE.PVKJ;

    // Получаем текущее состояние склада до afterDate
    const initialState = await this.getWarehouseStateAtDate(
      tx,
      warehouseId,
      afterDate,
      productType
    );

    // Получаем все транзакции после указанной даты, отсортированные по времени
    const transactions = await tx.query.warehouseTransactions.findMany({
      where: and(
        eq(warehouseTransactions.warehouseId, warehouseId),
        eq(warehouseTransactions.productType, productType),
        gt(warehouseTransactions.createdAt, afterDate)
      ),
      orderBy: (warehouseTransactions, { asc }) => [asc(warehouseTransactions.createdAt)],
      with: {
        warehouse: true,
      }
    });

    let currentBalance = initialState.balance;
    let currentAverageCost = initialState.averageCost;

    // Последовательно пересчитываем каждую транзакцию
    for (const transaction of transactions) {
      const quantity = Math.abs(parseFloat(transaction.quantity));
      const isReceipt = transaction.transactionType === TRANSACTION_TYPE.RECEIPT || 
                       transaction.transactionType === TRANSACTION_TYPE.TRANSFER_IN;
      
      let newBalance: number;
      let newAverageCost: number;

      if (isReceipt) {
        // Приход - пересчитываем среднюю себестоимость
        newBalance = currentBalance + quantity;
        
        // Получаем стоимость поступления
        const incomingCost = await this.getTransactionIncomingCost(
          tx,
          transaction.sourceType,
          transaction.sourceId,
          quantity
        );
        
        const totalCurrentCost = currentBalance * currentAverageCost;
        newAverageCost = newBalance > 0 
          ? (totalCurrentCost + incomingCost) / newBalance 
          : 0;
      } else {
        // Расход - себестоимость не меняется
        newBalance = Math.max(0, currentBalance - quantity);
        newAverageCost = currentAverageCost;
      }

      // Обновляем транзакцию
      await tx.update(warehouseTransactions)
        .set({
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          averageCostBefore: currentAverageCost.toFixed(4),
          averageCostAfter: newAverageCost.toFixed(4),
          updatedAt: sql`NOW()`,
          updatedById,
        })
        .where(eq(warehouseTransactions.id, transaction.id));

      // Обновляем связанную сделку, если это продажа
      if (transaction.transactionType === TRANSACTION_TYPE.SALE) {
        await this.updateRelatedDeal(
          tx,
          transaction.sourceType,
          transaction.sourceId,
          currentAverageCost,
          updatedById
        );
      }

      // Если это перемещение, обновляем связанное перемещение
      if (transaction.sourceType === SOURCE_TYPE.MOVEMENT) {
        await this.propagateMovementRecalculation(
          tx,
          transaction.sourceId,
          newAverageCost,
          updatedById
        );
      }

      // Обновляем текущее состояние для следующей итерации
      currentBalance = newBalance;
      currentAverageCost = newAverageCost;
    }

    // Обновляем финальное состояние склада
    const updateData: any = {
      updatedAt: sql`NOW()`,
      updatedById,
    };

    if (isPvkj) {
      updateData.pvkjBalance = currentBalance.toFixed(2);
      updateData.pvkjAverageCost = currentAverageCost.toFixed(4);
    } else {
      updateData.currentBalance = currentBalance.toFixed(2);
      updateData.averageCost = currentAverageCost.toFixed(4);
    }

    await tx.update(warehouses)
      .set(updateData)
      .where(eq(warehouses.id, warehouseId));
  }

  /**
   * Получает состояние склада на определенную дату
   */
  private static async getWarehouseStateAtDate(
    tx: any,
    warehouseId: string,
    beforeDate: string,
    productType: string
  ): Promise<{ balance: number; averageCost: number }> {
    const isPvkj = productType === PRODUCT_TYPE.PVKJ;

    // Получаем последнюю транзакцию до указанной даты
    const lastTransaction = await tx.query.warehouseTransactions.findFirst({
      where: and(
        eq(warehouseTransactions.warehouseId, warehouseId),
        eq(warehouseTransactions.productType, productType),
        sql`${warehouseTransactions.createdAt} <= ${beforeDate}`
      ),
      orderBy: (warehouseTransactions, { desc }) => [desc(warehouseTransactions.createdAt)],
    });

    if (lastTransaction) {
      return {
        balance: parseFloat(lastTransaction.balanceAfter || "0"),
        averageCost: parseFloat(lastTransaction.averageCostAfter || "0"),
      };
    }

    // Если нет транзакций до этой даты, возвращаем нулевые значения
    return { balance: 0, averageCost: 0 };
  }

  /**
   * Получает стоимость поступления для транзакции
   */
  private static async getTransactionIncomingCost(
    tx: any,
    sourceType: string,
    sourceId: string,
    quantity: number
  ): Promise<number> {
    if (sourceType === SOURCE_TYPE.MOVEMENT) {
      const movementRecord = await tx.query.movement.findFirst({
        where: eq(movement.id, sourceId),
      });
      
      if (movementRecord) {
        return parseFloat(movementRecord.totalCost || "0");
      }
    }

    // Для других типов (продажи) стоимость не применяется к приходу
    return 0;
  }

  /**
   * Обновляет связанную сделку (ОПТ или Заправка) с новой себестоимостью
   */
  private static async updateRelatedDeal(
    tx: any,
    sourceType: string,
    sourceId: string,
    newAverageCost: number,
    updatedById?: string
  ) {
    if (sourceType === SOURCE_TYPE.OPT) {
      const deal = await tx.query.opt.findFirst({
        where: eq(opt.id, sourceId),
      });

      if (deal) {
        const quantityKg = parseFloat(deal.quantityKg);
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
            updatedById,
          })
          .where(eq(opt.id, sourceId));
      }
    } else if (sourceType === SOURCE_TYPE.REFUELING) {
      const refuel = await tx.query.aircraftRefueling.findFirst({
        where: eq(aircraftRefueling.id, sourceId),
      });

      if (refuel && refuel.productType !== PRODUCT_TYPE.SERVICE) {
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
            updatedById,
          })
          .where(eq(aircraftRefueling.id, sourceId));
      }
    }
  }

  /**
   * Распространяет пересчет на склады, затронутые перемещением
   * 
   * При внутреннем перемещении может быть затронут склад-получатель,
   * если изменилась себестоимость склада-отправителя
   */
  private static async propagateMovementRecalculation(
    tx: any,
    movementId: string,
    newSourceAverageCost: number,
    updatedById?: string
  ) {
    const movementRecord = await tx.query.movement.findFirst({
      where: eq(movement.id, movementId),
      with: {
        toWarehouse: true,
        fromWarehouse: true,
      }
    });

    if (!movementRecord) return;

    // Для внутренних перемещений пересчитываем склад-получатель
    if (movementRecord.toWarehouseId && movementRecord.fromWarehouseId) {
      // Получаем транзакцию прихода на склад-получатель
      const destinationTransaction = await tx.query.warehouseTransactions.findFirst({
        where: and(
          eq(warehouseTransactions.sourceType, SOURCE_TYPE.MOVEMENT),
          eq(warehouseTransactions.sourceId, movementId),
          eq(warehouseTransactions.warehouseId, movementRecord.toWarehouseId),
          or(
            eq(warehouseTransactions.transactionType, TRANSACTION_TYPE.RECEIPT),
            eq(warehouseTransactions.transactionType, TRANSACTION_TYPE.TRANSFER_IN)
          )
        )
      });

      if (destinationTransaction) {
        // Пересчитываем склад-получатель, так как себестоимость источника изменилась
        await this.recalculateWarehouseChain(
          tx,
          movementRecord.toWarehouseId,
          destinationTransaction.createdAt,
          movementRecord.productType,
          updatedById
        );
      }
    }
  }

  /**
   * Создает список затронутых складов для пересчета
   * 
   * @param movementRecord - Запись перемещения
   * @param movementDate - Дата перемещения
   * @returns Массив объектов с информацией о затронутых складах
   */
  static getAffectedWarehouses(
    movementRecord: any,
    movementDate: string
  ): Array<{ warehouseId: string; afterDate: string; productType: string }> {
    const affected: Array<{ warehouseId: string; afterDate: string; productType: string }> = [];

    // Склад-получатель всегда затронут
    if (movementRecord.toWarehouseId) {
      affected.push({
        warehouseId: movementRecord.toWarehouseId,
        afterDate: movementDate,
        productType: movementRecord.productType,
      });
    }

    // Склад-отправитель затронут при внутреннем перемещении
    if (movementRecord.fromWarehouseId) {
      affected.push({
        warehouseId: movementRecord.fromWarehouseId,
        afterDate: movementDate,
        productType: movementRecord.productType,
      });
    }

    return affected;
  }
}
