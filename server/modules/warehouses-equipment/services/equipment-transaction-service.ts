import { eq, sql } from "drizzle-orm";
import { equipments, equipmentTransactions } from "../entities/equipment";
import { TRANSACTION_TYPE, PRODUCT_TYPE } from "@shared/constants";

export class EquipmentTransactionService {
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
    const oldBalance = parseFloat((isPvkj ? equipment.pvkjBalance : equipment.currentBalance) || "0");
    const oldAvgCost = parseFloat((isPvkj ? equipment.pvkjAverageCost : equipment.averageCost) || "0");
    let newBalance = oldBalance;
    let newAvgCost = oldAvgCost;

    const isReceipt =
      transactionType === TRANSACTION_TYPE.RECEIPT ||
      transactionType === TRANSACTION_TYPE.TRANSFER_IN;

    if (isReceipt) {
      newBalance = oldBalance + quantity;
      if (newBalance > 0) {
        newAvgCost = (oldBalance * oldAvgCost + totalCost) / newBalance;
      }
    } else {
      newBalance = Math.max(0, oldBalance - quantity);
      // При расходе средняя цена не меняется
    }

    const [transaction] = await tx
      .insert(equipmentTransactions)
      .values({
        equipmentId,
        transactionType,
        productType,
        sourceType,
        sourceId,
        quantity: isReceipt ? quantity.toString() : (-quantity).toString(),
        balanceBefore: oldBalance.toString(),
        balanceAfter: newBalance.toString(),
        averageCostBefore: oldAvgCost.toString(),
        averageCostAfter: newAvgCost.toString(),
        transactionDate: dealDate,
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

    const currentBalance = parseFloat((isPvkj ? equipment.pvkjBalance : equipment.currentBalance) || "0");

    let balanceBeforeOldOperation: number;
    let newBalance: number;

    if (isReceipt) {
      balanceBeforeOldOperation = currentBalance - oldQty;
      newBalance = balanceBeforeOldOperation + newQty;
    } else {
      balanceBeforeOldOperation = currentBalance + oldQty;
      newBalance = Math.max(0, balanceBeforeOldOperation - newQty);
    }

    await tx
      .update(equipmentTransactions)
      .set({
        quantity: isReceipt ? newQty.toString() : (-newQty).toString(),
        balanceAfter: newBalance.toString(),
        transactionDate: dealDate,
        userId,
      })
      .where(eq(equipmentTransactions.id, transactionId));

    const updateData: any = {
      updatedAt: sql`NOW()`,
      updatedById: userId,
    };

    if (isPvkj) {
      updateData.pvkjBalance = newBalance.toFixed(2);
    } else {
      updateData.currentBalance = newBalance.toFixed(2);
    }

    await tx
      .update(equipments)
      .set(updateData)
      .where(eq(equipments.id, equipmentId));

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

    let newBalance = parseFloat((isPvkj ? equipment.pvkjBalance : equipment.currentBalance) || "0");
    let newAvgCost = parseFloat((isPvkj ? equipment.pvkjAverageCost : equipment.averageCost) || "0");

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
      .where(eq(equipment.id, transaction.equipmentId))
      .for("update");

    if (!equipment) throw new Error("Оборудование не найдено");

    const isPvkj = transaction.productType === PRODUCT_TYPE.PVKJ;
    const quantity = parseFloat(transaction.quantity);
    const currentBalance = parseFloat((isPvkj ? equipment.pvkjBalance : equipment.currentBalance) || "0");
    const newBalance = Math.max(0, currentBalance + quantity);

    const updateData: any = {
      updatedAt: sql`NOW()`,
      updatedById: userId,
    };

    if (isPvkj) {
      updateData.pvkjBalance = newBalance.toFixed(2);
    } else {
      updateData.currentBalance = newBalance.toFixed(2);
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
  }
}
