import { eq, and, gt, sql } from "drizzle-orm";
import { warehouses, warehouseTransactions } from "@shared/schema";
import { PRODUCT_TYPE, TRANSACTION_TYPE } from "@shared/constants";

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
    createdById?: string,
    dealDate?: string,
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
    let sum: number;
    let price: number;

    if (isPvkj) {
      currentBalance = parseFloat(warehouse.pvkjBalance || "0");
      currentCost = parseFloat(warehouse.pvkjAverageCost || "0");
    } else {
      currentBalance = parseFloat(warehouse.currentBalance || "0");
      currentCost = parseFloat(warehouse.averageCost || "0");
    }

    const isReceipt =
      transactionType === TRANSACTION_TYPE.RECEIPT ||
      transactionType === TRANSACTION_TYPE.TRANSFER_IN;

    // Расчет нового баланса и себестоимости
    if (isReceipt) {
      // Приход
      newBalance = currentBalance + quantity;
      const totalCurrentCost = currentBalance * currentCost;
      newAverageCost =
        newBalance > 0 ? (totalCurrentCost + totalCost) / newBalance : 0;
    } else {
      // Расход
      newBalance = Math.max(0, currentBalance - quantity);
      newAverageCost = currentCost; // При расходе себестоимость не меняется
    }

    // Обновляем склад
    if (isPvkj) {
      await tx
        .update(warehouses)
        .set({
          pvkjBalance: newBalance.toFixed(2),
          pvkjAverageCost: newAverageCost.toFixed(4),
          updatedAt: sql`NOW()`,
          updatedById: createdById,
        })
        .where(eq(warehouses.id, warehouseId));
    } else {
      await tx
        .update(warehouses)
        .set({
          currentBalance: newBalance.toFixed(2),
          averageCost: newAverageCost.toFixed(4),
          updatedAt: sql`NOW()`,
          updatedById: createdById,
        })
        .where(eq(warehouses.id, warehouseId));
    }

    // При расходе totalCost = 0
    if (totalCost === 0) {
      sum = quantity * currentCost;
      price = currentCost;
    } else {
      sum = totalCost;
      price = quantity > 0 ? totalCost / quantity : 0;
    }

    // Создаем транзакцию
    const [transaction] = await tx
      .insert(warehouseTransactions)
      .values({
        warehouseId,
        transactionType,
        productType,
        sourceType,
        sourceId,
        quantity: isReceipt ? quantity.toString() : (-quantity).toString(),
        sum: sum.toString(),
        price: price.toString(),
        balanceBefore: currentBalance.toString(),
        balanceAfter: newBalance.toString(),
        averageCostBefore: currentCost.toString(),
        averageCostAfter: newAverageCost.toString(),
        createdById,
        transactionDate: dealDate,
      })
      .returning();

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
    updatedById?: string,
    dealDate?: string,
  ) {
    const isPvkj = productType === PRODUCT_TYPE.PVKJ;

    // Получаем информацию о транзакции для определения типа операции
    const transaction = await tx.query.warehouseTransactions.findFirst({
      where: eq(warehouseTransactions.id, transactionId),
    });

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const isReceipt =
      transaction.transactionType === TRANSACTION_TYPE.RECEIPT ||
      transaction.transactionType === TRANSACTION_TYPE.TRANSFER_IN;

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

    let balanceBeforeOldOperation: number;
    let totalCostBeforeOldOperation: number;
    let newBalance: number;
    let newTotalCostInWarehouse: number;
    let newAverageCost: number;
    let sum: number;
    let price: number;

    if (isReceipt) {
      // Для прихода: откатываем добавление, затем применяем новое
      balanceBeforeOldOperation = currentBalance - oldQuantity;
      totalCostBeforeOldOperation = currentBalance * currentCost - oldTotalCost;

      newBalance = balanceBeforeOldOperation + newQuantity;
      newTotalCostInWarehouse = totalCostBeforeOldOperation + newTotalCost;
      newAverageCost =
        newBalance > 0 ? newTotalCostInWarehouse / newBalance : 0;
    } else {
      // Для расхода: откатываем вычитание (добавляем обратно), затем применяем новое вычитание
      balanceBeforeOldOperation = currentBalance + oldQuantity;
      totalCostBeforeOldOperation = balanceBeforeOldOperation * currentCost;

      newBalance = Math.max(0, balanceBeforeOldOperation - newQuantity);
      newTotalCostInWarehouse = totalCostBeforeOldOperation; // При расходе себестоимость не меняется
      newAverageCost = currentCost; // Сохраняем текущую себестоимость
    }

    // При расходе totalCost = 0
    if (newTotalCost === 0) {
      sum = newQuantity * currentCost;
      price = currentCost;
    } else {
      sum = newTotalCost;
      price = newQuantity > 0 ? newTotalCost / newQuantity : 0;
    }

    // Обновляем склад
    if (isPvkj) {
      await tx
        .update(warehouses)
        .set({
          pvkjBalance: newBalance.toFixed(2),
          pvkjAverageCost: newAverageCost.toFixed(4),
          updatedAt: sql`NOW()`,
          updatedById,
        })
        .where(eq(warehouses.id, warehouseId));
    } else {
      await tx
        .update(warehouses)
        .set({
          currentBalance: newBalance.toFixed(2),
          averageCost: newAverageCost.toFixed(4),
          updatedAt: sql`NOW()`,
          updatedById,
        })
        .where(eq(warehouses.id, warehouseId));
    }

    // Обновляем транзакцию
    await tx
      .update(warehouseTransactions)
      .set({
        quantity: isReceipt
          ? newQuantity.toString()
          : (-newQuantity).toString(),
        sum: sum.toString(),
        price: price.toString(),
        balanceAfter: newBalance.toString(),
        averageCostAfter: newAverageCost.toFixed(4),
        updatedAt: sql`NOW()`,
        updatedById,
        transactionDate: dealDate,
      })
      .where(eq(warehouseTransactions.id, transactionId));

    return { newAverageCost, newBalance };
  }

  /**
   * Удаляет транзакцию и откатывает изменения склада
   */
  static async deleteTransactionAndRevertWarehouse(
    tx: any,
    transactionId: string,
    updatedById?: string,
  ) {
    // Получаем информацию о транзакции для определения типа операции
    const transaction = await tx.query.warehouseTransactions.findFirst({
      where: eq(warehouseTransactions.id, transactionId),
    });

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const isPvkj = transaction.productType === PRODUCT_TYPE.PVKJ;

    const warehouse = await tx.query.warehouses.findFirst({
      where: eq(warehouses.id, transaction.warehouseId),
    });

    if (!warehouse) {
      throw new Error(`Warehouse ${transaction.warehouseId} not found`);
    }

    const quantity = parseFloat(transaction.quantity);
    const totalCost = parseFloat(transaction.sum || "0");

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
    let newAverageCost = currentCost;

    if (transaction.averageCostBefore !== transaction.averageCostAfter) {
      // Пересчитываем среднюю себестоимость
      const totalCostBeforeRemoval = currentBalance * currentCost;
      const newTotalCost = Math.max(0, totalCostBeforeRemoval - totalCost);
      newAverageCost = newBalance > 0 ? newTotalCost / newBalance : 0;
    }

    // Обновляем склад
    if (isPvkj) {
      await tx
        .update(warehouses)
        .set({
          pvkjBalance: newBalance.toFixed(2),
          pvkjAverageCost: newAverageCost.toFixed(4),
          updatedAt: sql`NOW()`,
          updatedById: updatedById,
        })
        .where(eq(warehouses.id, transaction.warehouseId));
    } else {
      await tx
        .update(warehouses)
        .set({
          currentBalance: newBalance.toFixed(2),
          averageCost: newAverageCost.toFixed(4),
          updatedAt: sql`NOW()`,
          updatedById: updatedById,
        })
        .where(eq(warehouses.id, transaction.warehouseId));
    }

    // Soft delete транзакции
    await tx
      .update(warehouseTransactions)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: updatedById,
      })
      .where(eq(warehouseTransactions.id, transactionId));

    return { newAverageCost, newBalance };
  }

  /**
   * Восстанавливет транзакцию и пересчитывает баланс склада
   */
  static async restoreTransactionAndRecalculateWarehouse(
    tx: any,
    transactionId: string,
    updatedById?: string,
  ) {
    const transaction = await tx.query.warehouseTransactions.findFirst({
      where: eq(warehouseTransactions.id, transactionId),
    });

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const isPvkj = transaction.productType === PRODUCT_TYPE.PVKJ;

    const warehouse = await tx.query.warehouses.findFirst({
      where: eq(warehouses.id, transaction.warehouseId),
    });

    if (!warehouse) {
      throw new Error(`Warehouse ${transaction.warehouseId} not found`);
    }

    const quantity = parseFloat(transaction.quantity);
    const totalCost = parseFloat(transaction.sum || "0");

    let currentBalance: number;
    let currentCost: number;

    if (isPvkj) {
      currentBalance = parseFloat(warehouse.pvkjBalance || "0");
      currentCost = parseFloat(warehouse.pvkjAverageCost || "0");
    } else {
      currentBalance = parseFloat(warehouse.currentBalance || "0");
      currentCost = parseFloat(warehouse.averageCost || "0");
    }

    const newBalance = Math.max(0, currentBalance + quantity);
    let newAverageCost = currentCost;

    if (transaction.averageCostBefore !== transaction.averageCostAfter) {
      // Пересчитываем среднюю себестоимость
      const totalCostBeforeRemoval = currentBalance * currentCost;
      const newTotalCost = Math.max(0, totalCostBeforeRemoval + totalCost);
      newAverageCost = newBalance > 0 ? newTotalCost / newBalance : 0;
    }

    // Обновляем склад
    if (isPvkj) {
      await tx
        .update(warehouses)
        .set({
          pvkjBalance: newBalance.toFixed(2),
          pvkjAverageCost: newAverageCost.toFixed(4),
          updatedAt: sql`NOW()`,
          updatedById: updatedById,
        })
        .where(eq(warehouses.id, transaction.warehouseId));
    } else {
      await tx
        .update(warehouses)
        .set({
          currentBalance: newBalance.toFixed(2),
          averageCost: newAverageCost.toFixed(4),
          updatedAt: sql`NOW()`,
          updatedById: updatedById,
        })
        .where(eq(warehouses.id, transaction.warehouseId));
    }

    // Restore soft delete транзакции
    await tx
      .update(warehouseTransactions)
      .set({
        deletedAt: null,
        deletedById: null,
      })
      .where(eq(warehouseTransactions.id, transactionId));

    return { newAverageCost, newBalance };
  }
}
