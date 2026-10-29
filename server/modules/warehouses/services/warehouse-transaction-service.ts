import { eq, and, gt, sql, isNull, desc, asc } from "drizzle-orm";
import { warehouses, warehouseTransactions } from "@shared/schema";
import { PRODUCT_TYPE, TRANSACTION_TYPE } from "@shared/constants";
import { RecalculationQueueService } from "./recalculation-queue-service";
import { format } from "date-fns";
import { restoreStockMovement } from "./stock-transaction-calculations";
import {
  kilogramsToTonnes,
  pricePerKilogramToPerTonne,
  pricePerTonneToPerKilogram,
  tonnesToKilograms,
} from "@shared/units";

type TonneStockState = {
  balanceTonnes: number;
  averageCostPerTonne: number;
};

// The database and older callers still use kg for this transition stage.
// Convert at the boundary so stock calculations themselves use tonnes and ₽/t.
function readTonneStockState(
  warehouse: typeof warehouses.$inferSelect,
  isPvkj: boolean,
): TonneStockState {
  const balanceKg = Number.parseFloat(
    (isPvkj ? warehouse.pvkjBalance : warehouse.currentBalance) || "0",
  );
  const storedBalanceTonnes = isPvkj
    ? warehouse.pvkjBalanceTonnes
    : warehouse.currentBalanceTonnes;
  const averageCostPerKg = Number.parseFloat(
    (isPvkj ? warehouse.pvkjAverageCost : warehouse.averageCost) || "0",
  );
  const storedAverageCostPerTonne = isPvkj
    ? warehouse.pvkjAverageCostPerTonne
    : warehouse.averageCostPerTonne;
  return {
    balanceTonnes:
      storedBalanceTonnes == null
        ? kilogramsToTonnes(balanceKg)
        : Number.parseFloat(storedBalanceTonnes),
    averageCostPerTonne:
      storedAverageCostPerTonne == null
        ? pricePerKilogramToPerTonne(averageCostPerKg)
        : Number.parseFloat(storedAverageCostPerTonne),
  };
}

function legacyKg(valueTonnes: number): string {
  return tonnesToKilograms(valueTonnes).toFixed(2);
}

function legacyPricePerKg(valuePerTonne: number): string {
  return pricePerTonneToPerKilogram(valuePerTonne).toFixed(6);
}

function transactionRatePerTonne(
  perTonne: string | null,
  perKilogram: string | null,
): number {
  return perTonne == null
    ? pricePerKilogramToPerTonne(Number.parseFloat(perKilogram || "0"))
    : Number.parseFloat(perTonne);
}

async function writeLegacyStockState(
  tx: any,
  warehouseId: string,
  isPvkj: boolean,
  state: TonneStockState,
  updatedById?: string,
) {
  const balance = legacyKg(state.balanceTonnes);
  const balanceTonnes = state.balanceTonnes.toFixed(5);
  const averageCost = legacyPricePerKg(state.averageCostPerTonne);
  await tx
    .update(warehouses)
    .set(
      isPvkj
        ? {
            pvkjBalance: balance,
            pvkjBalanceTonnes: balanceTonnes,
            pvkjAverageCost: averageCost,
            pvkjAverageCostPerTonne: state.averageCostPerTonne.toFixed(6),
            updatedAt: sql`NOW()`,
            updatedById,
          }
        : {
            currentBalance: balance,
            currentBalanceTonnes: balanceTonnes,
            averageCost,
            averageCostPerTonne: state.averageCostPerTonne.toFixed(6),
            updatedAt: sql`NOW()`,
            updatedById,
          },
    )
    .where(eq(warehouses.id, warehouseId));
}

export class WarehouseTransactionService {
  private static async getLatestTransactionDate(
    tx: any,
    warehouseId: string,
    productType: string
  ): Promise<string | null> {
    const latest = await tx
      .select()
      .from(warehouseTransactions)
      .where(
        and(
          eq(warehouseTransactions.warehouseId, warehouseId),
          eq(warehouseTransactions.productType, productType),
          isNull(warehouseTransactions.deletedAt)
        )
      )
      .orderBy(
        desc(sql`COALESCE(${warehouseTransactions.transactionDate}, ${warehouseTransactions.createdAt})`),
        desc(warehouseTransactions.id)
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
    dealDate?: string
  ): Promise<boolean> {
    if (!dealDate) return false;
    
    const latestDate = await this.getLatestTransactionDate(tx, warehouseId, productType);
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

    const quantityTonnes = kilogramsToTonnes(quantity);
    const currentStock = readTonneStockState(warehouse, isPvkj);
    const currentBalance = currentStock.balanceTonnes;
    const currentCost = currentStock.averageCostPerTonne;
    let newBalance: number;
    let newAverageCost: number;
    let sum: number;
    let price: number;

    const isReceipt =
      transactionType === TRANSACTION_TYPE.RECEIPT ||
      transactionType === TRANSACTION_TYPE.TRANSFER_IN;

    if (isReceipt) {
      newBalance = currentBalance + quantityTonnes;
      const totalCurrentCost = currentBalance * currentCost;
      newAverageCost =
        newBalance > 0 ? (totalCurrentCost + totalCost) / newBalance : 0;
    } else {
      newBalance = Math.max(0, currentBalance - quantityTonnes);
      newAverageCost = currentCost;
    }

    await writeLegacyStockState(
      tx,
      warehouseId,
      isPvkj,
      { balanceTonnes: newBalance, averageCostPerTonne: newAverageCost },
      createdById,
    );

    if (totalCost === 0) {
      sum = quantityTonnes * currentCost;
      price = currentCost;
    } else {
      sum = totalCost;
      price = quantityTonnes > 0 ? totalCost / quantityTonnes : 0;
    }

    const needsRecalc = await this.needsRecalculation(tx, warehouseId, productType, dealDate);
    const txDate = needsRecalc && dealDate ?
      format(new Date(dealDate).setHours(23, 59, 0, 0), "yyyy-MM-dd'T'HH:mm:ss") :
      dealDate

    const [transaction] = await tx
      .insert(warehouseTransactions)
      .values({
        warehouseId,
        transactionType,
        productType,
        sourceType,
        sourceId,
        quantity: isReceipt
          ? legacyKg(quantityTonnes)
          : legacyKg(-quantityTonnes),
        quantityTonnes: (isReceipt ? quantityTonnes : -quantityTonnes).toFixed(5),
        sum: sum.toString(),
        price: legacyPricePerKg(price),
        balanceBefore: legacyKg(currentBalance),
        balanceAfter: legacyKg(newBalance),
        balanceBeforeTonnes: currentBalance.toFixed(5),
        balanceAfterTonnes: newBalance.toFixed(5),
        averageCostBefore: legacyPricePerKg(currentCost),
        averageCostBeforePerTonne: currentCost.toFixed(6),
        averageCostAfter: legacyPricePerKg(newAverageCost),
        averageCostAfterPerTonne: newAverageCost.toFixed(6),
        pricePerTonne: price.toFixed(6),
        createdById,
        transactionDate: txDate,
      })
      .returning();

    if (needsRecalc && txDate) {
      console.log(`[WarehouseTransactionService] Backdated transaction detected, queuing recalculation for ${warehouseId}`);
      await RecalculationQueueService.addToQueue(
        warehouseId,
        productType,
        txDate,
        createdById,
        1,
        tx,
      );
    }

    return {
      transaction,
      newAverageCost: pricePerTonneToPerKilogram(newAverageCost),
      newBalance: tonnesToKilograms(newBalance),
    };
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

    const oldQuantityTonnes = kilogramsToTonnes(oldQuantity);
    const newQuantityTonnes = kilogramsToTonnes(newQuantity);
    const currentStock = readTonneStockState(warehouse, isPvkj);
    const currentBalance = currentStock.balanceTonnes;
    const currentCost = currentStock.averageCostPerTonne;

    let balanceBeforeOldOperation: number;
    let totalCostBeforeOldOperation: number;
    let newBalance: number;
    let newTotalCostInWarehouse: number;
    let newAverageCost: number;
    let sum: number;
    let price: number;

    if (isReceipt) {
      balanceBeforeOldOperation = currentBalance - oldQuantityTonnes;
      totalCostBeforeOldOperation = currentBalance * currentCost - oldTotalCost;

      newBalance = balanceBeforeOldOperation + newQuantityTonnes;
      newTotalCostInWarehouse = totalCostBeforeOldOperation + newTotalCost;
      newAverageCost =
        newBalance > 0 ? newTotalCostInWarehouse / newBalance : 0;
    } else {
      balanceBeforeOldOperation = currentBalance + oldQuantityTonnes;
      totalCostBeforeOldOperation = balanceBeforeOldOperation * currentCost;

      newBalance = Math.max(0, balanceBeforeOldOperation - newQuantityTonnes);
      newTotalCostInWarehouse = totalCostBeforeOldOperation;
      newAverageCost = currentCost;
    }

    if (newTotalCost === 0) {
      sum = newQuantityTonnes * currentCost;
      price = currentCost;
    } else {
      sum = newTotalCost;
      price = newQuantityTonnes > 0 ? newTotalCost / newQuantityTonnes : 0;
    }

    await writeLegacyStockState(
      tx,
      warehouseId,
      isPvkj,
      { balanceTonnes: newBalance, averageCostPerTonne: newAverageCost },
      updatedById,
    );

    const oldTxDate = transaction.transactionDate || transaction.createdAt;

    // Always move transaction date to the new deal date (both forward and backward).
    // Previously only backward moves were applied; forward moves left the transaction
    // on the old date causing warehouse history desync.
    const newEffectiveDate = dealDate
      ? format(new Date(dealDate).setHours(23, 59, 0, 0), "yyyy-MM-dd'T'HH:mm:ss")
      : oldTxDate;

    // Recalculation must start from the EARLIER of old and new dates so that
    // both the day the transaction left and the day it moved to are recalculated.
    const recalcStartDate =
      new Date(newEffectiveDate) <= new Date(oldTxDate) ? newEffectiveDate : oldTxDate;

    const needsRecalc = await this.needsRecalculation(tx, warehouseId, productType, recalcStartDate);
    
    await tx
      .update(warehouseTransactions)
      .set({
        quantity: isReceipt
          ? legacyKg(newQuantityTonnes)
          : legacyKg(-newQuantityTonnes),
        quantityTonnes: (isReceipt ? newQuantityTonnes : -newQuantityTonnes).toFixed(5),
        sum: sum.toString(),
        price: legacyPricePerKg(price),
        pricePerTonne: price.toFixed(6),
        balanceAfter: legacyKg(newBalance),
        balanceAfterTonnes: newBalance.toFixed(5),
        averageCostAfter: legacyPricePerKg(newAverageCost),
        averageCostAfterPerTonne: newAverageCost.toFixed(6),
        updatedAt: sql`NOW()`,
        updatedById,
        transactionDate: newEffectiveDate,
      })
      .where(eq(warehouseTransactions.id, transactionId));

    if (needsRecalc) {
      console.log(`[WarehouseTransactionService] Transaction update requires recalculation for ${warehouseId} from ${recalcStartDate}`);
      await RecalculationQueueService.addToQueue(
        warehouseId,
        productType,
        recalcStartDate,
        updatedById,
        1,
        tx,
      );
    }

    return {
      newAverageCost: pricePerTonneToPerKilogram(newAverageCost),
      newBalance: tonnesToKilograms(newBalance),
    };
  }

  /**
   * Updates only the transaction date when a deal's date changes without a quantity change.
   * Enqueues recalculation from the earlier of old and new dates so both days are corrected.
   */
  static async updateTransactionDateAndRecalculate(
    tx: any,
    transactionId: string,
    warehouseId: string,
    productType: string,
    oldDealDate: string,
    newDealDate: string,
    updatedById?: string,
  ) {
    const oldNormalized = format(
      new Date(oldDealDate).setHours(23, 59, 0, 0),
      "yyyy-MM-dd'T'HH:mm:ss",
    );
    const newNormalized = format(
      new Date(newDealDate).setHours(23, 59, 0, 0),
      "yyyy-MM-dd'T'HH:mm:ss",
    );

    if (oldNormalized === newNormalized) {
      // Dates resolve to the same end-of-day timestamp — nothing to do
      return;
    }

    await tx
      .update(warehouseTransactions)
      .set({
        transactionDate: newNormalized,
        updatedAt: sql`NOW()`,
        updatedById,
      })
      .where(eq(warehouseTransactions.id, transactionId));

    // Always recalculate from the earlier of old and new dates
    const recalcStartDate =
      new Date(newNormalized) <= new Date(oldNormalized) ? newNormalized : oldNormalized;

    console.log(
      `[WarehouseTransactionService] Date-only change: tx ${transactionId} moved from ${oldNormalized} to ${newNormalized}, recalc from ${recalcStartDate}`,
    );

    await RecalculationQueueService.addToQueue(
      warehouseId,
      productType,
      recalcStartDate,
      updatedById,
      1,
      tx,
    );
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

    const quantityTonnes =
      transaction.quantityTonnes == null
        ? kilogramsToTonnes(Number.parseFloat(transaction.quantity))
        : Number.parseFloat(transaction.quantityTonnes);
    const totalCost = parseFloat(transaction.sum || "0");
    const currentStock = readTonneStockState(warehouse, isPvkj);
    const currentBalance = currentStock.balanceTonnes;
    const currentCost = currentStock.averageCostPerTonne;
    const newBalance = Math.max(0, currentBalance - quantityTonnes);
    let newAverageCost = currentCost;

    const averageCostBeforePerTonne = transactionRatePerTonne(
      transaction.averageCostBeforePerTonne,
      transaction.averageCostBefore,
    );
    const averageCostAfterPerTonne = transactionRatePerTonne(
      transaction.averageCostAfterPerTonne,
      transaction.averageCostAfter,
    );
    if (averageCostBeforePerTonne !== averageCostAfterPerTonne) {
      const totalCostBeforeRemoval = currentBalance * currentCost;
      const newTotalCost = Math.max(0, totalCostBeforeRemoval - totalCost);
      newAverageCost = newBalance > 0 ? newTotalCost / newBalance : 0;
    }

    await writeLegacyStockState(
      tx,
      transaction.warehouseId,
      isPvkj,
      { balanceTonnes: newBalance, averageCostPerTonne: newAverageCost },
      updatedById,
    );

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
      txDate
    );
    
    if (needsRecalc) {
      console.log(`[WarehouseTransactionService] Transaction deletion requires recalculation for ${transaction.warehouseId}`);
      await RecalculationQueueService.addToQueue(
        transaction.warehouseId,
        transaction.productType || "kerosene",
        txDate,
        updatedById,
        1,
        tx,
      );
    }

    return {
      newAverageCost: pricePerTonneToPerKilogram(newAverageCost),
      newBalance: tonnesToKilograms(newBalance),
    };
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

    const quantityTonnes =
      transaction.quantityTonnes == null
        ? kilogramsToTonnes(Number.parseFloat(transaction.quantity))
        : Number.parseFloat(transaction.quantityTonnes);
    const totalCost = parseFloat(transaction.sum || "0");
    const currentStock = readTonneStockState(warehouse, isPvkj);
    const currentBalance = currentStock.balanceTonnes;
    const currentCost = currentStock.averageCostPerTonne;

    const { balance: newBalance, averageCost: newAverageCost } =
      restoreStockMovement(
        { balance: currentBalance, averageCost: currentCost },
        {
          ...transaction,
          quantity: quantityTonnes,
        },
      );

    await writeLegacyStockState(
      tx,
      transaction.warehouseId,
      isPvkj,
      { balanceTonnes: newBalance, averageCostPerTonne: newAverageCost },
      updatedById,
    );

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
      txDate
    );
    
    if (needsRecalc) {
      console.log(`[WarehouseTransactionService] Transaction restore requires recalculation for ${transaction.warehouseId}`);
      await RecalculationQueueService.addToQueue(
        transaction.warehouseId,
        transaction.productType || "kerosene",
        txDate,
        updatedById,
        1,
        tx,
      );
    }

    return {
      newAverageCost: pricePerTonneToPerKilogram(newAverageCost),
      newBalance: tonnesToKilograms(newBalance),
    };
  }
}
