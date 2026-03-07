import { eq, and, gte, sql, or, isNull, desc, asc } from "drizzle-orm";
import {
  warehouses,
  warehouseTransactions,
  opt,
  aircraftRefueling,
  movement,
  equipmentTransactions,
  equipmentMovement,
} from "@shared/schema";
import { PRODUCT_TYPE, TRANSACTION_TYPE, SOURCE_TYPE } from "@shared/constants";
import { EquipmentRecalculationService } from "server/modules/warehouses-equipment/services/equipment-recalculation-service";

export class WarehouseRecalculationService {
  static async recalculateAllAffectedTransactions(
    tx: any,
    affectedWarehouses: Array<{
      warehouseId: string;
      afterDate: string;
      productType: string;
    }>,
    updatedById?: string,
    visitedWarehouses?: Set<string>,
    visitedEquipments?: Set<string>,
  ) {
    console.log(
      "  [WarehouseRecalculationService] recalculateAllAffectedTransactions",
    );
    console.log(
      "    Количество затронутых складов:",
      affectedWarehouses.length,
    );

    const visited = visitedWarehouses || new Set<string>();
    const visitedEq = visitedEquipments || new Set<string>();

    for (let i = 0; i < affectedWarehouses.length; i++) {
      const { warehouseId, afterDate, productType } = affectedWarehouses[i];
      const key = `${warehouseId}:${productType}`;

      if (visited.has(key)) {
        console.log(
          `    Склад ${warehouseId} (${productType}) уже обработан, пропускаем`,
        );
        continue;
      }

      visited.add(key);

      console.log(
        `\n    === Пересчет склада ${i + 1} из ${affectedWarehouses.length} ===`,
      );
      console.log("    Warehouse ID:", warehouseId);
      console.log("    After Date:", afterDate);
      console.log("    Product Type:", productType);

      await this.recalculateWarehouseChain(
        tx,
        warehouseId,
        afterDate,
        productType,
        updatedById,
        visited,
        visitedEq,
      );

      console.log(`    ✓ Склад ${i + 1} пересчитан`);
    }

    console.log("\n  ✓ Все затронутые склады пересчитаны");
  }

  private static async recalculateWarehouseChain(
    tx: any,
    warehouseId: string,
    afterDate: string,
    productType: string,
    updatedById?: string,
    visitedWarehouses?: Set<string>,
    visitedEquipments?: Set<string>,
  ) {
    console.log("      [recalculateWarehouseChain] Начало пересчета цепочки");
    const isPvkj = productType === PRODUCT_TYPE.PVKJ;
    const visited = visitedWarehouses || new Set<string>();
    const visitedEq = visitedEquipments || new Set<string>();

    const initialState = await this.getWarehouseStateBeforeDate(
      tx,
      warehouseId,
      afterDate,
      productType,
    );

    console.log("      Начальное состояние до", afterDate, ":", initialState);

    const transactions = await tx
      .select()
      .from(warehouseTransactions)
      .where(
        and(
          eq(warehouseTransactions.warehouseId, warehouseId),
          eq(warehouseTransactions.productType, productType),
          isNull(warehouseTransactions.deletedAt),
          or(
            gte(warehouseTransactions.transactionDate, afterDate),
            and(
              isNull(warehouseTransactions.transactionDate),
              gte(warehouseTransactions.createdAt, afterDate),
            ),
          ),
        ),
      )
      .orderBy(
        asc(
          sql`COALESCE(${warehouseTransactions.transactionDate}, ${warehouseTransactions.createdAt})`,
        ),
        asc(warehouseTransactions.createdAt),
        asc(warehouseTransactions.id),
      );

    console.log("      Найдено транзакций для пересчета:", transactions.length);

    let currentBalance = initialState.balance;
    let currentAverageCost = initialState.averageCost;

    const cascadeRecalculations: Array<{
      warehouseId: string;
      afterDate: string;
      productType: string;
    }> = [];

    const cascadeEquipmentRecalculations: Array<{
      equipmentId: string;
      afterDate: string;
      productType: string;
    }> = [];

    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      console.log(`\n      --- Транзакция ${i + 1}/${transactions.length} ---`);
      console.log("      ID:", transaction.id);
      console.log("      Type:", transaction.transactionType);
      console.log(
        "      Source:",
        transaction.sourceType,
        transaction.sourceId,
      );
      console.log("      TransactionDate:", transaction.transactionDate);
      console.log("      CreatedAt:", transaction.createdAt);

      const quantity = Math.abs(parseFloat(transaction.quantity));
      const isReceipt =
        transaction.transactionType === TRANSACTION_TYPE.RECEIPT ||
        transaction.transactionType === TRANSACTION_TYPE.TRANSFER_IN;

      console.log(
        "      Quantity:",
        quantity,
        isReceipt ? "(приход)" : "(расход)",
      );
      console.log("      До пересчета:", {
        balance: currentBalance,
        averageCost: currentAverageCost,
      });

      let newBalance: number;
      let newAverageCost: number;
      let newSum: number;
      let newPrice: number;

      if (isReceipt) {
        newBalance = currentBalance + quantity;

        const incomingCost = await this.getTransactionIncomingCost(
          tx,
          transaction.sourceType,
          transaction.sourceId,
          quantity,
          currentAverageCost,
        );

        console.log("      Incoming cost:", incomingCost);

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
      }

      console.log("      После пересчета:", {
        balance: newBalance,
        averageCost: newAverageCost,
        sum: newSum,
        price: newPrice,
      });

      await tx
        .update(warehouseTransactions)
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
        .where(eq(warehouseTransactions.id, transaction.id));

      console.log("      ✓ Транзакция обновлена в БД");

      if (transaction.transactionType === TRANSACTION_TYPE.SALE) {
        console.log("      → Обновление связанной сделки (продажа)");
        await this.updateRelatedDeal(
          tx,
          transaction.sourceType,
          transaction.sourceId,
          currentAverageCost,
          updatedById,
        );
      }

      if (
        transaction.sourceType === SOURCE_TYPE.MOVEMENT &&
        transaction.transactionType === TRANSACTION_TYPE.TRANSFER_OUT
      ) {
        // Каскад на склад (warehouse → warehouse через таблицу movement)
        const warehouseCascade = await this.getMovementCascadeInfo(
          tx,
          transaction.sourceId,
          newAverageCost,
          quantity,
          visited,
        );

        if (warehouseCascade) {
          cascadeRecalculations.push(warehouseCascade);
        }

        // Каскад на СЗ (warehouse → СЗ через таблицу equipmentMovement)
        const equipmentCascade = await this.getEquipmentMovementCascadeInfo(
          tx,
          transaction.sourceId,
          newAverageCost,
          quantity,
          visitedEq,
          updatedById,
        );

        if (equipmentCascade) {
          cascadeEquipmentRecalculations.push(equipmentCascade);
        }
      }

      currentBalance = newBalance;
      currentAverageCost = newAverageCost;
    }

    console.log("\n      Финальное состояние склада:", {
      balance: currentBalance,
      averageCost: currentAverageCost,
    });

    const updateData: any = {
      updatedAt: sql`NOW()`,
      updatedById,
    };

    if (isPvkj) {
      updateData.pvkjBalance = currentBalance.toFixed(2);
      updateData.pvkjAverageCost = currentAverageCost.toFixed(4);
    } else {
      updateData.currentBalance = currentBalance.toFixed(2);
      updateData.averageCost = currentAverageCost.toFixed(4);
    }

    await tx
      .update(warehouses)
      .set(updateData)
      .where(eq(warehouses.id, warehouseId));

    console.log("      ✓ Склад обновлен с финальными значениями");

    // Каскадный пересчёт складов-получателей (warehouse → warehouse)
    for (const cascade of cascadeRecalculations) {
      const cascadeKey = `${cascade.warehouseId}:${cascade.productType}`;
      if (visited.has(cascadeKey)) {
        console.log(
          `      → Каскадный пересчет ${cascade.warehouseId} уже в процессе, пропускаем`,
        );
        continue;
      }

      visited.add(cascadeKey);
      console.log(
        `\n      → Каскадный пересчет склада-получателя: ${cascade.warehouseId}`,
      );
      await this.recalculateWarehouseChain(
        tx,
        cascade.warehouseId,
        cascade.afterDate,
        cascade.productType,
        updatedById,
        visited,
        visitedEq,
      );
    }

    // Каскадный пересчёт СЗ, получавших топливо с этого склада
    for (const cascade of cascadeEquipmentRecalculations) {
      const eqKey = `${cascade.equipmentId}:${cascade.productType}`;
      if (visitedEq.has(eqKey)) {
        console.log(
          `      → Каскадный пересчет СЗ ${cascade.equipmentId} уже в процессе, пропускаем`,
        );
        continue;
      }
      console.log(
        `\n      → Каскадный пересчет СЗ-получателя: ${cascade.equipmentId}`,
      );
      await EquipmentRecalculationService.recalculateEquipmentFromDate(
        tx,
        cascade.equipmentId,
        cascade.afterDate,
        cascade.productType,
        updatedById,
        visitedEq,
        visited,
      );
    }
  }

  private static async getWarehouseStateBeforeDate(
    tx: any,
    warehouseId: string,
    beforeDate: string,
    productType: string,
  ): Promise<{ balance: number; averageCost: number }> {
    const lastTransaction = await tx
      .select()
      .from(warehouseTransactions)
      .where(
        and(
          eq(warehouseTransactions.warehouseId, warehouseId),
          eq(warehouseTransactions.productType, productType),
          isNull(warehouseTransactions.deletedAt),
          sql`COALESCE(${warehouseTransactions.transactionDate}, ${warehouseTransactions.createdAt}) < ${beforeDate}`,
        ),
      )
      .orderBy(
        desc(
          sql`COALESCE(${warehouseTransactions.transactionDate}, ${warehouseTransactions.createdAt})`,
        ),
        desc(warehouseTransactions.createdAt),
        desc(warehouseTransactions.id),
      )
      .limit(1);

    if (lastTransaction.length > 0) {
      return {
        balance: parseFloat(lastTransaction[0].balanceAfter || "0"),
        averageCost: parseFloat(lastTransaction[0].averageCostAfter || "0"),
      };
    }

    return { balance: 0, averageCost: 0 };
  }

  private static async getTransactionIncomingCost(
    tx: any,
    sourceType: string,
    sourceId: string,
    quantity: number,
    currentAverageCost: number,
  ): Promise<number> {
    if (sourceType === SOURCE_TYPE.MOVEMENT) {
      const movementRecord = await tx.query.movement.findFirst({
        where: eq(movement.id, sourceId),
      });

      if (movementRecord) {
        return parseFloat(movementRecord.totalCost || "0");
      }

      // Проверяем, не является ли источником возврат с СЗ (equipmentMovement)
      // Если СЗ делало возврат на склад, себестоимость берём со склада
      const equipmentTx = await tx.query.equipmentTransactions.findFirst({
        where: and(
          eq(equipmentTransactions.sourceType, SOURCE_TYPE.MOVEMENT),
          eq(equipmentTransactions.sourceId, sourceId),
          eq(
            equipmentTransactions.transactionType,
            TRANSACTION_TYPE.TRANSFER_OUT,
          ),
          isNull(equipmentTransactions.deletedAt),
        ),
      });
      if (equipmentTx) {
        const totalCost = quantity * currentAverageCost;
        return totalCost;
      }
    }

    return 0;
  }

  private static async getMovementCascadeInfo(
    tx: any,
    movementId: string,
    newSourceAverageCost: number,
    quantity: number,
    visitedWarehouses: Set<string>,
  ): Promise<{
    warehouseId: string;
    afterDate: string;
    productType: string;
  } | null> {
    const movementRecord = await tx.query.movement.findFirst({
      where: eq(movement.id, movementId),
    });

    if (
      !movementRecord ||
      !movementRecord.toWarehouseId ||
      !movementRecord.fromWarehouseId
    ) {
      return null;
    }

    const cascadeKey = `${movementRecord.toWarehouseId}:${movementRecord.productType || "kerosene"}`;
    if (visitedWarehouses.has(cascadeKey)) {
      console.log(
        `        Склад-получатель ${movementRecord.toWarehouseId} уже в очереди на пересчет`,
      );
      return null;
    }

    if (
      Math.abs(
        newSourceAverageCost - parseFloat(movementRecord.purchasePrice || "0"),
      ) > 0.0001
    ) {
      console.log(
        `        Обновление цены закупки перемещения: ${movementRecord.purchasePrice} -> ${newSourceAverageCost}`,
      );

      const deliveryCost = parseFloat(movementRecord.deliveryCost || "0");
      const storageCost = parseFloat(movementRecord.storageCost || "0");
      const newTotalCost =
        quantity * newSourceAverageCost + deliveryCost + storageCost;
      const costPerKg = quantity > 0 ? newTotalCost / quantity : 0;

      await tx
        .update(movement)
        .set({
          purchasePrice: newSourceAverageCost.toFixed(4),
          totalCost: newTotalCost.toFixed(2),
          costPerKg: costPerKg.toFixed(4),
          updatedAt: sql`NOW()`,
        })
        .where(eq(movement.id, movementId));

      const destinationTransaction =
        await tx.query.warehouseTransactions.findFirst({
          where: and(
            eq(warehouseTransactions.sourceType, SOURCE_TYPE.MOVEMENT),
            eq(warehouseTransactions.sourceId, movementId),
            eq(warehouseTransactions.warehouseId, movementRecord.toWarehouseId),
            or(
              eq(
                warehouseTransactions.transactionType,
                TRANSACTION_TYPE.RECEIPT,
              ),
              eq(
                warehouseTransactions.transactionType,
                TRANSACTION_TYPE.TRANSFER_IN,
              ),
            ),
            isNull(warehouseTransactions.deletedAt),
          ),
        });

      if (destinationTransaction) {
        const txDate =
          destinationTransaction.transactionDate ||
          destinationTransaction.createdAt;
        return {
          warehouseId: movementRecord.toWarehouseId,
          afterDate: txDate,
          productType: movementRecord.productType || "kerosene",
        };
      }
    }

    return null;
  }

  /**
   * Обрабатывает каскад для перемещения Склад → СЗ (через таблицу equipmentMovement).
   * Обновляет costPerKg и totalCost в записи equipmentMovement,
   * и возвращает данные для пересчёта СЗ-получателя.
   */
  private static async getEquipmentMovementCascadeInfo(
    tx: any,
    movementId: string,
    newSourceAverageCost: number,
    quantity: number,
    visitedEquipments: Set<string>,
    updatedById?: string,
  ): Promise<{
    equipmentId: string;
    afterDate: string;
    productType: string;
  } | null> {
    const moveRecord = await tx.query.equipmentMovement.findFirst({
      where: and(
        eq(equipmentMovement.id, movementId),
        isNull(equipmentMovement.deletedAt),
      ),
    });

    if (!moveRecord || !moveRecord.toEquipmentId) {
      return null;
    }

    const eqKey = `${moveRecord.toEquipmentId}:${moveRecord.productType}`;
    if (visitedEquipments.has(eqKey)) {
      console.log(
        `        СЗ-получатель ${moveRecord.toEquipmentId} уже в очереди на пересчет`,
      );
      return null;
    }

    const newTotalCost = quantity * newSourceAverageCost;
    const newCostPerKg = quantity > 0 ? newTotalCost / quantity : 0;

    console.log(
      `        Обновление стоимости перемещения Склад→СЗ: costPerKg=${newCostPerKg.toFixed(5)}, totalCost=${newTotalCost.toFixed(2)}`,
    );

    await tx
      .update(equipmentMovement)
      .set({
        costPerKg: newCostPerKg.toFixed(5),
        totalCost: newTotalCost.toFixed(2),
        updatedAt: sql`NOW()`,
        updatedById,
      })
      .where(eq(equipmentMovement.id, movementId));

    // Находим приходную транзакцию СЗ-получателя
    const destTx = await tx.query.equipmentTransactions.findFirst({
      where: and(
        eq(equipmentTransactions.sourceType, SOURCE_TYPE.MOVEMENT),
        eq(equipmentTransactions.sourceId, movementId),
        eq(equipmentTransactions.equipmentId, moveRecord.toEquipmentId),
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
      return {
        equipmentId: moveRecord.toEquipmentId,
        afterDate: txDate,
        productType: moveRecord.productType,
      };
    }

    return null;
  }

  static async updateRelatedDeal(
    tx: any,
    sourceType: string,
    sourceId: string,
    newAverageCost: number,
    updatedById?: string,
  ) {
    console.log("        [updateRelatedDeal]", sourceType, sourceId);
    console.log("        New average cost:", newAverageCost);

    if (sourceType === SOURCE_TYPE.OPT) {
      const deal = await tx.query.opt.findFirst({
        where: eq(opt.id, sourceId),
      });

      if (deal) {
        const quantityKg = parseFloat(deal.quantityKg);
        const salePrice = parseFloat(deal.salePrice || "0");
        const deliveryCost = parseFloat(deal.deliveryCost || "0");
        const purchaseAmount = quantityKg * newAverageCost;
        const saleAmount = quantityKg * salePrice;
        const profit = saleAmount - purchaseAmount - deliveryCost;

        console.log("        ОПТ сделка до обновления:", {
          purchasePrice: deal.purchasePrice,
          purchaseAmount: deal.purchaseAmount,
          profit: deal.profit,
        });

        console.log("        ОПТ сделка после обновления:", {
          purchasePrice: newAverageCost.toFixed(4),
          purchaseAmount: purchaseAmount.toFixed(2),
          profit: profit.toFixed(2),
        });

        await tx
          .update(opt)
          .set({
            purchasePrice: newAverageCost.toFixed(4),
            purchaseAmount: purchaseAmount.toFixed(2),
            profit: profit.toFixed(2),
            purchasePriceModified: true,
            updatedAt: sql`NOW()`,
            updatedById,
          })
          .where(eq(opt.id, sourceId));

        console.log("        ✓ ОПТ сделка обновлена");
      }
    } else if (sourceType === SOURCE_TYPE.REFUELING) {
      const refuel = await tx.query.aircraftRefueling.findFirst({
        where: eq(aircraftRefueling.id, sourceId),
      });

      if (refuel && refuel.productType !== PRODUCT_TYPE.SERVICE) {
        const quantityKg = parseFloat(refuel.quantityKg);
        const salePrice = parseFloat(refuel.salePrice || "0");
        const agentFee = parseFloat(refuel.agentFee || "0");
        const purchaseAmount = quantityKg * newAverageCost;
        const saleAmount = quantityKg * salePrice;
        const profit = saleAmount - purchaseAmount - agentFee;

        console.log("        Заправка до обновления:", {
          purchasePrice: refuel.purchasePrice,
          purchaseAmount: refuel.purchaseAmount,
          profit: refuel.profit,
        });

        console.log("        Заправка после обновления:", {
          purchasePrice: newAverageCost.toFixed(4),
          purchaseAmount: purchaseAmount.toFixed(2),
          profit: profit.toFixed(2),
        });

        await tx
          .update(aircraftRefueling)
          .set({
            purchasePrice: newAverageCost.toFixed(4),
            purchaseAmount: purchaseAmount.toFixed(2),
            profit: profit.toFixed(2),
            purchasePriceModified: true,
            updatedAt: sql`NOW()`,
            updatedById,
          })
          .where(eq(aircraftRefueling.id, sourceId));

        console.log("        ✓ Заправка обновлена");
      }
    }
  }
}
