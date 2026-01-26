import { eq, and, gte, gt, sql, or, isNull, desc, asc, ne } from "drizzle-orm";
import { warehouses, warehouseTransactions, opt, aircraftRefueling, movement } from "@shared/schema";
import { PRODUCT_TYPE, TRANSACTION_TYPE, SOURCE_TYPE } from "@shared/constants";
import { parse } from "path";

export class WarehouseRecalculationService {
  static async recalculateAllAffectedTransactions(
    tx: any,
    affectedWarehouses: Array<{
      warehouseId: string;
      afterDate: string;
      productType: string;
      excludeTransactionId?: string;
    }>,
    updatedById?: string,
    visitedWarehouses?: Set<string>
  ) {
    console.log('  [WarehouseRecalculationService] recalculateAllAffectedTransactions');
    console.log('    Количество затронутых складов:', affectedWarehouses.length);
    
    const visited = visitedWarehouses || new Set<string>();
    
    for (let i = 0; i < affectedWarehouses.length; i++) {
      const { warehouseId, afterDate, productType, excludeTransactionId } = affectedWarehouses[i];
      const key = `${warehouseId}:${productType}`;
      
      if (visited.has(key)) {
        console.log(`    Склад ${warehouseId} (${productType}) уже обработан, пропускаем`);
        continue;
      }
      
      visited.add(key);
      
      console.log(`\n    === Пересчет склада ${i + 1} из ${affectedWarehouses.length} ===`);
      console.log('    Warehouse ID:', warehouseId);
      console.log('    After Date:', afterDate);
      console.log('    Product Type:', productType);
      console.log('    Exclude Transaction ID:', excludeTransactionId || 'none');
      
      await this.recalculateWarehouseChain(
        tx,
        warehouseId,
        afterDate,
        productType,
        updatedById,
        visited,
        excludeTransactionId
      );
      
      console.log(`    ✓ Склад ${i + 1} пересчитан`);
    }
    
    console.log('\n  ✓ Все затронутые склады пересчитаны');
  }

  private static async recalculateWarehouseChain(
    tx: any,
    warehouseId: string,
    afterDate: string,
    productType: string,
    updatedById?: string,
    visitedWarehouses?: Set<string>,
    excludeTransactionId?: string
  ) {
    console.log('      [recalculateWarehouseChain] Начало пересчета цепочки');
    console.log('      excludeTransactionId:', excludeTransactionId || 'none');
    const isPvkj = productType === PRODUCT_TYPE.PVKJ;
    const visited = visitedWarehouses || new Set<string>();

    // Если есть исключаемая транзакция, используем её как точку отсчета
    let effectiveAfterDate = afterDate;
    let excludedTxInfo: { transactionDate: string; createdAt: string; id: string } | null = null;
    
    if (excludeTransactionId) {
      const excludedTx = await tx
        .select()
        .from(warehouseTransactions)
        .where(eq(warehouseTransactions.id, excludeTransactionId))
        .limit(1);
      
      if (excludedTx.length > 0) {
        excludedTxInfo = excludedTx[0];
        // Используем дату исключаемой транзакции как точку отсчета
        effectiveAfterDate = excludedTx[0].transactionDate || excludedTx[0].createdAt;
        console.log(`      Используем дату исключаемой транзакции: ${effectiveAfterDate}`);
      }
    }

    // Получаем начальное состояние: учитываем исключаемую транзакцию как точку отсчета
    const initialState = await this.getWarehouseStateBeforeDate(
      tx,
      warehouseId,
      effectiveAfterDate,
      productType,
      excludeTransactionId
    );

    console.log('      Начальное состояние:', initialState);

    // Получаем транзакции СТРОГО ПОСЛЕ исключаемой транзакции
    // Используем gt (строго больше) для даты и исключаем саму транзакцию
    let transactions: any[];
    
    if (excludedTxInfo) {
      // При наличии исключаемой транзакции:
      // 1. Берем все транзакции с той же датой или позже
      // 2. Исключаем саму транзакцию
      // 3. Сортируем так, чтобы транзакции ПОСЛЕ исключаемой шли правильно
      const allTransactions = await tx
        .select()
        .from(warehouseTransactions)
        .where(
          and(
            eq(warehouseTransactions.warehouseId, warehouseId),
            eq(warehouseTransactions.productType, productType),
            isNull(warehouseTransactions.deletedAt),
            ne(warehouseTransactions.id, excludeTransactionId),
            or(
              gt(warehouseTransactions.transactionDate, effectiveAfterDate),
              and(
                eq(warehouseTransactions.transactionDate, effectiveAfterDate),
                gt(warehouseTransactions.createdAt, excludedTxInfo.createdAt)
              ),
              and(
                eq(warehouseTransactions.transactionDate, effectiveAfterDate),
                eq(warehouseTransactions.createdAt, excludedTxInfo.createdAt),
                gt(warehouseTransactions.id, excludedTxInfo.id)
              ),
              and(
                isNull(warehouseTransactions.transactionDate),
                gt(warehouseTransactions.createdAt, effectiveAfterDate)
              )
            )
          )
        )
        .orderBy(
          asc(sql`COALESCE(${warehouseTransactions.transactionDate}, ${warehouseTransactions.createdAt})`),
          asc(warehouseTransactions.createdAt),
          asc(warehouseTransactions.id)
        );
      
      transactions = allTransactions;
      console.log(`      Исключена транзакция ${excludeTransactionId}, пересчет начинается с транзакций после нее`);
    } else {
      // Стандартная логика без исключаемой транзакции
      transactions = await tx
        .select()
        .from(warehouseTransactions)
        .where(
          and(
            eq(warehouseTransactions.warehouseId, warehouseId),
            eq(warehouseTransactions.productType, productType),
            isNull(warehouseTransactions.deletedAt),
            or(
              gte(warehouseTransactions.transactionDate, effectiveAfterDate),
              and(
                isNull(warehouseTransactions.transactionDate),
                gte(warehouseTransactions.createdAt, effectiveAfterDate)
              )
            )
          )
        )
        .orderBy(
          asc(sql`COALESCE(${warehouseTransactions.transactionDate}, ${warehouseTransactions.createdAt})`),
          asc(warehouseTransactions.createdAt),
          asc(warehouseTransactions.id)
        );
    }

    console.log('      Найдено транзакций для пересчета:', transactions.length);

    let currentBalance = initialState.balance;
    let currentAverageCost = initialState.averageCost;
    
    const cascadeRecalculations: Array<{
      warehouseId: string;
      afterDate: string;
      productType: string;
    }> = [];

    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      console.log(`\n      --- Транзакция ${i + 1}/${transactions.length} ---`);
      console.log('      ID:', transaction.id);
      console.log('      Type:', transaction.transactionType);
      console.log('      Source:', transaction.sourceType, transaction.sourceId);
      console.log('      TransactionDate:', transaction.transactionDate);
      console.log('      CreatedAt:', transaction.createdAt);
      
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
      let newSum: number;
      let newPrice: number;

      if (isReceipt) {
        newBalance = currentBalance + quantity;
        
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
        
        newSum = incomingCost;
        newPrice = quantity > 0 ? incomingCost / quantity : 0;
      } else {
        newBalance = Math.max(0, currentBalance - quantity);
        newAverageCost = currentAverageCost;
        
        newSum = quantity * currentAverageCost;
        newPrice = currentAverageCost;
      }

      console.log('      После пересчета:', {
        balance: newBalance,
        averageCost: newAverageCost,
        sum: newSum,
        price: newPrice,
      });

      await tx.update(warehouseTransactions)
        .set({
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          averageCostBefore: currentAverageCost.toFixed(4),
          averageCostAfter: newAverageCost.toFixed(4),
          sum: newSum.toFixed(2),
          price: newPrice.toFixed(4),
          updatedAt: sql`NOW()`,
          updatedById,
        })
        .where(eq(warehouseTransactions.id, transaction.id));

      console.log('      ✓ Транзакция обновлена в БД');

      if (transaction.transactionType === TRANSACTION_TYPE.SALE) {
        console.log('      → Обновление связанной сделки (продажа)');
        await this.updateRelatedDeal(
          tx,
          transaction.sourceType,
          transaction.sourceId,
          currentAverageCost,
          updatedById
        );
      }

      if (transaction.sourceType === SOURCE_TYPE.MOVEMENT && 
          transaction.transactionType === TRANSACTION_TYPE.TRANSFER_OUT) {
        const movementCascade = await this.getMovementCascadeInfo(
          tx,
          transaction.sourceId,
          newAverageCost,
          quantity,
          visited
        );
        
        if (movementCascade) {
          cascadeRecalculations.push(movementCascade);
        }
      }

      currentBalance = newBalance;
      currentAverageCost = newAverageCost;
    }

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

    for (const cascade of cascadeRecalculations) {
      const cascadeKey = `${cascade.warehouseId}:${cascade.productType}`;
      if (visited.has(cascadeKey)) {
        console.log(`      → Каскадный пересчет ${cascade.warehouseId} уже в процессе, пропускаем`);
        continue;
      }
      
      visited.add(cascadeKey);
      console.log(`\n      → Каскадный пересчет склада-получателя: ${cascade.warehouseId}`);
      await this.recalculateWarehouseChain(
        tx,
        cascade.warehouseId,
        cascade.afterDate,
        cascade.productType,
        updatedById,
        visited
      );
    }
  }

  private static async getWarehouseStateBeforeDate(
    tx: any,
    warehouseId: string,
    beforeDate: string,
    productType: string,
    excludeTransactionId?: string
  ): Promise<{ balance: number; averageCost: number }> {
    // Если есть исключаемая транзакция, берем её balanceAfter как начальную точку
    // Это нужно для пересчета транзакций ПОСЛЕ исключаемой
    if (excludeTransactionId) {
      const excludedTx = await tx
        .select()
        .from(warehouseTransactions)
        .where(eq(warehouseTransactions.id, excludeTransactionId))
        .limit(1);
      
      if (excludedTx.length > 0) {
        console.log('      Используем balanceAfter исключаемой транзакции как начальное состояние');
        return {
          balance: parseFloat(excludedTx[0].balanceAfter || "0"),
          averageCost: parseFloat(excludedTx[0].averageCostAfter || "0"),
        };
      }
    }

    // Стандартная логика: берем последнюю транзакцию до указанной даты
    const lastTransaction = await tx
      .select()
      .from(warehouseTransactions)
      .where(
        and(
          eq(warehouseTransactions.warehouseId, warehouseId),
          eq(warehouseTransactions.productType, productType),
          isNull(warehouseTransactions.deletedAt),
          sql`COALESCE(${warehouseTransactions.transactionDate}, ${warehouseTransactions.createdAt}) < ${beforeDate}`
        )
      )
      .orderBy(
        desc(sql`COALESCE(${warehouseTransactions.transactionDate}, ${warehouseTransactions.createdAt})`),
        desc(warehouseTransactions.createdAt),
        desc(warehouseTransactions.id)
      )
      .limit(1);

    if (lastTransaction.length > 0) {
      return {
        balance: parseFloat(lastTransaction[0].balanceAfter || "0"),
        averageCost: parseFloat(lastTransaction[0].averageCostAfter || "0"),
      };
    }

    return { balance: 0, averageCost: 0 };
  }

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

    return 0;
  }

  private static async getMovementCascadeInfo(
    tx: any,
    movementId: string,
    newSourceAverageCost: number,
    quantity: number,
    visitedWarehouses: Set<string>
  ): Promise<{ warehouseId: string; afterDate: string; productType: string } | null> {
    const movementRecord = await tx.query.movement.findFirst({
      where: eq(movement.id, movementId),
    });

    if (!movementRecord || !movementRecord.toWarehouseId || !movementRecord.fromWarehouseId) {
      return null;
    }

    const cascadeKey = `${movementRecord.toWarehouseId}:${movementRecord.productType || "kerosene"}`;
    if (visitedWarehouses.has(cascadeKey)) {
      console.log(`        Склад-получатель ${movementRecord.toWarehouseId} уже в очереди на пересчет`);
      return null;
    }

    const newTotalCost = quantity * newSourceAverageCost;
    const oldTotalCost = parseFloat(movementRecord.totalCost || "0");
    
    if (Math.abs(newTotalCost - oldTotalCost) > 0.01) {
      console.log(`        Обновление стоимости перемещения: ${oldTotalCost} -> ${newTotalCost}`);
      
      await tx.update(movement)
        .set({
          totalCost: newTotalCost.toFixed(2),
          updatedAt: sql`NOW()`,
        })
        .where(eq(movement.id, movementId));

      const destinationTransaction = await tx.query.warehouseTransactions.findFirst({
        where: and(
          eq(warehouseTransactions.sourceType, SOURCE_TYPE.MOVEMENT),
          eq(warehouseTransactions.sourceId, movementId),
          eq(warehouseTransactions.warehouseId, movementRecord.toWarehouseId),
          or(
            eq(warehouseTransactions.transactionType, TRANSACTION_TYPE.RECEIPT),
            eq(warehouseTransactions.transactionType, TRANSACTION_TYPE.TRANSFER_IN)
          ),
          isNull(warehouseTransactions.deletedAt)
        )
      });

      if (destinationTransaction) {
        const txDate = destinationTransaction.transactionDate || destinationTransaction.createdAt;
        return {
          warehouseId: movementRecord.toWarehouseId,
          afterDate: txDate,
          productType: movementRecord.productType || "kerosene",
        };
      }
    }

    return null;
  }

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
        const agentFee = parseFloat(refuel.agentFee || "0");
        const purchaseAmount = quantityKg * newAverageCost;
        const saleAmount = quantityKg * salePrice;
        const profit = saleAmount - purchaseAmount - agentFee;

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

  static getAffectedWarehouses(
    movementRecord: any,
    movementDate: string
  ): Array<{ warehouseId: string; afterDate: string; productType: string }> {
    const affected: Array<{ warehouseId: string; afterDate: string; productType: string }> = [];

    if (movementRecord.fromWarehouseId) {
      affected.push({
        warehouseId: movementRecord.fromWarehouseId,
        afterDate: movementDate,
        productType: movementRecord.productType || "kerosene",
      });
    }

    if (movementRecord.toWarehouseId) {
      affected.push({
        warehouseId: movementRecord.toWarehouseId,
        afterDate: movementDate,
        productType: movementRecord.productType || "kerosene",
      });
    }

    return affected;
  }
}
