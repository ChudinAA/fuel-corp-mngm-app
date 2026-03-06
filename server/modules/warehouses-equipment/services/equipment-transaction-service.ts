import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { equipments, equipmentTransactions } from "../entities/equipment";
import { TRANSACTION_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { EquipmentRecalculationQueueService } from "./equipment-recalculation-queue-service";
import { format } from "date-fns";

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
    const oldBalance = parseFloat(
      (isPvkj ? equipment.pvkjBalance : equipment.currentBalance) || "0",
    );
    const oldAvgCost = parseFloat(
      (isPvkj ? equipment.pvkjAverageCost : equipment.averageCost) || "0",
    );

    let newBalance = oldBalance;
    let newAvgCost = oldAvgCost;
    let sum: number;
    let price: number;

    const isReceipt =
      transactionType === TRANSACTION_TYPE.RECEIPT ||
      transactionType === TRANSACTION_TYPE.TRANSFER_IN;

    if (isReceipt) {
      newBalance = oldBalance + quantity;
      if (newBalance > 0) {
        newAvgCost = (oldBalance * oldAvgCost + totalCost) / newBalance;
      }
      sum = totalCost;
      price = quantity > 0 ? totalCost / quantity : 0;
    } else {
      newBalance = Math.max(0, oldBalance - quantity);
      // При расходе средняя цена не меняется
      sum = quantity * oldAvgCost;
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
        quantity: isReceipt ? quantity.toString() : (-quantity).toString(),
        sum: sum.toFixed(2),
        price: price.toFixed(4),
        balanceBefore: oldBalance.toString(),
        balanceAfter: newBalance.toString(),
        averageCostBefore: oldAvgCost.toString(),
        averageCostAfter: newAvgCost.toString(),
        transactionDate: txDate,
        createdById,
      })
      .returning();

    const updateData: any = {
      updatedAt: sql`NOW()`,
      updatedById: createdById,
    };
    if (isPvkj) {
      updateData.pvkjBalance = newBalance.toFixed(2);
      updateData.pvkjAverageCost = newAvgCost.toFixed(4);
    } else {
      updateData.currentBalance = newBalance.toFixed(2);
      updateData.averageCost = newAvgCost.toFixed(4);
    }
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

    const currentBalance = parseFloat(
      (isPvkj ? equipment.pvkjBalance : equipment.currentBalance) || "0",
    );
    const currentCost = parseFloat(
      (isPvkj ? equipment.pvkjAverageCost : equipment.averageCost) || "0",
    );

    let newBalance: number;
    let newAverageCost: number;
    let sum: number;
    let price: number;

    if (isReceipt) {
      const balanceBeforeOld = currentBalance - oldQty;
      const totalCostBeforeOld = currentBalance * currentCost - oldTotalCost;
      newBalance = balanceBeforeOld + newQty;
      const newTotalCostInEq = totalCostBeforeOld + newTotalCost;
      newAverageCost = newBalance > 0 ? newTotalCostInEq / newBalance : 0;
      sum = newTotalCost;
      price = newQty > 0 ? newTotalCost / newQty : 0;
    } else {
      const balanceBeforeOld = currentBalance + oldQty;
      newBalance = Math.max(0, balanceBeforeOld - newQty);
      newAverageCost = currentCost;
      sum = newQty * currentCost;
      price = currentCost;
    }

    const oldTxDate = transaction.transactionDate || transaction.createdAt;
    const effectiveDate =
      dealDate && new Date(dealDate) < new Date(oldTxDate)
        ? format(
            new Date(dealDate).setHours(23, 59, 0, 0),
            "yyyy-MM-dd'T'HH:mm:ss",
          )
        : oldTxDate;

    await tx
      .update(equipmentTransactions)
      .set({
        quantity: isReceipt ? newQty.toString() : (-newQty).toString(),
        sum: sum.toFixed(2),
        price: price.toFixed(4),
        balanceAfter: newBalance.toString(),
        averageCostAfter: newAverageCost.toFixed(4),
        updatedAt: sql`NOW()`,
        updatedById: userId,
        transactionDate: effectiveDate,
      })
      .where(eq(equipmentTransactions.id, transactionId));

    const updateData: any = {
      updatedAt: sql`NOW()`,
      updatedById: userId,
    };
    if (isPvkj) {
      updateData.pvkjBalance = newBalance.toFixed(2);
      updateData.pvkjAverageCost = newAverageCost.toFixed(4);
    } else {
      updateData.currentBalance = newBalance.toFixed(2);
      updateData.averageCost = newAverageCost.toFixed(4);
    }
    await tx
      .update(equipments)
      .set(updateData)
      .where(eq(equipments.id, equipmentId));

    const needsRecalc = await this.needsRecalculation(
      tx,
      equipmentId,
      productType,
      effectiveDate,
    );
    if (needsRecalc) {
      console.log(
        `[EquipmentTransactionService] Transaction update requires recalculation for equipment ${equipmentId}`,
      );
      await EquipmentRecalculationQueueService.addToQueue(
        equipmentId,
        productType,
        effectiveDate,
        userId,
        1,
      );
    }

    return newBalance;
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
    const qty = Math.abs(parseFloat(transaction.quantity));
    const isReceipt =
      transaction.transactionType === TRANSACTION_TYPE.RECEIPT ||
      transaction.transactionType === TRANSACTION_TYPE.TRANSFER_IN;

    let newBalance = parseFloat(
      (isPvkj ? equipment.pvkjBalance : equipment.currentBalance) || "0",
    );
    let newAvgCost = parseFloat(
      (isPvkj ? equipment.pvkjAverageCost : equipment.averageCost) || "0",
    );

    if (isReceipt) {
      newBalance = Math.max(0, newBalance - qty);
      if (newBalance > 0) {
        newAvgCost = parseFloat(transaction.averageCostBefore || "0");
      }
    } else {
      newBalance += qty;
    }

    const updateData: any = {
      updatedAt: sql`NOW()`,
      updatedById: userId,
    };
    if (isPvkj) {
      updateData.pvkjBalance = newBalance.toFixed(2);
      updateData.pvkjAverageCost = newAvgCost.toFixed(4);
    } else {
      updateData.currentBalance = newBalance.toFixed(2);
      updateData.averageCost = newAvgCost.toFixed(4);
    }
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
    const quantity = parseFloat(transaction.quantity);
    const isReceipt =
      transaction.transactionType === TRANSACTION_TYPE.RECEIPT ||
      transaction.transactionType === TRANSACTION_TYPE.TRANSFER_IN;

    const currentBalance = parseFloat(
      (isPvkj ? equipment.pvkjBalance : equipment.currentBalance) || "0",
    );
    const currentCost = parseFloat(
      (isPvkj ? equipment.pvkjAverageCost : equipment.averageCost) || "0",
    );

    const newBalance = Math.max(0, currentBalance + quantity);
    let newAvgCost = currentCost;

    if (isReceipt && transaction.averageCostBefore !== transaction.averageCostAfter) {
      const totalCostBefore = currentBalance * currentCost;
      const txSum = parseFloat(transaction.sum || "0");
      const newTotalCost = Math.max(0, totalCostBefore + txSum);
      newAvgCost = newBalance > 0 ? newTotalCost / newBalance : 0;
    }

    const updateData: any = {
      updatedAt: sql`NOW()`,
      updatedById: userId,
    };
    if (isPvkj) {
      updateData.pvkjBalance = newBalance.toFixed(2);
      updateData.pvkjAverageCost = newAvgCost.toFixed(4);
    } else {
      updateData.currentBalance = newBalance.toFixed(2);
      updateData.averageCost = newAvgCost.toFixed(4);
    }
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
      );
    }
  }
}
