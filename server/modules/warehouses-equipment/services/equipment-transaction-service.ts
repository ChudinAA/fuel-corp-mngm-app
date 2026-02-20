import { type PgTransaction } from "drizzle-orm/pg-core";
import { eq, sql } from "drizzle-orm";
import { equipments, equipmentTransactions } from "../entities/equipment";
import { TRANSACTION_TYPE } from "@shared/constants";

export class EquipmentTransactionService {
  static async createTransactionAndUpdateEquipment(
    tx: any,
    equipmentId: string,
    type: string,
    quantity: number,
    sum: number,
    date: string,
    userId?: string,
    warehouseId?: string
  ) {
    const [equipment] = await tx
      .select()
      .from(equipments)
      .where(eq(equipments.id, equipmentId))
      .for("update");

    if (!equipment) throw new Error("Оборудование не найдено");

    const oldBalance = parseFloat(equipment.currentBalance || "0");
    const oldAvgCost = parseFloat(equipment.averageCost || "0");
    let newBalance = oldBalance;
    let newAvgCost = oldAvgCost;

    if (type === TRANSACTION_TYPE.RECEIPT) {
      newBalance = oldBalance + quantity;
      if (newBalance > 0) {
        newAvgCost = (oldBalance * oldAvgCost + sum) / newBalance;
      }
    } else {
      newBalance = oldBalance - quantity;
      // При расходе средняя цена не меняется
    }

    const [transaction] = await tx
      .insert(equipmentTransactions)
      .values({
        equipmentId,
        transactionType: type,
        quantity: quantity.toString(),
        balanceBefore: oldBalance.toString(),
        balanceAfter: newBalance.toString(),
        averageCostBefore: oldAvgCost.toString(),
        averageCostAfter: newAvgCost.toString(),
        transactionDate: date,
        sourceWarehouseId: warehouseId,
        createdById: userId,
      })
      .returning();

    await tx
      .update(equipments)
      .set({
        currentBalance: newBalance.toString(),
        averageCost: newAvgCost.toString(),
        updatedAt: sql`NOW()`,
        updatedById: userId,
      })
      .where(eq(equipments.id, equipmentId));

    return transaction;
  }

  static async updateTransactionAndRecalculateEquipment(
    tx: any,
    transactionId: string,
    equipmentId: string,
    oldQty: number,
    oldSum: number,
    newQty: number,
    newSum: number,
    userId?: string,
    date?: string
  ) {
    // Для упрощения: удаляем старую транзакцию и создаем новую
    // В полноценной системе здесь должен быть пересчет всей цепочки
    await this.deleteTransactionAndRevertEquipment(tx, transactionId, userId);
    
    const [transaction] = await tx
      .select()
      .from(equipmentTransactions)
      .where(eq(equipmentTransactions.id, transactionId));

    return await this.createTransactionAndUpdateEquipment(
      tx,
      equipmentId,
      transaction.transactionType,
      newQty,
      newSum,
      date || transaction.transactionDate,
      userId,
      transaction.sourceWarehouseId
    );
  }

  static async deleteTransactionAndRevertEquipment(
    tx: any,
    transactionId: string,
    userId?: string
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

    const qty = parseFloat(transaction.quantity);
    const sum = transaction.transactionType === TRANSACTION_TYPE.RECEIPT 
      ? qty * parseFloat(transaction.averageCostAfter) - parseFloat(transaction.balanceBefore) * parseFloat(transaction.averageCostBefore)
      : 0;

    let newBalance = parseFloat(equipment.currentBalance);
    let newAvgCost = parseFloat(equipment.averageCost);

    if (transaction.transactionType === TRANSACTION_TYPE.RECEIPT) {
      newBalance -= qty;
      if (newBalance > 0) {
        // Упрощенный возврат средней цены
        newAvgCost = parseFloat(transaction.averageCostBefore);
      }
    } else {
      newBalance += qty;
    }

    await tx
      .update(equipments)
      .set({
        currentBalance: newBalance.toString(),
        averageCost: newAvgCost.toString(),
        updatedAt: sql`NOW()`,
        updatedById: userId,
      })
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
    userId?: string
  ) {
    const [transaction] = await tx
      .select()
      .from(equipmentTransactions)
      .where(eq(equipmentTransactions.id, transactionId));

    if (!transaction) return;

    await tx
      .update(equipmentTransactions)
      .set({
        deletedAt: null,
        deletedById: null,
      })
      .where(eq(equipmentTransactions.id, transactionId));

    return await this.createTransactionAndUpdateEquipment(
      tx,
      transaction.equipmentId,
      transaction.transactionType,
      parseFloat(transaction.quantity),
      transaction.transactionType === TRANSACTION_TYPE.RECEIPT ? parseFloat(transaction.quantity) * parseFloat(transaction.averageCostAfter) : 0,
      transaction.transactionDate,
      userId,
      transaction.sourceWarehouseId
    );
  }
}
