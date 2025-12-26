
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
   * Обновляет только транзакцию без изменения склада
   * Используется ТОЛЬКО для обновления записи перемещения в БД
   * Пересчет склада и последующих транзакций делает WarehouseRecalculationService
   */
  static async updateTransactionRecord(
    tx: any,
    transactionId: string,
    newQuantity: number,
    newTotalCost: number,
    productType: string,
    updatedById?: string
  ) {
    console.log('  [WarehouseTransactionService] updateTransactionRecord');
    console.log('    Transaction ID:', transactionId);
    console.log('    New quantity:', newQuantity);
    console.log('    New total cost:', newTotalCost);
    
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

    // Обновляем только quantity в транзакции
    // balanceBefore, balanceAfter, averageCost будут пересчитаны в WarehouseRecalculationService
    await tx.update(warehouseTransactions)
      .set({
        quantity: isReceipt ? newQuantity.toString() : (-newQuantity).toString(),
        updatedAt: sql`NOW()`,
        updatedById,
      })
      .where(eq(warehouseTransactions.id, transactionId));

    console.log('    ✓ Транзакция обновлена (только quantity)');
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
