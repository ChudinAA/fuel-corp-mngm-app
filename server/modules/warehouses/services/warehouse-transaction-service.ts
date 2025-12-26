
import { eq, and, gt, sql } from "drizzle-orm";
import { warehouses, warehouseTransactions, opt, aircraftRefueling, movement } from "@shared/schema";
import { PRODUCT_TYPE, TRANSACTION_TYPE, SOURCE_TYPE } from "@shared/constants";

interface WarehouseUpdate {
  warehouseId: string;
  productType: string;
  quantity: number;
  totalCost: number;
  isPvkj: boolean;
}

interface TransactionRecord {
  warehouseId: string;
  transactionType: string;
  productType: string;
  sourceType: string;
  sourceId: string;
  quantity: number;
  createdById?: string;
  updatedById?: string;
}

export class WarehouseTransactionService {
  /**
   * Создает транзакцию и обновляет баланс склада
   */
  static async createTransactionAndUpdateWarehouse(
    tx: any,
    warehouseId: string,
    transactionType: string,
    productType: string,
    sourceType: string,
    sourceId: string,
    quantity: number,
    totalCost: number,
    createdById?: string
  ) {
    const isPvkj = productType === PRODUCT_TYPE.PVKJ;
    
    const warehouse = await tx.query.warehouses.findFirst({
      where: eq(warehouses.id, warehouseId),
    });

    if (!warehouse) {
      throw new Error(`Warehouse ${warehouseId} not found`);
    }

    let currentBalance: number;
    let currentCost: number;
    let newBalance: number;
    let newAverageCost: number;

    if (isPvkj) {
      currentBalance = parseFloat(warehouse.pvkjBalance || "0");
      currentCost = parseFloat(warehouse.pvkjAverageCost || "0");
    } else {
      currentBalance = parseFloat(warehouse.currentBalance || "0");
      currentCost = parseFloat(warehouse.averageCost || "0");
    }

    // Расчет нового баланса и себестоимости
    if (transactionType === TRANSACTION_TYPE.RECEIPT || transactionType === TRANSACTION_TYPE.TRANSFER_IN) {
      // Приход
      newBalance = currentBalance + quantity;
      const totalCurrentCost = currentBalance * currentCost;
      newAverageCost = newBalance > 0 ? (totalCurrentCost + totalCost) / newBalance : 0;
    } else {
      // Расход
      newBalance = Math.max(0, currentBalance - quantity);
      newAverageCost = currentCost; // При расходе себестоимость не меняется
    }

    // Обновляем склад
    if (isPvkj) {
      await tx.update(warehouses)
        .set({
          pvkjBalance: newBalance.toFixed(2),
          pvkjAverageCost: newAverageCost.toFixed(4),
          updatedAt: sql`NOW()`,
          updatedById: createdById,
        })
        .where(eq(warehouses.id, warehouseId));
    } else {
      await tx.update(warehouses)
        .set({
          currentBalance: newBalance.toFixed(2),
          averageCost: newAverageCost.toFixed(4),
          updatedAt: sql`NOW()`,
          updatedById: createdById,
        })
        .where(eq(warehouses.id, warehouseId));
    }

    // Создаем транзакцию
    const [transaction] = await tx.insert(warehouseTransactions).values({
      warehouseId,
      transactionType,
      productType,
      sourceType,
      sourceId,
      quantity: transactionType.includes('sale') || transactionType === TRANSACTION_TYPE.TRANSFER_OUT 
        ? (-quantity).toString() 
        : quantity.toString(),
      balanceBefore: currentBalance.toString(),
      balanceAfter: newBalance.toString(),
      averageCostBefore: currentCost.toString(),
      averageCostAfter: newAverageCost.toString(),
      createdById,
    }).returning();

    return { transaction, newAverageCost, newBalance };
  }

  /**
   * Обновляет транзакцию и пересчитывает баланс склада
   */
  static async updateTransactionAndRecalculateWarehouse(
    tx: any,
    transactionId: string,
    warehouseId: string,
    oldQuantity: number,
    oldTotalCost: number,
    newQuantity: number,
    newTotalCost: number,
    productType: string,
    updatedById?: string
  ) {
    console.log('  [WarehouseTransactionService] updateTransactionAndRecalculateWarehouse');
    console.log('    Transaction ID:', transactionId);
    console.log('    Warehouse ID:', warehouseId);
    console.log('    Old:', { quantity: oldQuantity, totalCost: oldTotalCost });
    console.log('    New:', { quantity: newQuantity, totalCost: newTotalCost });
    console.log('    Product Type:', productType);
    
    const isPvkj = productType === PRODUCT_TYPE.PVKJ;
    
    // Получаем информацию о транзакции для определения типа операции
    const transaction = await tx.query.warehouseTransactions.findFirst({
      where: eq(warehouseTransactions.id, transactionId),
    });

    if (!transaction) {
      console.log('    ❌ Транзакция не найдена');
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const isReceipt = transaction.transactionType === TRANSACTION_TYPE.RECEIPT || 
                     transaction.transactionType === TRANSACTION_TYPE.TRANSFER_IN;
    
    console.log('    Тип транзакции:', transaction.transactionType, isReceipt ? '(приход)' : '(расход)');
    
    const warehouse = await tx.query.warehouses.findFirst({
      where: eq(warehouses.id, warehouseId),
    });

    if (!warehouse) {
      console.log('    ❌ Склад не найден');
      throw new Error(`Warehouse ${warehouseId} not found`);
    }

    console.log('    ✓ Склад найден:', warehouse.name);

    let currentBalance: number;
    let currentCost: number;

    if (isPvkj) {
      currentBalance = parseFloat(warehouse.pvkjBalance || "0");
      currentCost = parseFloat(warehouse.pvkjAverageCost || "0");
    } else {
      currentBalance = parseFloat(warehouse.currentBalance || "0");
      currentCost = parseFloat(warehouse.averageCost || "0");
    }

    console.log('    Текущее состояние склада:', {
      balance: currentBalance,
      averageCost: currentCost,
    });

    let balanceBeforeOldOperation: number;
    let totalCostBeforeOldOperation: number;
    let newBalance: number;
    let newTotalCostInWarehouse: number;
    let newAverageCost: number;

    if (isReceipt) {
      // Для прихода: откатываем добавление, затем применяем новое
      balanceBeforeOldOperation = currentBalance - oldQuantity;
      totalCostBeforeOldOperation = (currentBalance * currentCost) - oldTotalCost;
      
      console.log('    После отката старой операции (приход):', {
        balance: balanceBeforeOldOperation,
        totalCost: totalCostBeforeOldOperation,
      });
      
      newBalance = balanceBeforeOldOperation + newQuantity;
      newTotalCostInWarehouse = totalCostBeforeOldOperation + newTotalCost;
      newAverageCost = newBalance > 0 ? newTotalCostInWarehouse / newBalance : 0;
    } else {
      // Для расхода: откатываем вычитание (добавляем обратно), затем применяем новое вычитание
      balanceBeforeOldOperation = currentBalance + oldQuantity;
      totalCostBeforeOldOperation = balanceBeforeOldOperation * currentCost;
      
      console.log('    После отката старой операции (расход):', {
        balance: balanceBeforeOldOperation,
        totalCost: totalCostBeforeOldOperation,
      });
      
      newBalance = Math.max(0, balanceBeforeOldOperation - newQuantity);
      newTotalCostInWarehouse = totalCostBeforeOldOperation; // При расходе себестоимость не меняется
      newAverageCost = currentCost; // Сохраняем текущую себестоимость
    }

    console.log('    После применения новой операции:', {
      newBalance,
      newTotalCostInWarehouse,
      newAverageCost,
    });

    // Обновляем склад
    if (isPvkj) {
      await tx.update(warehouses)
        .set({
          pvkjBalance: newBalance.toFixed(2),
          pvkjAverageCost: newAverageCost.toFixed(4),
          updatedAt: sql`NOW()`,
          updatedById,
        })
        .where(eq(warehouses.id, warehouseId));
    } else {
      await tx.update(warehouses)
        .set({
          currentBalance: newBalance.toFixed(2),
          averageCost: newAverageCost.toFixed(4),
          updatedAt: sql`NOW()`,
          updatedById,
        })
        .where(eq(warehouses.id, warehouseId));
    }

    console.log('    ✓ Склад обновлен');

    // Обновляем транзакцию
    await tx.update(warehouseTransactions)
      .set({
        quantity: isReceipt ? newQuantity.toString() : (-newQuantity).toString(),
        balanceAfter: newBalance.toString(),
        averageCostAfter: newAverageCost.toFixed(4),
        updatedAt: sql`NOW()`,
        updatedById,
      })
      .where(eq(warehouseTransactions.id, transactionId));

    console.log('    ✓ Транзакция обновлена');

    return { newAverageCost, newBalance };
  }

  /**
   * Удаляет транзакцию и откатывает изменения склада
   */
  static async deleteTransactionAndRevertWarehouse(
    tx: any,
    transactionId: string,
    warehouseId: string,
    quantity: number,
    totalCost: number,
    productType: string
  ) {
    const isPvkj = productType === PRODUCT_TYPE.PVKJ;
    
    const warehouse = await tx.query.warehouses.findFirst({
      where: eq(warehouses.id, warehouseId),
    });

    if (!warehouse) {
      throw new Error(`Warehouse ${warehouseId} not found`);
    }

    let currentBalance: number;
    let currentCost: number;

    if (isPvkj) {
      currentBalance = parseFloat(warehouse.pvkjBalance || "0");
      currentCost = parseFloat(warehouse.pvkjAverageCost || "0");
    } else {
      currentBalance = parseFloat(warehouse.currentBalance || "0");
      currentCost = parseFloat(warehouse.averageCost || "0");
    }

    const newBalance = Math.max(0, currentBalance - quantity);
    
    // Пересчитываем среднюю себестоимость
    const totalCostBeforeRemoval = currentBalance * currentCost;
    const newTotalCost = Math.max(0, totalCostBeforeRemoval - totalCost);
    const newAverageCost = newBalance > 0 ? newTotalCost / newBalance : 0;

    // Обновляем склад
    if (isPvkj) {
      await tx.update(warehouses)
        .set({
          pvkjBalance: newBalance.toFixed(2),
          pvkjAverageCost: newAverageCost.toFixed(4),
          updatedAt: sql`NOW()`,
        })
        .where(eq(warehouses.id, warehouseId));
    } else {
      await tx.update(warehouses)
        .set({
          currentBalance: newBalance.toFixed(2),
          averageCost: newAverageCost.toFixed(4),
          updatedAt: sql`NOW()`,
        })
        .where(eq(warehouses.id, warehouseId));
    }

    // Удаляем транзакцию
    await tx.delete(warehouseTransactions).where(eq(warehouseTransactions.id, transactionId));

    return { newAverageCost, newBalance };
  }
}
