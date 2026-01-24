import { eq, and, gt, sql, isNull, desc, asc } from "drizzle-orm";
import { warehouses, warehouseTransactions } from "@shared/schema";
import { PRODUCT_TYPE, TRANSACTION_TYPE } from "@shared/constants";
import { RecalculationQueueService } from "./recalculation-queue-service";
import { RecalculationWorker } from "./recalculation-worker";

export class WarehouseTransactionService {
  private static async getLatestTransactionDate(
    tx: any,
    warehouseId: string,
    productType: string,
  ): Promise<string | null> {
    const latest = await tx
      .select()
      .from(warehouseTransactions)
      .where(
        and(
          eq(warehouseTransactions.warehouseId, warehouseId),
          eq(warehouseTransactions.productType, productType),
          isNull(warehouseTransactions.deletedAt),
        ),
      )
      .orderBy(
        desc(
          sql`COALESCE(${warehouseTransactions.transactionDate}, ${warehouseTransactions.createdAt})`,
        ),
        desc(warehouseTransactions.id),
      )
      .limit(1);

    if (latest.length > 0) {
      return latest[0].transactionDate || latest[0].createdAt;
    }
    return null;
  }

  private static async needsRecalculation(
    tx: any,
    warehouseId: string,
    productType: string,
    dealDate?: string,
  ): Promise<boolean> {
    if (!dealDate) return false;

    const latestDate = await this.getLatestTransactionDate(
      tx,
      warehouseId,
      productType,
    );
    if (!latestDate) return false;

    return new Date(dealDate) < new Date(latestDate);
  }

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

    if (isReceipt) {
      newBalance = currentBalance + quantity;
      const totalCurrentCost = currentBalance * currentCost;
      newAverageCost =
        newBalance > 0 ? (totalCurrentCost + totalCost) / newBalance : 0;
    } else {
      newBalance = Math.max(0, currentBalance - quantity);
      newAverageCost = currentCost;
    }

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

    if (totalCost === 0) {
      sum = quantity * currentCost;
      price = currentCost;
    } else {
      sum = totalCost;
      price = quantity > 0 ? totalCost / quantity : 0;
    }

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

    const needsRecalc = await this.needsRecalculation(
      tx,
      warehouseId,
      productType,
      dealDate,
    );
    if (needsRecalc && dealDate) {
      console.log(
        `[WarehouseTransactionService] Backdated transaction detected, queuing recalculation for ${warehouseId}`,
      );
      await RecalculationQueueService.addToQueue(
        warehouseId,
        productType,
        dealDate,
        createdById,
        1,
      );
    }

    return { transaction, newAverageCost, newBalance };
  }

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
      balanceBeforeOldOperation = currentBalance - oldQuantity;
      totalCostBeforeOldOperation = currentBalance * currentCost - oldTotalCost;

      newBalance = balanceBeforeOldOperation + newQuantity;
      newTotalCostInWarehouse = totalCostBeforeOldOperation + newTotalCost;
      newAverageCost =
        newBalance > 0 ? newTotalCostInWarehouse / newBalance : 0;
    } else {
      balanceBeforeOldOperation = currentBalance + oldQuantity;
      totalCostBeforeOldOperation = balanceBeforeOldOperation * currentCost;

      newBalance = Math.max(0, balanceBeforeOldOperation - newQuantity);
      newTotalCostInWarehouse = totalCostBeforeOldOperation;
      newAverageCost = currentCost;
    }

    if (newTotalCost === 0) {
      sum = newQuantity * currentCost;
      price = currentCost;
    } else {
      sum = newTotalCost;
      price = newQuantity > 0 ? newTotalCost / newQuantity : 0;
    }

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

    const oldTxDate = transaction.transactionDate || transaction.createdAt;
    const effectiveDate =
      dealDate && new Date(dealDate) < new Date(oldTxDate)
        ? dealDate
        : oldTxDate;

    const needsRecalc = await this.needsRecalculation(
      tx,
      warehouseId,
      productType,
      effectiveDate,
    );
    if (needsRecalc) {
      console.log(
        `[WarehouseTransactionService] Transaction update requires recalculation for ${warehouseId}`,
      );
      await RecalculationQueueService.addToQueue(
        warehouseId,
        productType,
        effectiveDate,
        updatedById,
        1,
      );
    }

    return { newAverageCost, newBalance };
  }

  static async deleteTransactionAndRevertWarehouse(
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

    const newBalance = Math.max(0, currentBalance - quantity);
    let newAverageCost = currentCost;

    if (transaction.averageCostBefore !== transaction.averageCostAfter) {
      const totalCostBeforeRemoval = currentBalance * currentCost;
      const newTotalCost = Math.max(0, totalCostBeforeRemoval - totalCost);
      newAverageCost = newBalance > 0 ? newTotalCost / newBalance : 0;
    }

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

    await tx
      .update(warehouseTransactions)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: updatedById,
      })
      .where(eq(warehouseTransactions.id, transactionId));

    const txDate = transaction.transactionDate || transaction.createdAt;
    const needsRecalc = await this.needsRecalculation(
      tx,
      transaction.warehouseId,
      transaction.productType || "kerosene",
      txDate,
    );

    if (needsRecalc) {
      console.log(
        `[WarehouseTransactionService] Transaction deletion requires recalculation for ${transaction.warehouseId}`,
      );
      await RecalculationQueueService.addToQueue(
        transaction.warehouseId,
        transaction.productType || "kerosene",
        txDate,
        updatedById,
        1,
      );
    }

    return { newAverageCost, newBalance };
  }

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
      const totalCostBeforeRemoval = currentBalance * currentCost;
      const newTotalCost = Math.max(0, totalCostBeforeRemoval + totalCost);
      newAverageCost = newBalance > 0 ? newTotalCost / newBalance : 0;
    }

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

    await tx
      .update(warehouseTransactions)
      .set({
        deletedAt: null,
        deletedById: null,
      })
      .where(eq(warehouseTransactions.id, transactionId));

    const txDate = transaction.transactionDate || transaction.createdAt;
    const needsRecalc = await this.needsRecalculation(
      tx,
      transaction.warehouseId,
      transaction.productType || "kerosene",
      txDate,
    );

    if (needsRecalc) {
      console.log(
        `[WarehouseTransactionService] Transaction restore requires recalculation for ${transaction.warehouseId}`,
      );
      await RecalculationQueueService.addToQueue(
        transaction.warehouseId,
        transaction.productType || "kerosene",
        txDate,
        updatedById,
        1,
      );
    }

    return { newAverageCost, newBalance };
  }
}
