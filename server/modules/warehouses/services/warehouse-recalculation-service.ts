
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
    console.log('  [WarehouseRecalculationService] recalculateAllAffectedTransactions');
    console.log('    Количество затронутых складов:', affectedWarehouses.length);
    
    // Обрабатываем каждый затронутый склад
    for (let i = 0; i < affectedWarehouses.length; i++) {
      const { warehouseId, afterDate, productType } = affectedWarehouses[i];
      console.log(`\n    === Пересчет склада ${i + 1} из ${affectedWarehouses.length} ===`);
      console.log('    Warehouse ID:', warehouseId);
      console.log('    After Date:', afterDate);
      console.log('    Product Type:', productType);
      
      await this.recalculateWarehouseChain(
        tx,
        warehouseId,
        afterDate,
        productType,
        updatedById
      );
      
      console.log(`    ✓ Склад ${i + 1} пересчитан`);
    }
    
    console.log('\n  ✓ Все затронутые склады пересчитаны');
  }

  /**
   * Пересчитывает всю цепочку транзакций для конкретного склада
   * 
   * Алгоритм:
   * 1. Получаем начальное состояние склада ДО указанной даты
   * 2. Получаем все транзакции начиная с этой даты (включая её) в хронологическом порядке
   * 3. Последовательно пересчитываем каждую транзакцию
   * 4. Для каждой транзакции обновляем связанные сделки
   */
  private static async recalculateWarehouseChain(
    tx: any,
    warehouseId: string,
    fromDate: string,
    productType: string,
    updatedById?: string
  ) {
    console.log('      [recalculateWarehouseChain] Начало пересчета цепочки');
    const isPvkj = productType === PRODUCT_TYPE.PVKJ;

    // Получаем состояние склада ДО fromDate (не включая саму дату)
    const initialState = await this.getWarehouseStateBeforeDate(
      tx,
      warehouseId,
      fromDate,
      productType
    );

    console.log('      Начальное состояние ДО', fromDate, ':', initialState);

    // Получаем все транзакции начиная с fromDate (включительно), отсортированные по времени
    const transactions = await tx.query.warehouseTransactions.findMany({
      where: and(
        eq(warehouseTransactions.warehouseId, warehouseId),
        eq(warehouseTransactions.productType, productType),
        sql`${warehouseTransactions.createdAt} >= ${fromDate}`
      ),
      orderBy: (warehouseTransactions, { asc }) => [asc(warehouseTransactions.createdAt)],
      with: {
        warehouse: true,
      }
    });

    console.log('      Найдено транзакций для пересчета (включая измененную):', transactions.length);

    let currentBalance = initialState.balance;
    let currentAverageCost = initialState.averageCost;

    // Последовательно пересчитываем каждую транзакцию
    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      console.log(`\n      --- Транзакция ${i + 1}/${transactions.length} ---`);
      console.log('      ID:', transaction.id);
      console.log('      Type:', transaction.transactionType);
      console.log('      Source:', transaction.sourceType, transaction.sourceId);
      console.log('      Date:', transaction.createdAt);
      
      const quantity = Math.abs(parseFloat(transaction.quantity));
      const isReceipt = transaction.transactionType === TRANSACTION_TYPE.RECEIPT || 
                       transaction.transactionType === TRANSACTION_TYPE.TRANSFER_IN;
      
      console.log('      Quantity:', quantity, isReceipt ? '(приход)' : '(расход)');
      console.log('      До пересчета:', {
        balance: currentBalance,
        averageCost: currentAverageCost,
      });
      
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
        
        console.log('      Incoming cost:', incomingCost);
        
        const totalCurrentCost = currentBalance * currentAverageCost;
        newAverageCost = newBalance > 0 
          ? (totalCurrentCost + incomingCost) / newBalance 
          : 0;
      } else {
        // Расход - себестоимость не меняется
        newBalance = Math.max(0, currentBalance - quantity);
        newAverageCost = currentAverageCost;
      }

      console.log('      После пересчета:', {
        balance: newBalance,
        averageCost: newAverageCost,
      });

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

      console.log('      ✓ Транзакция обновлена в БД');

      // Обновляем связанную сделку, если это продажа
      if (transaction.transactionType === TRANSACTION_TYPE.SALE) {
        console.log('      → Обновление связанной сделки (продажа)');
        await this.updateRelatedDeal(
          tx,
          transaction.sourceType,
          transaction.sourceId,
          newAverageCost, // Используем новую себестоимость после пересчета
          updatedById
        );
      }

      // Если это перемещение, обновляем связанное перемещение
      if (transaction.sourceType === SOURCE_TYPE.MOVEMENT) {
        console.log('      → Распространение пересчета на связанное перемещение');
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
    console.log('\n      Финальное состояние склада:', {
      balance: currentBalance,
      averageCost: currentAverageCost,
    });
    
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

    console.log('      ✓ Склад обновлен с финальными значениями');
  }

  /**
   * Получает состояние склада ДО определенной даты (не включая саму дату)
   */
  private static async getWarehouseStateBeforeDate(
    tx: any,
    warehouseId: string,
    beforeDate: string,
    productType: string
  ): Promise<{ balance: number; averageCost: number }> {
    const isPvkj = productType === PRODUCT_TYPE.PVKJ;

    // Получаем последнюю транзакцию СТРОГО ДО указанной даты (не включая саму дату)
    const lastTransaction = await tx.query.warehouseTransactions.findFirst({
      where: and(
        eq(warehouseTransactions.warehouseId, warehouseId),
        eq(warehouseTransactions.productType, productType),
        sql`${warehouseTransactions.createdAt} < ${beforeDate}`
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
    console.log('        [updateRelatedDeal]', sourceType, sourceId);
    console.log('        New average cost:', newAverageCost);
    
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

        console.log('        ОПТ сделка до обновления:', {
          purchasePrice: deal.purchasePrice,
          purchaseAmount: deal.purchaseAmount,
          profit: deal.profit,
        });

        console.log('        ОПТ сделка после обновления:', {
          purchasePrice: newAverageCost.toFixed(4),
          purchaseAmount: purchaseAmount.toFixed(2),
          profit: profit.toFixed(2),
        });

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

        console.log('        ✓ ОПТ сделка обновлена');
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

        console.log('        Заправка до обновления:', {
          purchasePrice: refuel.purchasePrice,
          purchaseAmount: refuel.purchaseAmount,
          profit: refuel.profit,
        });

        console.log('        Заправка после обновления:', {
          purchasePrice: newAverageCost.toFixed(4),
          purchaseAmount: purchaseAmount.toFixed(2),
          profit: profit.toFixed(2),
        });

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

        console.log('        ✓ Заправка обновлена');
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
    console.log('        [propagateMovementRecalculation]');
    console.log('        Movement ID:', movementId);
    console.log('        New source average cost:', newSourceAverageCost);
    
    const movementRecord = await tx.query.movement.findFirst({
      where: eq(movement.id, movementId),
      with: {
        toWarehouse: true,
        fromWarehouse: true,
      }
    });

    if (!movementRecord) {
      console.log('        ⚠ Перемещение не найдено');
      return;
    }

    console.log('        Перемещение найдено:', {
      type: movementRecord.movementType,
      from: movementRecord.fromWarehouse?.name,
      to: movementRecord.toWarehouse?.name,
    });

    // Для внутренних перемещений пересчитываем склад-получатель
    if (movementRecord.toWarehouseId && movementRecord.fromWarehouseId) {
      console.log('        → Внутреннее перемещение, пересчитываем склад-получатель');
      
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
        console.log('        Транзакция прихода найдена:', destinationTransaction.id);
        console.log('        ⚠ Склад-получатель будет пересчитан автоматически в основном цикле');
        // НЕ вызываем рекурсивный пересчет здесь, так как склад-получатель
        // уже включен в список affectedWarehouses и будет пересчитан в основном цикле
      } else {
        console.log('        ⚠ Транзакция прихода на склад-получатель не найдена');
      }
    } else {
      console.log('        ⚠ Не внутреннее перемещение, пропускаем');
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
