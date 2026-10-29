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
import { calculateStockMovement } from "server/modules/warehouses/services/stock-transaction-calculations";

function requireEquipmentTonneValue(
  value: unknown,
  label: string,
): number {
  if (value === null || value === undefined || value === "") {
    throw new Error(`${label} is missing its authoritative tonne value`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} has an invalid tonne value`);
  }
  return parsed;
}

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
    const equipmentKey = `${equipmentId}:${productType}`;
    if (visited.has(equipmentKey)) {
      console.log(
        `[EquipmentRecalculationService] Equipment ${equipmentId} (${productType}) already visited, skipping`,
      );
      return;
    }

    visited.add(equipmentKey);
    try {
      await this.recalculateEquipmentChain(
        tx,
        equipmentId,
        afterDate,
        productType,
        updatedById,
        visited,
        visitedWarehouses,
      );
    } finally {
      visited.delete(equipmentKey);
    }
  }

  private static async recalculateEquipmentChain(
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

    let currentBalance = lastBefore
      ? requireEquipmentTonneValue(
          lastBefore.balanceAfterTonnes,
          `Equipment transaction ${lastBefore.id} balanceAfterTonnes`,
        )
      : 0;
    let currentAverageCost = lastBefore
      ? requireEquipmentTonneValue(
          lastBefore.averageCostAfterPerTonne,
          `Equipment transaction ${lastBefore.id} averageCostAfterPerTonne`,
        )
      : 0;

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
        // At the same business timestamp, apply stock checkpoints and inflows
        // before outflows so a simultaneous transfer receipt can fund a sale.
        asc(sql`CASE
          WHEN ${equipmentTransactions.transactionType} = ${TRANSACTION_TYPE.INVENTORY} THEN 0
          WHEN ${equipmentTransactions.transactionType} IN (${TRANSACTION_TYPE.RECEIPT}, ${TRANSACTION_TYPE.TRANSFER_IN}) THEN 1
          ELSE 2
        END`),
        asc(equipmentTransactions.createdAt),
        asc(equipmentTransactions.id),
      );

    console.log(`  Found ${transactions.length} transactions to recalculate`);

    for (const transaction of transactions) {
      const quantity = requireEquipmentTonneValue(
        transaction.quantityTonnes,
        `Equipment transaction ${transaction.id} quantityTonnes`,
      );
      const isReceipt =
        transaction.transactionType === TRANSACTION_TYPE.RECEIPT ||
        transaction.transactionType === TRANSACTION_TYPE.TRANSFER_IN;

      let newBalance: number;
      let newAverageCost: number;
      let newSum: number;
      let newPrice: number;

      let incomingCost = 0;
      if (isReceipt) {
        incomingCost = await this.getIncomingCostForEquipment(
          tx,
          transaction.sourceType,
          transaction.sourceId,
          quantity,
          currentAverageCost,
        );
      }

      {
        const result = calculateStockMovement(
          { balance: currentBalance, averageCost: currentAverageCost },
          {
            ...transaction,
            quantity,
          },
          incomingCost,
        );
        newBalance = result.balance;
        newAverageCost = result.averageCost;
        newSum = result.sum;
        newPrice = result.price;
      }

      if (!isReceipt) {
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
          balanceBeforeTonnes: currentBalance.toFixed(5),
          balanceAfterTonnes: newBalance.toFixed(5),
          averageCostBeforePerTonne: currentAverageCost.toFixed(6),
          averageCostAfterPerTonne: newAverageCost.toFixed(6),
          sum: newSum.toFixed(2),
          pricePerTonne: newPrice.toFixed(6),
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
      updateData.pvkjBalanceTonnes = currentBalance.toFixed(5);
      updateData.pvkjAverageCostPerTonne = currentAverageCost.toFixed(6);
    } else {
      updateData.currentBalanceTonnes = currentBalance.toFixed(5);
      updateData.averageCostPerTonne = currentAverageCost.toFixed(6);
    }

    await tx
      .update(equipments)
      .set(updateData)
      .where(eq(equipments.id, equipmentId));

    console.log(
      `  Equipment ${equipmentId} updated: balance=${currentBalance.toFixed(5)} t, avgCost=${currentAverageCost.toFixed(2)} ₽/t`,
    );
  }

  private static async getIncomingCostForEquipment(
    tx: any,
    sourceType: string | null | undefined,
    sourceId: string | null | undefined,
    quantityTonnes: number,
    fallbackAverageCostPerTonne: number,
  ): Promise<number> {
    if (!sourceId) return quantityTonnes * fallbackAverageCostPerTonne;

    if (sourceType === SOURCE_TYPE.MOVEMENT) {
      const move = await tx.query.equipmentMovement?.findFirst({
        where: eq(equipmentMovement.id, sourceId),
      });

      if (move) {
        const totalCost = parseFloat(move.totalCost || "0");
        if (totalCost > 0) return totalCost;
        if (move.costPerTonne != null) {
          const costPerTonne = Number(move.costPerTonne);
          if (Number.isFinite(costPerTonne)) {
            return costPerTonne * quantityTonnes;
          }
        }
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
        const srcCostPerTonne = requireEquipmentTonneValue(
          sourceTx[0].averageCostAfterPerTonne,
          `Equipment transaction ${sourceTx[0].id} averageCostAfterPerTonne`,
        );
        return srcCostPerTonne * quantityTonnes;
      }
    }

    return quantityTonnes * fallbackAverageCostPerTonne;
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
    if (transactionType !== TRANSACTION_TYPE.TRANSFER_OUT) return;

    console.log(
      "        [updateEquipmentMovement]",
      movementId,
      transactionType,
    );
    const move = await tx.query.equipmentMovement.findFirst({
      where: eq(equipmentMovement.id, movementId),
    });

    if (!move) return;

    const quantityTonnes = requireEquipmentTonneValue(
      move.quantityTonnes,
      `Equipment movement ${movementId} quantityTonnes`,
    );
    const totalCost = quantityTonnes * newAverageCost;
    await tx
      .update(equipmentMovement)
      .set({
        costPerTonne: newAverageCost.toFixed(6),
        totalCost: totalCost.toFixed(2),
        updatedAt: sql`NOW()`,
        updatedById,
      })
      .where(eq(equipmentMovement.id, movementId));
    console.log("        ✓ Перемещение оборудования обновлено");

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
