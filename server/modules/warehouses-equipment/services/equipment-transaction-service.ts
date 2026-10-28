import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { equipments, equipmentTransactions } from "../entities/equipment";
import { TRANSACTION_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { EquipmentRecalculationQueueService } from "./equipment-recalculation-queue-service";
import { format } from "date-fns";
import { restoreStockMovement } from "server/modules/warehouses/services/stock-transaction-calculations";
import {
  kilogramsToTonnes,
  pricePerKilogramToPerTonne,
  pricePerTonneToPerKilogram,
  tonnesToKilograms,
} from "@shared/units";
import {
  massMirrorFields,
  readMassTonnes,
} from "../equipment-balance-units";

type TonneEquipmentState = {
  balanceTonnes: number;
  averageCostPerTonne: number;
};

// Equipment tables and their existing callers still use kg until the database
// cutover; calculations in this service use tonnes and ₽/t.
function readTonneEquipmentState(
  equipment: typeof equipments.$inferSelect,
  isPvkj: boolean,
): TonneEquipmentState {
  const balanceTonnes = readMassTonnes(
    isPvkj ? equipment.pvkjBalanceTonnes : equipment.currentBalanceTonnes,
    isPvkj ? equipment.pvkjBalance : equipment.currentBalance,
  );
  const averageCostPerKg = Number.parseFloat(
    (isPvkj ? equipment.pvkjAverageCost : equipment.averageCost) || "0",
  );
  return {
    balanceTonnes,
    averageCostPerTonne: pricePerKilogramToPerTonne(averageCostPerKg),
  };
}

function legacyKg(valueTonnes: number): string {
  return tonnesToKilograms(valueTonnes).toFixed(2);
}

function legacyPricePerKg(valuePerTonne: number): string {
  return pricePerTonneToPerKilogram(valuePerTonne).toFixed(4);
}

function equipmentStockFields(
  isPvkj: boolean,
  state: TonneEquipmentState,
) {
  const balance = massMirrorFields(state.balanceTonnes);
  return isPvkj
    ? {
        pvkjBalanceTonnes: balance.tonnes,
        pvkjBalance: balance.kilograms,
        pvkjAverageCost: legacyPricePerKg(state.averageCostPerTonne),
      }
    : {
        currentBalanceTonnes: balance.tonnes,
        currentBalance: balance.kilograms,
        averageCost: legacyPricePerKg(state.averageCostPerTonne),
      };
}

export class EquipmentTransactionService {
  private static async getLatestTransactionDate(
    tx: any,
    equipmentId: string,
    productType: string,
  ): Promise<string | null> {
    const latest = await tx
      .select()
      .from(equipmentTransactions)
      .where(
        and(
          eq(equipmentTransactions.equipmentId, equipmentId),
          eq(equipmentTransactions.productType, productType),
          isNull(equipmentTransactions.deletedAt),
        ),
      )
      .orderBy(
        desc(
          sql`COALESCE(${equipmentTransactions.transactionDate}, ${equipmentTransactions.createdAt})`,
        ),
        desc(equipmentTransactions.id),
      )
      .limit(1);

    if (latest.length > 0) {
      return latest[0].transactionDate || latest[0].createdAt;
    }
    return null;
  }

  private static async needsRecalculation(
    tx: any,
    equipmentId: string,
    productType: string,
    dealDate?: string,
  ): Promise<boolean> {
    if (!dealDate) return false;
    const latestDate = await this.getLatestTransactionDate(
      tx,
      equipmentId,
      productType,
    );
    if (!latestDate) return false;
    return new Date(dealDate) < new Date(latestDate);
  }

  static async createTransactionAndUpdateEquipment(
    tx: any,
    equipmentId: string,
    transactionType: string,
    productType: string,
    sourceType: string,
    sourceId: string,
    quantity: number,
    totalCost: number,
    createdById?: string,
    dealDate?: string,
  ) {
    const [equipment] = await tx
      .select()
      .from(equipments)
      .where(eq(equipments.id, equipmentId))
      .for("update");

    if (!equipment) throw new Error("Оборудование не найдено");

    const isPvkj = productType === PRODUCT_TYPE.PVKJ;
    const quantityTonnes = kilogramsToTonnes(quantity);
    const oldState = readTonneEquipmentState(equipment, isPvkj);
    const oldBalance = oldState.balanceTonnes;
    const oldAvgCost = oldState.averageCostPerTonne;

    let newBalance = oldBalance;
    let newAvgCost = oldAvgCost;
    let sum: number;
    let price: number;

    const isReceipt =
      transactionType === TRANSACTION_TYPE.RECEIPT ||
      transactionType === TRANSACTION_TYPE.TRANSFER_IN;

    if (isReceipt) {
      newBalance = oldBalance + quantityTonnes;
      if (newBalance > 0) {
        newAvgCost = (oldBalance * oldAvgCost + totalCost) / newBalance;
      }
      sum = totalCost;
      price = quantityTonnes > 0 ? totalCost / quantityTonnes : 0;
    } else {
      newBalance = Math.max(0, oldBalance - quantityTonnes);
      // При расходе средняя цена не меняется
      sum = quantityTonnes * oldAvgCost;
      price = oldAvgCost;
    }

    const needsRecalc = await this.needsRecalculation(
      tx,
      equipmentId,
      productType,
      dealDate,
    );
    const txDate =
      needsRecalc && dealDate
        ? format(
            new Date(dealDate).setHours(23, 59, 0, 0),
            "yyyy-MM-dd'T'HH:mm:ss",
          )
        : dealDate;

    const [transaction] = await tx
      .insert(equipmentTransactions)
      .values({
        equipmentId,
        transactionType,
        productType,
        sourceType,
        sourceId,
        quantity: isReceipt
          ? legacyKg(quantityTonnes)
          : legacyKg(-quantityTonnes),
        quantityTonnes: (isReceipt ? quantityTonnes : -quantityTonnes).toFixed(5),
        sum: sum.toFixed(2),
        price: legacyPricePerKg(price),
        balanceBefore: legacyKg(oldBalance),
        balanceAfter: legacyKg(newBalance),
        balanceBeforeTonnes: oldBalance.toFixed(5),
        balanceAfterTonnes: newBalance.toFixed(5),
        averageCostBefore: legacyPricePerKg(oldAvgCost),
        averageCostAfter: legacyPricePerKg(newAvgCost),
        transactionDate: txDate,
        createdById,
      })
      .returning();

    const updateData: any = {
      updatedAt: sql`NOW()`,
      updatedById: createdById,
    };
    Object.assign(
      updateData,
      equipmentStockFields(isPvkj, {
        balanceTonnes: newBalance,
        averageCostPerTonne: newAvgCost,
      }),
    );
    await tx
      .update(equipments)
      .set(updateData)
      .where(eq(equipments.id, equipmentId));

    if (needsRecalc && txDate) {
      console.log(
        `[EquipmentTransactionService] Backdated transaction detected, queuing recalculation for equipment ${equipmentId}`,
      );
      await EquipmentRecalculationQueueService.addToQueue(
        equipmentId,
        productType,
        txDate,
        createdById,
        1,
        tx,
      );
    }

    return transaction;
  }

  static async updateTransactionAndRecalculateEquipment(
    tx: any,
    transactionId: string,
    equipmentId: string,
    oldQty: number,
    oldTotalCost: number,
    newQty: number,
    newTotalCost: number,
    productType: string,
    userId?: string,
    dealDate?: string,
  ) {
    const [transaction] = await tx
      .select()
      .from(equipmentTransactions)
      .where(eq(equipmentTransactions.id, transactionId));

    if (!transaction) throw new Error(`Transaction ${transactionId} not found`);

    const [equipment] = await tx
      .select()
      .from(equipments)
      .where(eq(equipments.id, equipmentId))
      .for("update");

    if (!equipment) throw new Error("Оборудование не найдено");

    const isPvkj = productType === PRODUCT_TYPE.PVKJ;
    const isReceipt =
      transaction.transactionType === TRANSACTION_TYPE.RECEIPT ||
      transaction.transactionType === TRANSACTION_TYPE.TRANSFER_IN;

    const oldQtyTonnes = kilogramsToTonnes(oldQty);
    const newQtyTonnes = kilogramsToTonnes(newQty);
    const currentState = readTonneEquipmentState(equipment, isPvkj);
    const currentBalance = currentState.balanceTonnes;
    const currentCost = currentState.averageCostPerTonne;

    let newBalance: number;
    let newAverageCost: number;
    let sum: number;
    let price: number;

    if (isReceipt) {
      const balanceBeforeOld = currentBalance - oldQtyTonnes;
      const totalCostBeforeOld = currentBalance * currentCost - oldTotalCost;
      newBalance = balanceBeforeOld + newQtyTonnes;
      const newTotalCostInEq = totalCostBeforeOld + newTotalCost;
      newAverageCost = newBalance > 0 ? newTotalCostInEq / newBalance : 0;
      sum = newTotalCost;
      price = newQtyTonnes > 0 ? newTotalCost / newQtyTonnes : 0;
    } else {
      const balanceBeforeOld = currentBalance + oldQtyTonnes;
      newBalance = Math.max(0, balanceBeforeOld - newQtyTonnes);
      newAverageCost = currentCost;
      sum = newQtyTonnes * currentCost;
      price = currentCost;
    }

    const oldTxDate = transaction.transactionDate || transaction.createdAt;

    // Always move transaction date to new deal date (both forward and backward).
    const newEffectiveDate = dealDate
      ? format(new Date(dealDate).setHours(23, 59, 0, 0), "yyyy-MM-dd'T'HH:mm:ss")
      : oldTxDate;

    // Recalculate from the EARLIER of old and new dates
    const recalcStartDate =
      new Date(newEffectiveDate) <= new Date(oldTxDate) ? newEffectiveDate : oldTxDate;

    await tx
      .update(equipmentTransactions)
      .set({
        quantity: isReceipt
          ? legacyKg(newQtyTonnes)
          : legacyKg(-newQtyTonnes),
        quantityTonnes: (isReceipt ? newQtyTonnes : -newQtyTonnes).toFixed(5),
        sum: sum.toFixed(2),
        price: legacyPricePerKg(price),
        balanceAfter: legacyKg(newBalance),
        balanceAfterTonnes: newBalance.toFixed(5),
        averageCostAfter: legacyPricePerKg(newAverageCost),
        updatedAt: sql`NOW()`,
        updatedById: userId,
        transactionDate: newEffectiveDate,
      })
      .where(eq(equipmentTransactions.id, transactionId));

    const updateData: any = {
      updatedAt: sql`NOW()`,
      updatedById: userId,
    };
    Object.assign(
      updateData,
      equipmentStockFields(isPvkj, {
        balanceTonnes: newBalance,
        averageCostPerTonne: newAverageCost,
      }),
    );
    await tx
      .update(equipments)
      .set(updateData)
      .where(eq(equipments.id, equipmentId));

    const needsRecalc = await this.needsRecalculation(
      tx,
      equipmentId,
      productType,
      recalcStartDate,
    );
    if (needsRecalc) {
      console.log(
        `[EquipmentTransactionService] Transaction update requires recalculation for equipment ${equipmentId} from ${recalcStartDate}`,
      );
      await EquipmentRecalculationQueueService.addToQueue(
        equipmentId,
        productType,
        recalcStartDate,
        userId,
        1,
        tx,
      );
    }

    return tonnesToKilograms(newBalance);
  }

  /**
   * Updates only the transaction date when a deal's date changes without a quantity change.
   * Enqueues recalculation from the earlier of old and new dates so both days are corrected.
   */
  static async updateTransactionDateAndRecalculate(
    tx: any,
    transactionId: string,
    equipmentId: string,
    productType: string,
    oldDealDate: string,
    newDealDate: string,
    userId?: string,
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
      return;
    }

    await tx
      .update(equipmentTransactions)
      .set({
        transactionDate: newNormalized,
        updatedAt: sql`NOW()`,
        updatedById: userId,
      })
      .where(eq(equipmentTransactions.id, transactionId));

    const recalcStartDate =
      new Date(newNormalized) <= new Date(oldNormalized) ? newNormalized : oldNormalized;

    console.log(
      `[EquipmentTransactionService] Date-only change: tx ${transactionId} moved from ${oldNormalized} to ${newNormalized}, recalc from ${recalcStartDate}`,
    );

    await EquipmentRecalculationQueueService.addToQueue(
      equipmentId,
      productType,
      recalcStartDate,
      userId,
      1,
      tx,
    );
  }

  static async deleteTransactionAndRevertEquipment(
    tx: any,
    transactionId: string,
    userId?: string,
  ) {
    const [transaction] = await tx
      .select()
      .from(equipmentTransactions)
      .where(eq(equipmentTransactions.id, transactionId))
      .for("update");

    if (!transaction) return;

    const [equipment] = await tx
      .select()
      .from(equipments)
      .where(eq(equipments.id, transaction.equipmentId))
      .for("update");

    if (!equipment) throw new Error("Оборудование не найдено");

    const isPvkj = transaction.productType === PRODUCT_TYPE.PVKJ;
    const qtyTonnes = Math.abs(
      readMassTonnes(transaction.quantityTonnes, transaction.quantity),
    );
    const isReceipt =
      transaction.transactionType === TRANSACTION_TYPE.RECEIPT ||
      transaction.transactionType === TRANSACTION_TYPE.TRANSFER_IN;

    const currentState = readTonneEquipmentState(equipment, isPvkj);
    let newBalance = currentState.balanceTonnes;
    let newAvgCost = currentState.averageCostPerTonne;

    if (isReceipt) {
      newBalance = Math.max(0, newBalance - qtyTonnes);
      if (newBalance > 0) {
        newAvgCost = pricePerKilogramToPerTonne(
          parseFloat(transaction.averageCostBefore || "0"),
        );
      }
    } else {
      newBalance += qtyTonnes;
    }

    const updateData: any = {
      updatedAt: sql`NOW()`,
      updatedById: userId,
    };
    Object.assign(
      updateData,
      equipmentStockFields(isPvkj, {
        balanceTonnes: newBalance,
        averageCostPerTonne: newAvgCost,
      }),
    );
    await tx
      .update(equipments)
      .set(updateData)
      .where(eq(equipments.id, equipment.id));

    await tx
      .update(equipmentTransactions)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(equipmentTransactions.id, transactionId));

    const txDate = transaction.transactionDate || transaction.createdAt;
    const needsRecalc = await this.needsRecalculation(
      tx,
      transaction.equipmentId,
      transaction.productType || "kerosene",
      txDate,
    );
    if (needsRecalc) {
      console.log(
        `[EquipmentTransactionService] Transaction deletion requires recalculation for equipment ${transaction.equipmentId}`,
      );
      await EquipmentRecalculationQueueService.addToQueue(
        transaction.equipmentId,
        transaction.productType || "kerosene",
        txDate,
        userId,
        1,
        tx,
      );
    }
  }

  static async restoreTransactionAndRecalculateEquipment(
    tx: any,
    transactionId: string,
    userId?: string,
  ) {
    const [transaction] = await tx
      .select()
      .from(equipmentTransactions)
      .where(eq(equipmentTransactions.id, transactionId));

    if (!transaction) return;

    const [equipment] = await tx
      .select()
      .from(equipments)
      .where(eq(equipments.id, transaction.equipmentId))
      .for("update");

    if (!equipment) throw new Error("Оборудование не найдено");

    const isPvkj = transaction.productType === PRODUCT_TYPE.PVKJ;
    const currentState = readTonneEquipmentState(equipment, isPvkj);
    const currentBalance = currentState.balanceTonnes;
    const currentCost = currentState.averageCostPerTonne;

    const { balance: newBalance, averageCost: newAvgCost } =
      restoreStockMovement(
        { balance: currentBalance, averageCost: currentCost },
        {
          ...transaction,
          quantity: readMassTonnes(
            transaction.quantityTonnes,
            transaction.quantity,
          ),
        },
        transaction.transactionType === TRANSACTION_TYPE.RECEIPT ||
          transaction.transactionType === TRANSACTION_TYPE.TRANSFER_IN,
      );

    const updateData: any = {
      updatedAt: sql`NOW()`,
      updatedById: userId,
    };
    Object.assign(
      updateData,
      equipmentStockFields(isPvkj, {
        balanceTonnes: newBalance,
        averageCostPerTonne: newAvgCost,
      }),
    );
    await tx
      .update(equipments)
      .set(updateData)
      .where(eq(equipments.id, equipment.id));

    await tx
      .update(equipmentTransactions)
      .set({
        deletedAt: null,
        deletedById: null,
      })
      .where(eq(equipmentTransactions.id, transactionId));

    const txDate = transaction.transactionDate || transaction.createdAt;
    const needsRecalc = await this.needsRecalculation(
      tx,
      transaction.equipmentId,
      transaction.productType || "kerosene",
      txDate,
    );
    if (needsRecalc) {
      console.log(
        `[EquipmentTransactionService] Transaction restore requires recalculation for equipment ${transaction.equipmentId}`,
      );
      await EquipmentRecalculationQueueService.addToQueue(
        transaction.equipmentId,
        transaction.productType || "kerosene",
        txDate,
        userId,
        1,
        tx,
      );
    }
  }
}
