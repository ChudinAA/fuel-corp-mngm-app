import { eq, and, gte, asc, desc, isNull, or, sql } from "drizzle-orm";
import { equipments, equipmentTransactions } from "../entities/equipment";
import {
  equipmentMovement,
  aircraftRefueling,
  opt,
  warehouseTransactions,
} from "@shared/schema";
import { PRODUCT_TYPE, TRANSACTION_TYPE, SOURCE_TYPE } from "@shared/constants";
import { WarehouseRecalculationService } from "server/modules/warehouses/services/warehouse-recalculation-service";

export class EquipmentRecalculationService {
  static async recalculateEquipmentFromDate(
    tx: any,
    equipmentId: string,
    afterDate: string,
    productType: string,
    updatedById?: string,
    visitedEquipments?: Set<string>,
    visitedWarehouses?: Set<string>,
  ) {
    const visited = visitedEquipments || new Set<string>();
    const visitedWh = visitedWarehouses || new Set<string>();

    const equipmentKey = `${equipmentId}:${productType}`;
    if (visited.has(equipmentKey)) {
      console.log(
        `[EquipmentRecalculationService] Equipment ${equipmentId} (${productType}) already visited, skipping`,
      );
      return;
    }
    visited.add(equipmentKey);

    console.log(
      `[EquipmentRecalculationService] Recalculating equipment ${equipmentId} from ${afterDate}, productType=${productType}`,
    );

    const isPvkj = productType === PRODUCT_TYPE.PVKJ;

    // 1. Find state BEFORE afterDate
    const [lastBefore] = await tx
      .select()
      .from(equipmentTransactions)
      .where(
        and(
          eq(equipmentTransactions.equipmentId, equipmentId),
          eq(equipmentTransactions.productType, productType),
          isNull(equipmentTransactions.deletedAt),
          sql`COALESCE(${equipmentTransactions.transactionDate}, ${equipmentTransactions.createdAt}) < ${afterDate}`,
        ),
      )
      .orderBy(
        desc(
          sql`COALESCE(${equipmentTransactions.transactionDate}, ${equipmentTransactions.createdAt})`,
        ),
        desc(equipmentTransactions.createdAt),
        desc(equipmentTransactions.id),
      )
      .limit(1);

    let currentBalance = parseFloat(lastBefore?.balanceAfter || "0");
    let currentAverageCost = parseFloat(lastBefore?.averageCostAfter || "0");

    console.log(
      `  Initial state before ${afterDate}: balance=${currentBalance}, avgCost=${currentAverageCost}`,
    );

    // 2. Get all transactions from afterDate onwards, ordered chronologically
    const transactions = await tx
      .select()
      .from(equipmentTransactions)
      .where(
        and(
          eq(equipmentTransactions.equipmentId, equipmentId),
          eq(equipmentTransactions.productType, productType),
          isNull(equipmentTransactions.deletedAt),
          or(
            gte(equipmentTransactions.transactionDate, afterDate),
            and(
              isNull(equipmentTransactions.transactionDate),
              gte(equipmentTransactions.createdAt, afterDate),
            ),
          ),
        ),
      )
      .orderBy(
        asc(
          sql`COALESCE(${equipmentTransactions.transactionDate}, ${equipmentTransactions.createdAt})`,
        ),
        asc(equipmentTransactions.createdAt),
        asc(equipmentTransactions.id),
      );

    console.log(`  Found ${transactions.length} transactions to recalculate`);

    for (const transaction of transactions) {
      const quantity = Math.abs(parseFloat(transaction.quantity));
      const isReceipt =
        transaction.transactionType === TRANSACTION_TYPE.RECEIPT ||
        transaction.transactionType === TRANSACTION_TYPE.TRANSFER_IN;

      let newBalance: number;
      let newAverageCost: number;
      let newSum: number;
      let newPrice: number;

      if (isReceipt) {
        newBalance = currentBalance + quantity;

        const incomingCost = await this.getIncomingCostForEquipment(
          tx,
          transaction.sourceType,
          transaction.sourceId,
          quantity,
          currentAverageCost,
        );

        const totalCurrentCost = currentBalance * currentAverageCost;
        newAverageCost =
          newBalance > 0 ? (totalCurrentCost + incomingCost) / newBalance : 0;

        newSum = incomingCost;
        newPrice = quantity > 0 ? incomingCost / quantity : 0;
      } else {
        newBalance = Math.max(0, currentBalance - quantity);
        newAverageCost = currentAverageCost;
        newSum = quantity * currentAverageCost;
        newPrice = currentAverageCost;

        if (
          transaction.sourceType ||
          transaction.transactionType === TRANSACTION_TYPE.SALE
        ) {
          await WarehouseRecalculationService.updateRelatedDeal(
            tx,
            transaction.sourceType,
            transaction.sourceId,
            currentAverageCost,
            updatedById,
          );
        }
      }

      if (transaction.sourceType === SOURCE_TYPE.MOVEMENT) {
        await this.updateEquipmentMovement(
          tx,
          transaction.sourceId,
          newAverageCost,
          transaction.transactionType,
          updatedById,
          visited,
          visitedWh,
        );
      }

      await tx
        .update(equipmentTransactions)
        .set({
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          averageCostBefore: currentAverageCost.toFixed(4),
          averageCostAfter: newAverageCost.toFixed(4),
          sum: newSum.toFixed(2),
          price: newPrice.toFixed(4),
          updatedAt: sql`NOW()`,
          updatedById,
        })
        .where(eq(equipmentTransactions.id, transaction.id));

      console.log(
        `  Tx ${transaction.id} (${transaction.transactionType}): balance ${currentBalance} -> ${newBalance}, avgCost ${currentAverageCost.toFixed(4)} -> ${newAverageCost.toFixed(4)}`,
      );

      currentBalance = newBalance;
      currentAverageCost = newAverageCost;
    }

    // 3. Update equipment's current state
    const updateData: any = { updatedAt: sql`NOW()`, updatedById };

    if (isPvkj) {
      updateData.pvkjBalance = currentBalance.toFixed(2);
      updateData.pvkjAverageCost = currentAverageCost.toFixed(4);
    } else {
      updateData.currentBalance = currentBalance.toFixed(2);
      updateData.averageCost = currentAverageCost.toFixed(4);
    }

    await tx
      .update(equipments)
      .set(updateData)
      .where(eq(equipments.id, equipmentId));

    console.log(
      `  Equipment ${equipmentId} updated: balance=${currentBalance.toFixed(2)}, avgCost=${currentAverageCost.toFixed(4)}`,
    );
  }

  private static async getIncomingCostForEquipment(
    tx: any,
    sourceType: string | null | undefined,
    sourceId: string | null | undefined,
    quantity: number,
    fallbackAverageCost: number,
  ): Promise<number> {
    if (!sourceId) return quantity * fallbackAverageCost;

    if (sourceType === SOURCE_TYPE.MOVEMENT) {
      const move = await tx.query.equipmentMovement?.findFirst({
        where: eq(equipmentMovement.id, sourceId),
      });

      if (move) {
        const totalCost = parseFloat(move.totalCost || "0");
        if (totalCost > 0) return totalCost;
        const costPerKg = parseFloat(move.costPerKg || "0");
        if (costPerKg > 0) return costPerKg * quantity;
      }

      const sourceTx = await tx
        .select()
        .from(equipmentTransactions)
        .where(
          and(
            eq(equipmentTransactions.sourceType, SOURCE_TYPE.MOVEMENT),
            eq(equipmentTransactions.sourceId, sourceId),
            eq(
              equipmentTransactions.transactionType,
              TRANSACTION_TYPE.TRANSFER_OUT,
            ),
            isNull(equipmentTransactions.deletedAt),
          ),
        )
        .limit(1);

      if (sourceTx.length > 0) {
        const srcQty = Math.abs(parseFloat(sourceTx[0].quantity));
        const srcCost = parseFloat(
          sourceTx[0].averageCostAfter || sourceTx[0].averageCostBefore || "0",
        );
        return srcQty > 0 ? srcCost * quantity : quantity * fallbackAverageCost;
      }
    }

    return quantity * fallbackAverageCost;
  }

  private static async updateEquipmentMovement(
    tx: any,
    movementId: string,
    newAverageCost: number,
    transactionType: string,
    updatedById?: string,
    visitedEquipments?: Set<string>,
    visitedWarehouses?: Set<string>,
  ) {
    console.log(
      "        [updateEquipmentMovement]",
      movementId,
      transactionType,
    );
    const move = await tx.query.equipmentMovement.findFirst({
      where: eq(equipmentMovement.id, movementId),
    });

    if (!move) return;

    const quantity = parseFloat(move.quantityKg);
    const totalCost = quantity * newAverageCost;
    await tx
      .update(equipmentMovement)
      .set({
        costPerKg: newAverageCost.toFixed(5),
        totalCost: totalCost.toFixed(2),
        updatedAt: sql`NOW()`,
        updatedById,
      })
      .where(eq(equipmentMovement.id, movementId));
    console.log("        ✓ Перемещение оборудования обновлено");

    if (transactionType !== TRANSACTION_TYPE.TRANSFER_OUT) return;

    const visited = visitedEquipments || new Set<string>();
    const visitedWh = visitedWarehouses || new Set<string>();

    if (move.toEquipmentId) {
      // СЗ → СЗ: каскадный пересчёт СЗ-получателя
      const eqKey = `${move.toEquipmentId}:${move.productType}`;
      if (visited.has(eqKey)) {
        console.log(
          `        → СЗ-получатель ${move.toEquipmentId} уже обрабатывается, пропускаем`,
        );
        return;
      }

      const destTx = await tx.query.equipmentTransactions.findFirst({
        where: and(
          eq(equipmentTransactions.sourceType, SOURCE_TYPE.MOVEMENT),
          eq(equipmentTransactions.sourceId, movementId),
          eq(equipmentTransactions.equipmentId, move.toEquipmentId),
          or(
            eq(equipmentTransactions.transactionType, TRANSACTION_TYPE.RECEIPT),
            eq(
              equipmentTransactions.transactionType,
              TRANSACTION_TYPE.TRANSFER_IN,
            ),
          ),
          isNull(equipmentTransactions.deletedAt),
        ),
      });

      if (destTx) {
        const txDate = destTx.transactionDate || destTx.createdAt;
        console.log(
          `        → Каскадный пересчёт СЗ-получателя ${move.toEquipmentId} с ${txDate}`,
        );
        await EquipmentRecalculationService.recalculateEquipmentFromDate(
          tx,
          move.toEquipmentId,
          txDate,
          move.productType,
          updatedById,
          visited,
          visitedWh,
        );
      }
    } else if (move.toWarehouseId) {
      // СЗ → Склад: каскадный пересчёт склада-получателя
      const whKey = `${move.toWarehouseId}:${move.productType}`;
      if (visitedWh.has(whKey)) {
        console.log(
          `        → Склад-получатель ${move.toWarehouseId} уже обрабатывается, пропускаем`,
        );
        return;
      }

      const destTx = await tx.query.warehouseTransactions.findFirst({
        where: and(
          eq(warehouseTransactions.sourceType, SOURCE_TYPE.MOVEMENT),
          eq(warehouseTransactions.sourceId, movementId),
          eq(warehouseTransactions.warehouseId, move.toWarehouseId),
          or(
            eq(warehouseTransactions.transactionType, TRANSACTION_TYPE.RECEIPT),
            eq(
              warehouseTransactions.transactionType,
              TRANSACTION_TYPE.TRANSFER_IN,
            ),
          ),
          isNull(warehouseTransactions.deletedAt),
        ),
      });

      if (destTx) {
        const txDate = destTx.transactionDate || destTx.createdAt;
        console.log(
          `        → Каскадный пересчёт склада-получателя ${move.toWarehouseId} с ${txDate}`,
        );
        await WarehouseRecalculationService.recalculateAllAffectedTransactions(
          tx,
          [
            {
              warehouseId: move.toWarehouseId,
              afterDate: txDate,
              productType: move.productType,
            },
          ],
          updatedById,
          visitedWh,
          visited,
        );
      }
    }
  }
}
