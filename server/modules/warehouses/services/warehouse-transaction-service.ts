
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

    // Откатываем старую операцию
    const balanceBeforeOldOperation = currentBalance - oldQuantity;
    const totalCostBeforeOldOperation = balanceBeforeOldOperation * currentCost;
    
    // Применяем новую операцию
    const newBalance = balanceBeforeOldOperation + newQuantity;
    const newTotalCostInWarehouse = totalCostBeforeOldOperation + newTotalCost;
    const newAverageCost = newBalance > 0 ? newTotalCostInWarehouse / newBalance : 0;

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

    // Обновляем транзакцию
    await tx.update(warehouseTransactions)
      .set({
        quantity: newQuantity.toString(),
        balanceAfter: newBalance.toString(),
        averageCostAfter: newAverageCost.toFixed(4),
        updatedAt: sql`NOW()`,
        updatedById,
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

  /**
   * Пересчитывает все транзакции после определенной даты
   */
  static async recalculateTransactionsAfterDate(
    tx: any,
    warehouseId: string,
    afterDate: string,
    productType: string,
    updatedById?: string
  ) {
    const isPvkj = productType === PRODUCT_TYPE.PVKJ;

    // Получаем все транзакции после указанной даты, отсортированные по времени
    const transactions = await tx.query.warehouseTransactions.findMany({
      where: and(
        eq(warehouseTransactions.warehouseId, warehouseId),
        eq(warehouseTransactions.productType, productType),
        gt(warehouseTransactions.createdAt, afterDate)
      ),
      orderBy: (warehouseTransactions, { asc }) => [asc(warehouseTransactions.createdAt)],
    });

    // Получаем текущее состояние склада
    const warehouse = await tx.query.warehouses.findFirst({
      where: eq(warehouses.id, warehouseId),
    });

    if (!warehouse) return;

    // Пересчитываем каждую транзакцию
    for (const trans of transactions) {
      const currentBalance = isPvkj 
        ? parseFloat(warehouse.pvkjBalance || "0")
        : parseFloat(warehouse.currentBalance || "0");
      const currentCost = isPvkj
        ? parseFloat(warehouse.pvkjAverageCost || "0")
        : parseFloat(warehouse.averageCost || "0");

      await tx.update(warehouseTransactions)
        .set({
          balanceBefore: currentBalance.toString(),
          averageCostBefore: currentCost.toString(),
          updatedAt: sql`NOW()`,
          updatedById,
        })
        .where(eq(warehouseTransactions.id, trans.id));
    }
  }

  /**
   * Пересчитывает все сделки (ОПТ и Заправки) после определенной даты
   */
  static async recalculateDealsAfterDate(
    tx: any,
    warehouseId: string,
    afterDate: string,
    productType: string,
    newAverageCost: number,
    updatedById?: string
  ) {
    // Получаем все сделки ОПТ после даты
    const affectedOptDeals = await tx.query.opt.findMany({
      where: and(
        eq(opt.warehouseId, warehouseId),
        gt(opt.dealDate, afterDate)
      ),
      with: {
        transaction: true,
      }
    });

    // Обновляем сделки ОПТ
    for (const deal of affectedOptDeals) {
      if (deal.transactionId) {
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
          .where(eq(opt.id, deal.id));

        // Обновляем связанную транзакцию
        if (deal.transaction) {
          await tx.update(warehouseTransactions)
            .set({
              averageCostBefore: newAverageCost.toFixed(4),
              updatedAt: sql`NOW()`,
              updatedById,
            })
            .where(eq(warehouseTransactions.id, deal.transactionId));
        }
      }
    }

    // Получаем все заправки после даты
    const affectedRefuelings = await tx.query.aircraftRefueling.findMany({
      where: and(
        eq(aircraftRefueling.warehouseId, warehouseId),
        eq(aircraftRefueling.productType, productType),
        gt(aircraftRefueling.refuelingDate, afterDate)
      ),
      with: {
        transaction: true,
      }
    });

    // Обновляем заправки
    for (const refuel of affectedRefuelings) {
      if (refuel.transactionId && refuel.productType !== PRODUCT_TYPE.SERVICE) {
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
          .where(eq(aircraftRefueling.id, refuel.id));

        // Обновляем связанную транзакцию
        if (refuel.transaction) {
          await tx.update(warehouseTransactions)
            .set({
              averageCostBefore: newAverageCost.toFixed(4),
              updatedAt: sql`NOW()`,
              updatedById,
            })
            .where(eq(warehouseTransactions.id, refuel.transactionId));
        }
      }
    }

    // Пересчитываем транзакции других перемещений после этой даты
    await this.recalculateTransactionsAfterDate(tx, warehouseId, afterDate, productType, updatedById);
  }
}
