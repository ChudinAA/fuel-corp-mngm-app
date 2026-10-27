import assert from "node:assert/strict";
import { after, test } from "node:test";
import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "../server/db";
import { PRODUCT_TYPE, SOURCE_TYPE, TRANSACTION_TYPE } from "../shared/constants";
import { aircraftRefueling } from "../server/modules/refueling/entities/refueling";
import { suppliers } from "../server/modules/suppliers/entities/suppliers";
import { customers } from "../server/modules/customers/entities/customers";
import { movement } from "../server/modules/movement/entities/movement";
import { MovementStorage } from "../server/modules/movement/storage/movement-storage";
import {
  equipmentMovement,
} from "../server/modules/equipment-movement/entities/equipment-movement";
import {
  equipments,
  equipmentTransactions,
} from "../server/modules/warehouses-equipment/entities/equipment";
import { EquipmentTransactionService } from "../server/modules/warehouses-equipment/services/equipment-transaction-service";
import { EquipmentRecalculationService } from "../server/modules/warehouses-equipment/services/equipment-recalculation-service";
import {
  warehouseTransactions,
  warehouses,
} from "../server/modules/warehouses/entities/warehouses";
import { WarehouseTransactionService } from "../server/modules/warehouses/services/warehouse-transaction-service";
import { WarehouseRecalculationService } from "../server/modules/warehouses/services/warehouse-recalculation-service";

const testDates = {
  opening: "2026-01-01T10:00:00.000Z",
  oldOrder: "2026-01-02T10:00:00.000Z",
  laterReceipt: "2026-01-03T10:00:00.000Z",
  laterSale: "2026-01-04T10:00:00.000Z",
  warehouseTransfer: "2026-01-05T10:00:00.000Z",
  equipmentTransfer: "2026-01-06T10:00:00.000Z",
  downstreamSale: "2026-01-06T10:00:00.000Z",
};

const refuelingFeeScenarios = [
  {
    label: "both fees enabled",
    agentFeeEnabled: true,
    otherServiceEnabled: true,
    expectedProfit: 75.33,
  },
  {
    label: "agent fee disabled",
    agentFeeEnabled: false,
    otherServiceEnabled: true,
    expectedProfit: 80.33,
  },
  {
    label: "other service fee disabled",
    agentFeeEnabled: true,
    otherServiceEnabled: false,
    expectedProfit: 78.33,
  },
  {
    label: "both fees disabled",
    agentFeeEnabled: false,
    otherServiceEnabled: false,
    expectedProfit: 83.33,
  },
  {
    label: "legacy null agent fee flag",
    agentFeeEnabled: null,
    otherServiceEnabled: true,
    expectedProfit: 75.33,
  },
  {
    label: "legacy null other service flag",
    agentFeeEnabled: true,
    otherServiceEnabled: null,
    expectedProfit: 75.33,
  },
  {
    label: "legacy null fee flags",
    agentFeeEnabled: null,
    otherServiceEnabled: null,
    expectedProfit: 75.33,
  },
] as const;

test("restoring an older refueling movement recalculates both fuel products in storage and equipment", async (t) => {
  const rollbackMarker = new Error("Rollback integration-test fixtures");

  try {
    const schemaResult = await db.execute(sql`
      SELECT
        to_regclass('equipment_transactions') IS NOT NULL
          AND to_regclass('equipment_movement') IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'warehouses'
              AND column_name = 'equipment_type'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'aircraft_refueling'
            AND column_name = 'refueling_order_id'
        ) AS is_fuel_equipment_schema
    `);
    assert.equal(
      schemaResult.rows[0]?.is_fuel_equipment_schema,
      true,
      "The test database must have the current fuel-equipment schema. Run `npm run test:restore-stock` to prepare it.",
    );

    await db.transaction(async (tx) => {
      const [supplier] = await tx
        .insert(suppliers)
        .values({ name: `restore-test-supplier-${crypto.randomUUID()}` })
        .returning();
      const [customer] = await tx
        .insert(customers)
        .values({
          name: `restore-test-customer-${crypto.randomUUID()}`,
          module: "refueling",
        })
        .returning();

      for (const productType of [PRODUCT_TYPE.KEROSENE, PRODUCT_TYPE.PVKJ]) {
        const isPvkj = productType === PRODUCT_TYPE.PVKJ;

        const [warehouse] = await tx
          .insert(warehouses)
          .values({
            name: `restore-test-${productType}-${crypto.randomUUID()}`,
            currentBalance: isPvkj ? "0" : "80",
            averageCost: isPvkj ? "0" : "10",
            pvkjBalance: isPvkj ? "80" : "0",
            pvkjAverageCost: isPvkj ? "10" : "0",
          })
          .returning();

        const [equipment] = await tx
          .insert(equipments)
          .values({
            name: `restore-test-${productType}-${crypto.randomUUID()}`,
            currentBalance: isPvkj ? "0" : "80",
            averageCost: isPvkj ? "0" : "10",
            pvkjBalance: isPvkj ? "80" : "0",
            pvkjAverageCost: isPvkj ? "10" : "0",
          })
          .returning();

        const [openingWarehouseTx] = await tx
          .insert(warehouseTransactions)
          .values({
            warehouseId: warehouse.id,
            transactionType: TRANSACTION_TYPE.INVENTORY,
            productType,
            quantity: "100",
            balanceBefore: "0",
            balanceAfter: "100",
            averageCostBefore: "0",
            averageCostAfter: "10",
            sum: "1000",
            transactionDate: testDates.opening,
          })
          .returning();
        const [oldWarehouseSale] = await tx
          .insert(warehouseTransactions)
          .values({
            warehouseId: warehouse.id,
            transactionType: TRANSACTION_TYPE.SALE,
            productType,
            quantity: "-20",
            balanceBefore: "100",
            balanceAfter: "80",
            averageCostBefore: "10",
            averageCostAfter: "10",
            sum: "200",
            transactionDate: testDates.oldOrder,
          })
          .returning();

        const [openingEquipmentTx] = await tx
          .insert(equipmentTransactions)
          .values({
            equipmentId: equipment.id,
            transactionType: TRANSACTION_TYPE.INVENTORY,
            productType,
            quantity: "100",
            balanceBefore: "0",
            balanceAfter: "100",
            averageCostBefore: "0",
            averageCostAfter: "10",
            sum: "1000",
            transactionDate: testDates.opening,
          })
          .returning();
        const [oldEquipmentSale] = await tx
          .insert(equipmentTransactions)
          .values({
            equipmentId: equipment.id,
            transactionType: TRANSACTION_TYPE.SALE,
            productType,
            quantity: "-20",
            balanceBefore: "100",
            balanceAfter: "80",
            averageCostBefore: "10",
            averageCostAfter: "10",
            sum: "200",
            transactionDate: testDates.oldOrder,
          })
          .returning();

        // Soft-delete the old refueling movement before later stock movements exist.
        await WarehouseTransactionService.deleteTransactionAndRevertWarehouse(
          tx,
          oldWarehouseSale.id,
        );
        await EquipmentTransactionService.deleteTransactionAndRevertEquipment(
          tx,
          oldEquipmentSale.id,
        );

        // Add a later receipt at a different cost, then a later refueling sale.
        const [warehouseMovement] = await tx
          .insert(movement)
          .values({
            movementDate: testDates.laterReceipt,
            movementType: "supply",
            productType,
            toWarehouseId: warehouse.id,
            quantityKg: "40",
            totalCost: "600",
            purchasePrice: "15",
            costPerKg: "15",
          })
          .returning();
        await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
          tx,
          warehouse.id,
          TRANSACTION_TYPE.RECEIPT,
          productType,
          SOURCE_TYPE.MOVEMENT,
          warehouseMovement.id,
          40,
          600,
          undefined,
          testDates.laterReceipt,
        );
        const [warehouseRefueling] = await tx
          .insert(aircraftRefueling)
          .values({
            refuelingDate: testDates.laterSale,
            productType,
            supplierId: supplier.id,
            buyerId: customer.id,
            warehouseId: warehouse.id,
            quantityKg: "10",
            purchasePrice: "10",
            purchaseAmount: "100",
            salePrice: "20",
            saleAmount: "200",
            agentFee: "5",
            isAgentFeeEnabled: true,
            otherServiceFee: "3",
            isOtherServiceEnabled: true,
            profit: "92",
            isDraft: false,
          })
          .returning({ id: aircraftRefueling.id });
        const { transaction: warehouseRefuelingTransaction } =
          await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
            tx,
            warehouse.id,
            TRANSACTION_TYPE.SALE,
            productType,
            SOURCE_TYPE.REFUELING,
            warehouseRefueling.id,
            10,
            0,
            undefined,
            testDates.laterSale,
          );
        await tx
          .update(aircraftRefueling)
          .set({ transactionId: warehouseRefuelingTransaction.id })
          .where(eq(aircraftRefueling.id, warehouseRefueling.id));

        const [equipmentMovementRow] = await tx
          .insert(equipmentMovement)
          .values({
            movementDate: testDates.laterReceipt,
            movementType: "storage_to_tzk",
            productType,
            toEquipmentId: equipment.id,
            quantityKg: "40",
            totalCost: "600",
            costPerKg: "15",
          })
          .returning();
        await EquipmentTransactionService.createTransactionAndUpdateEquipment(
          tx,
          equipment.id,
          TRANSACTION_TYPE.RECEIPT,
          productType,
          SOURCE_TYPE.MOVEMENT,
          equipmentMovementRow.id,
          40,
          600,
          undefined,
          testDates.laterReceipt,
        );
        const [equipmentRefueling] = await tx
          .insert(aircraftRefueling)
          .values({
            refuelingDate: testDates.laterSale,
            productType,
            supplierId: supplier.id,
            buyerId: customer.id,
            equipmentId: equipment.id,
            quantityKg: "10",
            purchasePrice: "10",
            purchaseAmount: "100",
            salePrice: "20",
            saleAmount: "200",
            agentFee: "5",
            isAgentFeeEnabled: true,
            otherServiceFee: "3",
            isOtherServiceEnabled: true,
            profit: "92",
            isDraft: false,
          })
          .returning({ id: aircraftRefueling.id });
        const equipmentRefuelingTransaction =
          await EquipmentTransactionService.createTransactionAndUpdateEquipment(
            tx,
            equipment.id,
            TRANSACTION_TYPE.SALE,
            productType,
            SOURCE_TYPE.REFUELING,
            equipmentRefueling.id,
            10,
            0,
            undefined,
            testDates.laterSale,
          );
        await tx
          .update(aircraftRefueling)
          .set({ equipmentTransactionId: equipmentRefuelingTransaction.id })
          .where(eq(aircraftRefueling.id, equipmentRefueling.id));

        const [equipmentTransferWarehouse] = await tx
          .insert(warehouses)
          .values({
            name: `restore-equipment-chain-warehouse-${productType}-${crypto.randomUUID()}`,
            currentBalance: isPvkj ? "0" : "10",
            averageCost: isPvkj ? "0" : "8",
            pvkjBalance: isPvkj ? "10" : "0",
            pvkjAverageCost: isPvkj ? "8" : "0",
          })
          .returning();
        await tx.insert(warehouseTransactions).values({
          warehouseId: equipmentTransferWarehouse.id,
          transactionType: TRANSACTION_TYPE.INVENTORY,
          productType,
          quantity: "10",
          balanceBefore: "0",
          balanceAfter: "10",
          averageCostBefore: "0",
          averageCostAfter: "8",
          sum: "80",
          transactionDate: testDates.opening,
        });
        const [equipmentToWarehouseTransfer] = await tx
          .insert(equipmentMovement)
          .values({
            movementDate: testDates.warehouseTransfer,
            movementType: "tzk_to_storage",
            productType,
            fromEquipmentId: equipment.id,
            toWarehouseId: equipmentTransferWarehouse.id,
            quantityKg: "20",
            totalCost: "200",
            costPerKg: "10",
          })
          .returning();
        await EquipmentTransactionService.createTransactionAndUpdateEquipment(
          tx,
          equipment.id,
          TRANSACTION_TYPE.TRANSFER_OUT,
          productType,
          SOURCE_TYPE.MOVEMENT,
          equipmentToWarehouseTransfer.id,
          20,
          200,
          undefined,
          testDates.warehouseTransfer,
        );
        await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
          tx,
          equipmentTransferWarehouse.id,
          TRANSACTION_TYPE.TRANSFER_IN,
          productType,
          SOURCE_TYPE.MOVEMENT,
          equipmentToWarehouseTransfer.id,
          20,
          200,
          undefined,
          testDates.warehouseTransfer,
        );

        // Add a downstream warehouse -> warehouse -> equipment chain. Restoring
        // the old sale changes the quantity remaining at the later receipt,
        // which changes its average cost and must flow through both transfers.
        const [receivingWarehouse] = await tx
          .insert(warehouses)
          .values({
            name: `restore-chain-warehouse-${productType}-${crypto.randomUUID()}`,
            currentBalance: isPvkj ? "0" : "10",
            averageCost: isPvkj ? "0" : "8",
            pvkjBalance: isPvkj ? "10" : "0",
            pvkjAverageCost: isPvkj ? "8" : "0",
          })
          .returning();
        const [receivingEquipment] = await tx
          .insert(equipments)
          .values({
            name: `restore-chain-equipment-${productType}-${crypto.randomUUID()}`,
            currentBalance: isPvkj ? "0" : "5",
            averageCost: isPvkj ? "0" : "12",
            pvkjBalance: isPvkj ? "5" : "0",
            pvkjAverageCost: isPvkj ? "12" : "0",
          })
          .returning();

        await tx.insert(warehouseTransactions).values({
          warehouseId: receivingWarehouse.id,
          transactionType: TRANSACTION_TYPE.INVENTORY,
          productType,
          quantity: "10",
          balanceBefore: "0",
          balanceAfter: "10",
          averageCostBefore: "0",
          averageCostAfter: "8",
          sum: "80",
          transactionDate: testDates.opening,
        });
        await tx.insert(equipmentTransactions).values({
          equipmentId: receivingEquipment.id,
          transactionType: TRANSACTION_TYPE.INVENTORY,
          productType,
          quantity: "5",
          balanceBefore: "0",
          balanceAfter: "5",
          averageCostBefore: "0",
          averageCostAfter: "12",
          sum: "60",
          transactionDate: testDates.opening,
        });

        const [warehouseTransfer] = await tx
          .insert(movement)
          .values({
            movementDate: testDates.warehouseTransfer,
            movementType: "transfer",
            productType,
            fromWarehouseId: warehouse.id,
            toWarehouseId: receivingWarehouse.id,
            quantityKg: "20",
            totalCost: "200",
            purchasePrice: "10",
            costPerKg: "10",
          })
          .returning();
        await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
          tx,
          warehouse.id,
          TRANSACTION_TYPE.TRANSFER_OUT,
          productType,
          SOURCE_TYPE.MOVEMENT,
          warehouseTransfer.id,
          20,
          200,
          undefined,
          testDates.warehouseTransfer,
        );
        await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
          tx,
          receivingWarehouse.id,
          TRANSACTION_TYPE.TRANSFER_IN,
          productType,
          SOURCE_TYPE.MOVEMENT,
          warehouseTransfer.id,
          20,
          200,
          undefined,
          testDates.warehouseTransfer,
        );

        const [equipmentTransfer] = await tx
          .insert(equipmentMovement)
          .values({
            movementDate: testDates.equipmentTransfer,
            movementType: "storage_to_tzk",
            productType,
            fromWarehouseId: receivingWarehouse.id,
            toEquipmentId: receivingEquipment.id,
            quantityKg: "10",
            totalCost: "100",
            costPerKg: "10",
          })
          .returning();
        await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
          tx,
          receivingWarehouse.id,
          TRANSACTION_TYPE.TRANSFER_OUT,
          productType,
          SOURCE_TYPE.MOVEMENT,
          equipmentTransfer.id,
          10,
          100,
          undefined,
          testDates.equipmentTransfer,
        );
        await EquipmentTransactionService.createTransactionAndUpdateEquipment(
          tx,
          receivingEquipment.id,
          TRANSACTION_TYPE.TRANSFER_IN,
          productType,
          SOURCE_TYPE.MOVEMENT,
          equipmentTransfer.id,
          10,
          100,
          undefined,
          testDates.equipmentTransfer,
        );

        // These refuelings happen after the full transfer chain and must be
        // repriced when restoring the earlier sale changes the source cost.
        const [downstreamWarehouseRefueling] = await tx
          .insert(aircraftRefueling)
          .values({
            refuelingDate: testDates.downstreamSale,
            productType,
            supplierId: supplier.id,
            buyerId: customer.id,
            warehouseId: receivingWarehouse.id,
            quantityKg: "10",
            purchasePrice: "10",
            purchaseAmount: "100",
            salePrice: "20",
            saleAmount: "200",
            agentFee: "5",
            isAgentFeeEnabled: true,
            otherServiceFee: "3",
            isOtherServiceEnabled: true,
            profit: "92",
            isDraft: false,
          })
          .returning({ id: aircraftRefueling.id });
        const { transaction: downstreamWarehouseRefuelingTransaction } =
          await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
            tx,
            receivingWarehouse.id,
            TRANSACTION_TYPE.SALE,
            productType,
            SOURCE_TYPE.REFUELING,
            downstreamWarehouseRefueling.id,
            10,
            0,
            undefined,
            testDates.downstreamSale,
          );
        await tx
          .update(aircraftRefueling)
          .set({ transactionId: downstreamWarehouseRefuelingTransaction.id })
          .where(eq(aircraftRefueling.id, downstreamWarehouseRefueling.id));

        const [downstreamEquipmentRefueling] = await tx
          .insert(aircraftRefueling)
          .values({
            refuelingDate: testDates.downstreamSale,
            productType,
            supplierId: supplier.id,
            buyerId: customer.id,
            equipmentId: receivingEquipment.id,
            quantityKg: "10",
            purchasePrice: "10",
            purchaseAmount: "100",
            salePrice: "20",
            saleAmount: "200",
            agentFee: "5",
            isAgentFeeEnabled: true,
            otherServiceFee: "3",
            isOtherServiceEnabled: true,
            profit: "92",
            isDraft: false,
          })
          .returning({ id: aircraftRefueling.id });
        const downstreamEquipmentRefuelingTransaction =
          await EquipmentTransactionService.createTransactionAndUpdateEquipment(
            tx,
            receivingEquipment.id,
            TRANSACTION_TYPE.SALE,
            productType,
            SOURCE_TYPE.REFUELING,
            downstreamEquipmentRefueling.id,
            10,
            0,
            undefined,
            testDates.downstreamSale,
          );
        await tx
          .update(aircraftRefueling)
          .set({
            equipmentTransactionId: downstreamEquipmentRefuelingTransaction.id,
          })
          .where(eq(aircraftRefueling.id, downstreamEquipmentRefueling.id));

        // Force the simultaneous transfer receipt to sort later by creation
        // time. The stock recalculation must still process it before the sale.
        const [refuelingTx] = await tx
          .select({
            createdAt: equipmentTransactions.createdAt,
            transactionDate: equipmentTransactions.transactionDate,
          })
          .from(equipmentTransactions)
          .where(eq(equipmentTransactions.id, downstreamEquipmentRefuelingTransaction.id));
        assert.ok(refuelingTx, "downstream equipment refueling transaction must exist");
        assert.ok(refuelingTx.transactionDate, "equipment refueling must have a business timestamp");
        assert.equal(
          new Date(refuelingTx.transactionDate).getTime(),
          new Date(testDates.downstreamSale).getTime(),
          "equipment refueling must use the transfer's business timestamp",
        );
        const [sameTimeTransferIn] = await tx
          .update(equipmentTransactions)
          .set({
            createdAt: new Date(
              new Date(refuelingTx.createdAt).getTime() + 1_000,
            ).toISOString(),
          })
          .where(
            and(
              eq(equipmentTransactions.sourceId, equipmentTransfer.id),
              eq(equipmentTransactions.equipmentId, receivingEquipment.id),
              eq(equipmentTransactions.transactionType, TRANSACTION_TYPE.TRANSFER_IN),
            ),
          )
          .returning({
            createdAt: equipmentTransactions.createdAt,
            transactionDate: equipmentTransactions.transactionDate,
          });
        assert.ok(sameTimeTransferIn, "same-time transfer receipt must exist");
        assert.ok(
          sameTimeTransferIn.transactionDate,
          "equipment transfer receipt must have a business timestamp",
        );
        assert.equal(
          new Date(sameTimeTransferIn.transactionDate).getTime(),
          new Date(testDates.downstreamSale).getTime(),
          "equipment transfer receipt and refueling must share the business timestamp",
        );
        assert.ok(
          new Date(sameTimeTransferIn.createdAt).getTime() >
            new Date(refuelingTx.createdAt).getTime(),
          "the transfer receipt must have a later creation timestamp than the sale",
        );

        // Restore the original refueling stock movements after the newer activity.
        await WarehouseTransactionService.restoreTransactionAndRecalculateWarehouse(
          tx,
          oldWarehouseSale.id,
        );
        await EquipmentTransactionService.restoreTransactionAndRecalculateEquipment(
          tx,
          oldEquipmentSale.id,
        );

        // Run the same chain recalculation that the queued workers perform.
        await WarehouseRecalculationService.recalculateAllAffectedTransactions(
          tx,
          [{
            warehouseId: warehouse.id,
            afterDate: testDates.oldOrder,
            productType,
          }],
        );
        await EquipmentRecalculationService.recalculateEquipmentFromDate(
          tx,
          equipment.id,
          testDates.oldOrder,
          productType,
        );

        const refreshedWarehouse = await tx.query.warehouses.findFirst({
          where: eq(warehouses.id, warehouse.id),
        });
        const refreshedEquipment = await tx
          .select()
          .from(equipments)
          .where(eq(equipments.id, equipment.id));
        const warehouseBalance = Number(
          isPvkj ? refreshedWarehouse?.pvkjBalance : refreshedWarehouse?.currentBalance,
        );
        const warehouseAverageCost = Number(
          isPvkj ? refreshedWarehouse?.pvkjAverageCost : refreshedWarehouse?.averageCost,
        );
        const equipmentBalance = Number(
          isPvkj ? refreshedEquipment[0]?.pvkjBalance : refreshedEquipment[0]?.currentBalance,
        );
        const equipmentAverageCost = Number(
          isPvkj ? refreshedEquipment[0]?.pvkjAverageCost : refreshedEquipment[0]?.averageCost,
        );

        assert.equal(warehouseBalance, 90, `warehouse ${productType} balance`);
        assert.equal(equipmentBalance, 90, `equipment ${productType} balance`);
        assert.ok(
          Math.abs(warehouseAverageCost - 11.666667) < 0.000001,
          `warehouse ${productType} average cost: ${warehouseAverageCost}`,
        );
        assert.ok(
          Math.abs(equipmentAverageCost - 11.6667) < 0.0001,
          `equipment ${productType} average cost: ${equipmentAverageCost}`,
        );

        const refreshedReceivingWarehouse =
          await tx.query.warehouses.findFirst({
            where: eq(warehouses.id, receivingWarehouse.id),
          });
        const refreshedReceivingEquipment =
          await tx.query.equipments.findFirst({
            where: eq(equipments.id, receivingEquipment.id),
          });
        const downstreamWarehouseBalance = Number(
          isPvkj
            ? refreshedReceivingWarehouse?.pvkjBalance
            : refreshedReceivingWarehouse?.currentBalance,
        );
        const downstreamWarehouseAverageCost = Number(
          isPvkj
            ? refreshedReceivingWarehouse?.pvkjAverageCost
            : refreshedReceivingWarehouse?.averageCost,
        );
        const downstreamEquipmentBalance = Number(
          isPvkj
            ? refreshedReceivingEquipment?.pvkjBalance
            : refreshedReceivingEquipment?.currentBalance,
        );
        const downstreamEquipmentAverageCost = Number(
          isPvkj
            ? refreshedReceivingEquipment?.pvkjAverageCost
            : refreshedReceivingEquipment?.averageCost,
        );

        assert.equal(
          downstreamWarehouseBalance,
          20,
          `downstream warehouse ${productType} balance after transfer cascade`,
        );
        assert.ok(
          Math.abs(downstreamWarehouseAverageCost - 10.444333) < 0.00001,
          `downstream warehouse ${productType} average cost: ${downstreamWarehouseAverageCost}`,
        );
        assert.equal(
          downstreamEquipmentBalance,
          15,
          `downstream equipment ${productType} balance after transfer cascade`,
        );
        assert.ok(
          Math.abs(downstreamEquipmentAverageCost - 10.963) < 0.001,
          `downstream equipment ${productType} average cost: ${downstreamEquipmentAverageCost}`,
        );

        const refreshedEquipmentTransferWarehouse =
          await tx.query.warehouses.findFirst({
            where: eq(warehouses.id, equipmentTransferWarehouse.id),
          });
        const equipmentToWarehouseBalance = Number(
          isPvkj
            ? refreshedEquipmentTransferWarehouse?.pvkjBalance
            : refreshedEquipmentTransferWarehouse?.currentBalance,
        );
        const equipmentToWarehouseAverageCost = Number(
          isPvkj
            ? refreshedEquipmentTransferWarehouse?.pvkjAverageCost
            : refreshedEquipmentTransferWarehouse?.averageCost,
        );
        assert.equal(
          equipmentToWarehouseBalance,
          30,
          `warehouse receiving fuel from equipment ${productType} balance`,
        );
        assert.ok(
          Math.abs(equipmentToWarehouseAverageCost - 10.444333) < 0.00001,
          `warehouse receiving fuel from equipment ${productType} average cost: ${equipmentToWarehouseAverageCost}`,
        );

        const updatedWarehouseTransfer =
          await tx.query.movement.findFirst({
            where: eq(movement.id, warehouseTransfer.id),
          });
        const updatedEquipmentTransfer =
          await tx.query.equipmentMovement.findFirst({
            where: eq(equipmentMovement.id, equipmentTransfer.id),
          });
        const updatedEquipmentToWarehouseTransfer =
          await tx.query.equipmentMovement.findFirst({
            where: eq(equipmentMovement.id, equipmentToWarehouseTransfer.id),
          });
        assert.ok(
          Math.abs(Number(updatedWarehouseTransfer?.totalCost) - 233.33) < 0.01,
          `warehouse transfer cost should follow restored source average cost: ${updatedWarehouseTransfer?.totalCost}`,
        );
        assert.ok(
          Math.abs(Number(updatedEquipmentTransfer?.totalCost) - 104.44) < 0.01,
          `equipment transfer cost should follow recalculated warehouse average cost: ${updatedEquipmentTransfer?.totalCost}`,
        );
        assert.ok(
          Math.abs(Number(updatedEquipmentToWarehouseTransfer?.totalCost) - 233.33) < 0.01,
          `warehouse transfer cost should follow restored equipment average cost: ${updatedEquipmentToWarehouseTransfer?.totalCost}`,
        );

        const [updatedDownstreamWarehouseRefueling] = await tx
          .select({
            purchasePrice: aircraftRefueling.purchasePrice,
            purchaseAmount: aircraftRefueling.purchaseAmount,
            profit: aircraftRefueling.profit,
          })
          .from(aircraftRefueling)
          .where(eq(aircraftRefueling.id, downstreamWarehouseRefueling.id));
        assert.ok(
          Math.abs(Number(updatedDownstreamWarehouseRefueling?.purchasePrice) - 10.444333) < 0.00001,
          `downstream warehouse refueling purchase price (${productType}): ${updatedDownstreamWarehouseRefueling?.purchasePrice}`,
        );
        assert.equal(
          Number(updatedDownstreamWarehouseRefueling?.purchaseAmount),
          104.44,
          `downstream warehouse refueling purchase amount (${productType})`,
        );
        assert.equal(
          Number(updatedDownstreamWarehouseRefueling?.profit),
          87.56,
          `downstream warehouse refueling profit (${productType})`,
        );

        const [updatedDownstreamEquipmentRefueling] = await tx
          .select({
            purchasePrice: aircraftRefueling.purchasePrice,
            purchaseAmount: aircraftRefueling.purchaseAmount,
            profit: aircraftRefueling.profit,
          })
          .from(aircraftRefueling)
          .where(eq(aircraftRefueling.id, downstreamEquipmentRefueling.id));
        assert.ok(
          Math.abs(Number(updatedDownstreamEquipmentRefueling?.purchasePrice) - 10.962667) < 0.00001,
          `downstream equipment refueling purchase price (${productType}): ${updatedDownstreamEquipmentRefueling?.purchasePrice}`,
        );
        assert.equal(
          Number(updatedDownstreamEquipmentRefueling?.purchaseAmount),
          109.63,
          `downstream equipment refueling purchase amount (${productType})`,
        );
        assert.equal(
          Number(updatedDownstreamEquipmentRefueling?.profit),
          82.37,
          `downstream equipment refueling profit (${productType})`,
        );

        const restoredWarehouseTx = await tx.query.warehouseTransactions.findFirst({
          where: eq(warehouseTransactions.id, oldWarehouseSale.id),
        });
        const restoredEquipmentTx = await tx
          .select()
          .from(equipmentTransactions)
          .where(eq(equipmentTransactions.id, oldEquipmentSale.id));
        assert.equal(restoredWarehouseTx?.deletedAt, null);
        assert.equal(restoredEquipmentTx[0]?.deletedAt, null);

        for (const scenario of refuelingFeeScenarios) {
          if (!scenario.agentFeeEnabled || !scenario.otherServiceEnabled) {
            await tx
              .update(aircraftRefueling)
              .set({
                isAgentFeeEnabled: scenario.agentFeeEnabled,
                isOtherServiceEnabled: scenario.otherServiceEnabled,
              })
              .where(eq(aircraftRefueling.id, warehouseRefueling.id));
            await tx
              .update(aircraftRefueling)
              .set({
                isAgentFeeEnabled: scenario.agentFeeEnabled,
                isOtherServiceEnabled: scenario.otherServiceEnabled,
              })
              .where(eq(aircraftRefueling.id, equipmentRefueling.id));

            // Repeat the late-movement recalculation after changing fee flags so
            // both warehouse and equipment refuelings exercise the same update path.
            await WarehouseRecalculationService.recalculateAllAffectedTransactions(
              tx,
              [{
                warehouseId: warehouse.id,
                afterDate: testDates.oldOrder,
                productType,
              }],
            );
            await EquipmentRecalculationService.recalculateEquipmentFromDate(
              tx,
              equipment.id,
              testDates.oldOrder,
              productType,
            );
          }

          const [refreshedWarehouseRefueling] = await tx
            .select({
              purchasePrice: aircraftRefueling.purchasePrice,
              purchaseAmount: aircraftRefueling.purchaseAmount,
              profit: aircraftRefueling.profit,
            })
            .from(aircraftRefueling)
            .where(eq(aircraftRefueling.id, warehouseRefueling.id));
          const [refreshedEquipmentRefueling] = await tx
            .select({
              purchasePrice: aircraftRefueling.purchasePrice,
              purchaseAmount: aircraftRefueling.purchaseAmount,
              profit: aircraftRefueling.profit,
            })
            .from(aircraftRefueling)
            .where(eq(aircraftRefueling.id, equipmentRefueling.id));

          for (const [label, refueling] of [
            ["warehouse", refreshedWarehouseRefueling],
            ["equipment", refreshedEquipmentRefueling],
          ] as const) {
            assert.equal(
              Number(refueling?.purchasePrice),
              11.666667,
              `${label} refueling purchase price (${scenario.label})`,
            );
            assert.equal(
              Number(refueling?.purchaseAmount),
              116.67,
              `${label} refueling purchase amount (${scenario.label})`,
            );
            assert.equal(
              Number(refueling?.profit),
              scenario.expectedProfit,
              `${label} refueling profit (${scenario.label})`,
            );
          }
        }

        const changedFeeAmountScenarios = [
          {
            label: "agent fee amount changed",
            agentFee: "9",
            otherServiceFee: "3",
            expectedProfit: 71.33,
          },
          {
            label: "other service fee amount changed",
            agentFee: "5",
            otherServiceFee: "7",
            expectedProfit: 71.33,
          },
          {
            label: "both fee amounts changed",
            agentFee: "9",
            otherServiceFee: "7",
            expectedProfit: 67.33,
          },
        ] as const;

        for (const scenario of changedFeeAmountScenarios) {
          for (const refuelingId of [
            warehouseRefueling.id,
            equipmentRefueling.id,
          ]) {
            await tx
              .update(aircraftRefueling)
              .set({
                agentFee: scenario.agentFee,
                isAgentFeeEnabled: true,
                otherServiceFee: scenario.otherServiceFee,
                isOtherServiceEnabled: true,
              })
              .where(eq(aircraftRefueling.id, refuelingId));
          }

          // Exercise a later stock-chain recalculation after the saved fee
          // amounts change, for both warehouse and equipment refuelings.
          await WarehouseRecalculationService.recalculateAllAffectedTransactions(
            tx,
            [{
              warehouseId: warehouse.id,
              afterDate: testDates.oldOrder,
              productType,
            }],
          );
          await EquipmentRecalculationService.recalculateEquipmentFromDate(
            tx,
            equipment.id,
            testDates.oldOrder,
            productType,
          );

          const [refreshedWarehouseRefueling] = await tx
            .select({
              purchasePrice: aircraftRefueling.purchasePrice,
              purchaseAmount: aircraftRefueling.purchaseAmount,
              profit: aircraftRefueling.profit,
            })
            .from(aircraftRefueling)
            .where(eq(aircraftRefueling.id, warehouseRefueling.id));
          const [refreshedEquipmentRefueling] = await tx
            .select({
              purchasePrice: aircraftRefueling.purchasePrice,
              purchaseAmount: aircraftRefueling.purchaseAmount,
              profit: aircraftRefueling.profit,
            })
            .from(aircraftRefueling)
            .where(eq(aircraftRefueling.id, equipmentRefueling.id));

          for (const [label, refueling] of [
            ["warehouse", refreshedWarehouseRefueling],
            ["equipment", refreshedEquipmentRefueling],
          ] as const) {
            assert.equal(
              Number(refueling?.purchasePrice),
              11.666667,
              `${label} refueling purchase price (${scenario.label})`,
            );
            assert.equal(
              Number(refueling?.purchaseAmount),
              116.67,
              `${label} refueling purchase amount (${scenario.label})`,
            );
            assert.equal(
              Number(refueling?.profit),
              scenario.expectedProfit,
              `${label} refueling profit (${scenario.label})`,
            );
          }
        }
        assert.ok(openingWarehouseTx && openingEquipmentTx);
      }

      // Force rollback so this integration test leaves no persistent fixtures or queue entries.
      throw rollbackMarker;
    });
    assert.fail("The fixture transaction should have been rolled back.");
  } catch (error) {
    if (error !== rollbackMarker) throw error;
  }
});

test("refueling recalculation excludes disabled fees from profit", async () => {
  for (const scenario of refuelingFeeScenarios) {
    let updatedRefueling: Record<string, unknown> | undefined;
    const refuelingId = `refueling-${scenario.label}`;
    const tx = {
      query: {
        aircraftRefueling: {
          findFirst: async () => ({
            id: refuelingId,
            productType: PRODUCT_TYPE.KEROSENE,
            quantityKg: "10",
            salePrice: "20",
            agentFee: "5",
            isAgentFeeEnabled: scenario.agentFeeEnabled,
            otherServiceFee: "3",
            isOtherServiceEnabled: scenario.otherServiceEnabled,
          }),
        },
      },
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            updatedRefueling = values;
          },
        }),
      }),
    };

    await WarehouseRecalculationService.updateRelatedDeal(
      tx,
      SOURCE_TYPE.REFUELING,
      refuelingId,
      11.666667,
    );

    assert.equal(
      Number(updatedRefueling?.purchasePrice),
      11.666667,
      `${scenario.label} purchase price`,
    );
    assert.equal(
      Number(updatedRefueling?.purchaseAmount),
      116.67,
      `${scenario.label} purchase amount`,
    );
    assert.equal(
      Number(updatedRefueling?.profit),
      scenario.expectedProfit,
      `${scenario.label} profit`,
    );
  }
});

test("late refueling recalculation uses the latest saved fee amounts", async () => {
  const scenarios = [
    { label: "agent fee changed", agentFee: "9", otherServiceFee: "3", expectedProfit: 71.33 },
    { label: "other service fee changed", agentFee: "5", otherServiceFee: "7", expectedProfit: 71.33 },
    { label: "both fees changed", agentFee: "9", otherServiceFee: "7", expectedProfit: 67.33 },
  ] as const;

  for (const scenario of scenarios) {
    let updatedRefueling: Record<string, unknown> | undefined;
    const tx = {
      query: {
        aircraftRefueling: {
          findFirst: async () => ({
            id: scenario.label,
            productType: PRODUCT_TYPE.KEROSENE,
            quantityKg: "10",
            salePrice: "20",
            agentFee: scenario.agentFee,
            isAgentFeeEnabled: true,
            otherServiceFee: scenario.otherServiceFee,
            isOtherServiceEnabled: true,
          }),
        },
      },
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            updatedRefueling = values;
          },
        }),
      }),
    };

    await WarehouseRecalculationService.updateRelatedDeal(
      tx,
      SOURCE_TYPE.REFUELING,
      scenario.label,
      11.666667,
    );

    assert.equal(Number(updatedRefueling?.purchasePrice), 11.666667);
    assert.equal(Number(updatedRefueling?.purchaseAmount), 116.67);
    assert.equal(
      Number(updatedRefueling?.profit),
      scenario.expectedProfit,
      `${scenario.label} profit`,
    );
  }
});

test("restoring an older sale preserves delivery and storage costs in shared warehouse transfers", async (t) => {
  const rollbackMarker = new Error("Rollback integration-test fixtures");

  try {
    await db.transaction(async (tx) => {
      const productType = PRODUCT_TYPE.KEROSENE;
      const sourceSpecs = [
        {
          openingBalance: 100,
          openingCost: 10,
          oldSale: 20,
          receiptQty: 40,
          receiptPrice: 15,
          deliveryCost: 12.34,
          storageCost: 5.67,
        },
        {
          openingBalance: 80,
          openingCost: 20,
          oldSale: 10,
          receiptQty: 20,
          receiptPrice: 30,
          deliveryCost: 23.45,
          storageCost: 6.78,
        },
      ];

      for (const sourceOrder of [[0, 1], [1, 0]]) {
        const fixtureId = crypto.randomUUID();
        const openingDate = "2026-02-01T10:00:00.000Z";
        const oldSaleDate = "2026-02-02T10:00:00.000Z";
        const receiptDate = "2026-02-03T10:00:00.000Z";
        const transferDate = "2026-02-04T10:00:00.000Z";

        const [destination] = await tx
          .insert(warehouses)
          .values({
            name: `shared-destination-${fixtureId}`,
            currentBalance: "10",
            averageCost: "4",
            pvkjBalance: "0",
            pvkjAverageCost: "0",
          })
          .returning();
        await tx.insert(warehouseTransactions).values({
          warehouseId: destination.id,
          transactionType: TRANSACTION_TYPE.INVENTORY,
          productType,
          quantity: "10",
          balanceBefore: "0",
          balanceAfter: "10",
          averageCostBefore: "0",
          averageCostAfter: "4",
          sum: "40",
          transactionDate: openingDate,
        });

        const sources: Array<{ warehouseId: string; oldSaleId: string }> = [];
        for (const [index, spec] of sourceSpecs.entries()) {
          const [source] = await tx
            .insert(warehouses)
            .values({
              name: `shared-source-${fixtureId}-${index}`,
              currentBalance: String(spec.openingBalance),
              averageCost: String(spec.openingCost),
              pvkjBalance: "0",
              pvkjAverageCost: "0",
            })
            .returning();
          await tx.insert(warehouseTransactions).values({
            warehouseId: source.id,
            transactionType: TRANSACTION_TYPE.INVENTORY,
            productType,
            quantity: String(spec.openingBalance),
            balanceBefore: "0",
            balanceAfter: String(spec.openingBalance),
            averageCostBefore: "0",
            averageCostAfter: String(spec.openingCost),
            sum: String(spec.openingBalance * spec.openingCost),
            transactionDate: openingDate,
          });

          const { transaction: oldSale } =
            await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
              tx,
              source.id,
              TRANSACTION_TYPE.SALE,
              productType,
              SOURCE_TYPE.MOVEMENT,
              crypto.randomUUID(),
              spec.oldSale,
              0,
              undefined,
              oldSaleDate,
            );
          await WarehouseTransactionService.deleteTransactionAndRevertWarehouse(
            tx,
            oldSale.id,
          );

          const [supply] = await tx
            .insert(movement)
            .values({
              movementDate: receiptDate,
              movementType: "supply",
              productType,
              toWarehouseId: source.id,
              quantityKg: String(spec.receiptQty),
              totalCost: String(spec.receiptQty * spec.receiptPrice),
              purchasePrice: String(spec.receiptPrice),
              costPerKg: String(spec.receiptPrice),
            })
            .returning();
          await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
            tx,
            source.id,
            TRANSACTION_TYPE.RECEIPT,
            productType,
            SOURCE_TYPE.MOVEMENT,
            supply.id,
            spec.receiptQty,
            spec.receiptQty * spec.receiptPrice,
            undefined,
            receiptDate,
          );

          const staleAverageCost =
            (spec.openingBalance * spec.openingCost +
              spec.receiptQty * spec.receiptPrice) /
            (spec.openingBalance + spec.receiptQty);
          const [transfer] = await tx
            .insert(movement)
            .values({
              movementDate: transferDate,
              movementType: "transfer",
              productType,
              fromWarehouseId: source.id,
              toWarehouseId: destination.id,
              quantityKg: "10",
              totalCost: (10 * staleAverageCost).toFixed(2),
              purchasePrice: staleAverageCost.toFixed(6),
              costPerKg: staleAverageCost.toFixed(6),
              deliveryCost: String(spec.deliveryCost),
              storageCost: String(spec.storageCost),
            })
            .returning();
          await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
            tx,
            source.id,
            TRANSACTION_TYPE.TRANSFER_OUT,
            productType,
            SOURCE_TYPE.MOVEMENT,
            transfer.id,
            10,
            0,
            undefined,
            transferDate,
          );
          await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
            tx,
            destination.id,
            TRANSACTION_TYPE.TRANSFER_IN,
            productType,
            SOURCE_TYPE.MOVEMENT,
            transfer.id,
            10,
            Number(transfer.totalCost),
            undefined,
            transferDate,
          );
          sources.push({ warehouseId: source.id, oldSaleId: oldSale.id });
        }

        for (const source of sources) {
          await WarehouseTransactionService.restoreTransactionAndRecalculateWarehouse(
            tx,
            source.oldSaleId,
          );
        }

        await WarehouseRecalculationService.recalculateAllAffectedTransactions(
          tx,
          sourceOrder.map((index) => ({
            warehouseId: sources[index].warehouseId,
            afterDate: oldSaleDate,
            productType,
          })),
        );

        const refreshedDestination = await tx.query.warehouses.findFirst({
          where: eq(warehouses.id, destination.id),
        });
        assert.equal(Number(refreshedDestination?.currentBalance), 30);
        assert.ok(
          Math.abs(Number(refreshedDestination?.averageCost) - 14.237667) < 0.000001,
          `destination average cost in source order ${sourceOrder.join("→")}: ${refreshedDestination?.averageCost}`,
        );

        const transferRows = await tx
          .select({
            totalCost: movement.totalCost,
            deliveryCost: movement.deliveryCost,
            storageCost: movement.storageCost,
          })
          .from(movement)
          .where(eq(movement.toWarehouseId, destination.id));
        assert.deepEqual(
          transferRows
            .map((row) => ({
              totalCost: Number(row.totalCost),
              deliveryCost: Number(row.deliveryCost),
              storageCost: Number(row.storageCost),
            }))
            .sort((a, b) => a.totalCost - b.totalCost),
          [
            { totalCost: 134.68, deliveryCost: 12.34, storageCost: 5.67 },
            { totalCost: 252.45, deliveryCost: 23.45, storageCost: 6.78 },
          ],
          `recalculated movement costs preserve delivery and storage expenses in source order ${sourceOrder.join("→")}`,
        );
      }

      const equipmentSourceSpecs = [
        {
          openingBalance: 100,
          openingCost: 10,
          oldSale: 20,
          receiptQty: 40,
          receiptPrice: 15,
          transferQty: 10,
        },
        {
          openingBalance: 80,
          openingCost: 20,
          oldSale: 10,
          receiptQty: 20,
          receiptPrice: 30,
          transferQty: 10,
        },
      ];

      for (const sourceOrder of [[0, 1], [1, 0]]) {
        const fixtureId = crypto.randomUUID();
        const openingDate = "2026-03-01T10:00:00.000Z";
        const oldSaleDate = "2026-03-02T10:00:00.000Z";
        const receiptDate = "2026-03-03T10:00:00.000Z";
        const transferDates = [
          "2026-03-04T10:00:00.000Z",
          "2026-03-05T10:00:00.000Z",
        ];

        const [destination] = await tx
          .insert(equipments)
          .values({
            name: `shared-equipment-destination-${fixtureId}`,
            currentBalance: "5",
            averageCost: "12",
            pvkjBalance: "0",
            pvkjAverageCost: "0",
          })
          .returning();
        await tx.insert(equipmentTransactions).values({
          equipmentId: destination.id,
          transactionType: TRANSACTION_TYPE.INVENTORY,
          productType,
          quantity: "5",
          balanceBefore: "0",
          balanceAfter: "5",
          averageCostBefore: "0",
          averageCostAfter: "12",
          sum: "60",
          transactionDate: openingDate,
        });

        const sources: Array<{
          warehouseId: string;
          oldSaleId: string;
          movementId: string;
        }> = [];
        for (const [index, spec] of equipmentSourceSpecs.entries()) {
          const [source] = await tx
            .insert(warehouses)
            .values({
              name: `shared-equipment-source-${fixtureId}-${index}`,
              currentBalance: String(spec.openingBalance),
              averageCost: String(spec.openingCost),
              pvkjBalance: "0",
              pvkjAverageCost: "0",
            })
            .returning();
          await tx.insert(warehouseTransactions).values({
            warehouseId: source.id,
            transactionType: TRANSACTION_TYPE.INVENTORY,
            productType,
            quantity: String(spec.openingBalance),
            balanceBefore: "0",
            balanceAfter: String(spec.openingBalance),
            averageCostBefore: "0",
            averageCostAfter: String(spec.openingCost),
            sum: String(spec.openingBalance * spec.openingCost),
            transactionDate: openingDate,
          });

          const { transaction: oldSale } =
            await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
              tx,
              source.id,
              TRANSACTION_TYPE.SALE,
              productType,
              SOURCE_TYPE.MOVEMENT,
              crypto.randomUUID(),
              spec.oldSale,
              0,
              undefined,
              oldSaleDate,
            );
          await WarehouseTransactionService.deleteTransactionAndRevertWarehouse(
            tx,
            oldSale.id,
          );

          const [supply] = await tx
            .insert(movement)
            .values({
              movementDate: receiptDate,
              movementType: "supply",
              productType,
              toWarehouseId: source.id,
              quantityKg: String(spec.receiptQty),
              totalCost: String(spec.receiptQty * spec.receiptPrice),
              purchasePrice: String(spec.receiptPrice),
              costPerKg: String(spec.receiptPrice),
            })
            .returning();
          await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
            tx,
            source.id,
            TRANSACTION_TYPE.RECEIPT,
            productType,
            SOURCE_TYPE.MOVEMENT,
            supply.id,
            spec.receiptQty,
            spec.receiptQty * spec.receiptPrice,
            undefined,
            receiptDate,
          );

          const staleAverageCost =
            (spec.openingBalance * spec.openingCost +
              spec.receiptQty * spec.receiptPrice) /
            (spec.openingBalance + spec.receiptQty);
          const [transfer] = await tx
            .insert(equipmentMovement)
            .values({
              movementDate: transferDates[index],
              movementType: "storage_to_tzk",
              productType,
              fromWarehouseId: source.id,
              toEquipmentId: destination.id,
              quantityKg: String(spec.transferQty),
              totalCost: (spec.transferQty * staleAverageCost).toFixed(2),
              costPerKg: staleAverageCost.toFixed(5),
            })
            .returning();
          await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
            tx,
            source.id,
            TRANSACTION_TYPE.TRANSFER_OUT,
            productType,
            SOURCE_TYPE.MOVEMENT,
            transfer.id,
            spec.transferQty,
            0,
            undefined,
            transferDates[index],
          );
          await EquipmentTransactionService.createTransactionAndUpdateEquipment(
            tx,
            destination.id,
            TRANSACTION_TYPE.TRANSFER_IN,
            productType,
            SOURCE_TYPE.MOVEMENT,
            transfer.id,
            spec.transferQty,
            Number(transfer.totalCost),
            undefined,
            transferDates[index],
          );
          sources.push({
            warehouseId: source.id,
            oldSaleId: oldSale.id,
            movementId: transfer.id,
          });
        }

        for (const source of sources) {
          await WarehouseTransactionService.restoreTransactionAndRecalculateWarehouse(
            tx,
            source.oldSaleId,
          );
        }

        for (const index of sourceOrder) {
          await WarehouseRecalculationService.recalculateAllAffectedTransactions(
            tx,
            [{
              warehouseId: sources[index].warehouseId,
              afterDate: oldSaleDate,
              productType,
            }],
          );
        }

        const refreshedDestination = await tx.query.equipments.findFirst({
          where: eq(equipments.id, destination.id),
        });
        assert.equal(
          Number(refreshedDestination?.currentBalance),
          25,
          `equipment balance in source order ${sourceOrder.join("→")}`,
        );
        assert.ok(
          Math.abs(Number(refreshedDestination?.averageCost) - 15.9556) < 0.0001,
          `equipment average cost in source order ${sourceOrder.join("→")}: ${refreshedDestination?.averageCost}`,
        );

        const sourceBalances = await Promise.all(
          sources.map(async ({ warehouseId }) => {
            const warehouse = await tx.query.warehouses.findFirst({
              where: eq(warehouses.id, warehouseId),
            });
            return Number(warehouse?.currentBalance);
          }),
        );
        assert.deepEqual(
          sourceBalances,
          [110, 80],
          `source warehouse balances in source order ${sourceOrder.join("→")}`,
        );

        const transferRows = await Promise.all(
          sources.map(async ({ movementId }) => {
            const transfer = await tx.query.equipmentMovement.findFirst({
              where: eq(equipmentMovement.id, movementId),
            });
            return Number(transfer?.totalCost);
          }),
        );
        assert.deepEqual(
          transferRows,
          [116.67, 222.22],
          `equipment transfer costs in source order ${sourceOrder.join("→")}`,
        );
      }

      throw rollbackMarker;
    });
    assert.fail("The fixture transaction should have been rolled back.");
  } catch (error) {
    if (error !== rollbackMarker) throw error;
  } finally {
  }
});

test(
  "warehouse recalculation terminates and updates costs across reverse transfers",
  { timeout: 30_000 },
  async (t) => {
    const rollbackMarker = new Error("Rollback integration-test fixtures");
    try {
      const schemaResult = await db.execute(sql`
        SELECT
          to_regclass('movement') IS NOT NULL
            AND to_regclass('warehouse_transactions') IS NOT NULL AS has_warehouse_movement_schema
      `);
      if (!schemaResult.rows[0]?.has_warehouse_movement_schema) {
        t.skip("The configured database does not have the warehouse movement schema.");
        return;
      }

      await db.transaction(async (tx) => {
        const fixtureId = crypto.randomUUID();
        const productType = PRODUCT_TYPE.KEROSENE;
        const openingDate = "2026-04-01T10:00:00.000Z";
        const forwardTransferDate = "2026-04-02T10:00:00.000Z";
        const reverseTransferDate = "2026-04-03T10:00:00.000Z";

        const [warehouseA] = await tx
          .insert(warehouses)
          .values({
            name: `cycle-warehouse-a-${fixtureId}`,
            currentBalance: "100",
            averageCost: "12",
            pvkjBalance: "0",
            pvkjAverageCost: "0",
          })
          .returning();
        const [warehouseB] = await tx
          .insert(warehouses)
          .values({
            name: `cycle-warehouse-b-${fixtureId}`,
            currentBalance: "100",
            averageCost: "20",
            pvkjBalance: "0",
            pvkjAverageCost: "0",
          })
          .returning();

        await tx.insert(warehouseTransactions).values([
          {
            warehouseId: warehouseA.id,
            transactionType: TRANSACTION_TYPE.INVENTORY,
            productType,
            quantity: "100",
            balanceBefore: "0",
            balanceAfter: "100",
            averageCostBefore: "0",
            averageCostAfter: "12",
            sum: "1200",
            transactionDate: openingDate,
          },
          {
            warehouseId: warehouseB.id,
            transactionType: TRANSACTION_TYPE.INVENTORY,
            productType,
            quantity: "100",
            balanceBefore: "0",
            balanceAfter: "100",
            averageCostBefore: "0",
            averageCostAfter: "20",
            sum: "2000",
            transactionDate: openingDate,
          },
        ]);

        const [forwardTransfer] = await tx
          .insert(movement)
          .values({
            movementDate: forwardTransferDate,
            movementType: "transfer",
            productType,
            fromWarehouseId: warehouseA.id,
            toWarehouseId: warehouseB.id,
            quantityKg: "10",
            totalCost: "60",
            purchasePrice: "6",
            costPerKg: "6",
          })
          .returning();
        await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
          tx,
          warehouseA.id,
          TRANSACTION_TYPE.TRANSFER_OUT,
          productType,
          SOURCE_TYPE.MOVEMENT,
          forwardTransfer.id,
          10,
          0,
          undefined,
          forwardTransferDate,
        );
        await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
          tx,
          warehouseB.id,
          TRANSACTION_TYPE.TRANSFER_IN,
          productType,
          SOURCE_TYPE.MOVEMENT,
          forwardTransfer.id,
          10,
          60,
          undefined,
          forwardTransferDate,
        );

        const [reverseTransfer] = await tx
          .insert(movement)
          .values({
            movementDate: reverseTransferDate,
            movementType: "transfer",
            productType,
            fromWarehouseId: warehouseB.id,
            toWarehouseId: warehouseA.id,
            quantityKg: "10",
            totalCost: "200",
            purchasePrice: "20",
            costPerKg: "20",
          })
          .returning();
        await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
          tx,
          warehouseB.id,
          TRANSACTION_TYPE.TRANSFER_OUT,
          productType,
          SOURCE_TYPE.MOVEMENT,
          reverseTransfer.id,
          10,
          0,
          undefined,
          reverseTransferDate,
        );
        await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
          tx,
          warehouseA.id,
          TRANSACTION_TYPE.TRANSFER_IN,
          productType,
          SOURCE_TYPE.MOVEMENT,
          reverseTransfer.id,
          10,
          200,
          undefined,
          reverseTransferDate,
        );

        await WarehouseRecalculationService.recalculateAllAffectedTransactions(
          tx,
          [{
            warehouseId: warehouseA.id,
            afterDate: forwardTransferDate,
            productType,
          }],
        );

        const recalculatedTransfers = await tx
          .select({
            id: movement.id,
            totalCost: movement.totalCost,
            purchasePrice: movement.purchasePrice,
          })
          .from(movement)
          .where(eq(movement.id, forwardTransfer.id));
        const recalculatedReverseTransfer = await tx.query.movement.findFirst({
          where: eq(movement.id, reverseTransfer.id),
        });

        assert.equal(Number(recalculatedTransfers[0]?.totalCost), 120);
        assert.equal(Number(recalculatedTransfers[0]?.purchasePrice), 12);
        assert.equal(
          Number(recalculatedReverseTransfer?.totalCost),
          192.73,
          "the returning movement should use the recalculated blended cost from warehouse B",
        );
        assert.ok(
          Math.abs(Number(recalculatedReverseTransfer?.purchasePrice) - 19.272727) <
            0.000001,
          `reverse transfer purchase price: ${recalculatedReverseTransfer?.purchasePrice}`,
        );

        throw rollbackMarker;
      });
      assert.fail("The fixture transaction should have been rolled back.");
    } catch (error) {
      if (error !== rollbackMarker) throw error;
    } finally {
    }
  },
);

test(
  "editing movement delivery and storage charges updates the receiving warehouse cost",
  { timeout: 30_000 },
  async (t) => {
    const schemaResult = await db.execute(sql`
      SELECT
        to_regclass('movement') IS NOT NULL
          AND to_regclass('warehouses') IS NOT NULL
          AND to_regclass('warehouse_transactions') IS NOT NULL AS has_movement_schema
    `);
    if (!schemaResult.rows[0]?.has_movement_schema) {
      t.skip("The configured database does not have the warehouse movement schema.");
      return;
    }

    const fixtureId = crypto.randomUUID();
    let warehouseId: string | undefined;
    let movementId: string | undefined;

    try {
      await db.transaction(async (tx) => {
        const [warehouse] = await tx
          .insert(warehouses)
          .values({
            name: `movement-charge-edit-${fixtureId}`,
            currentBalance: "0",
            averageCost: "0",
            pvkjBalance: "0",
            pvkjAverageCost: "0",
          })
          .returning();
        warehouseId = warehouse.id;

        const movementDate = "2026-05-01T10:00:00.000Z";
        const [createdMovement] = await tx
          .insert(movement)
          .values({
            movementDate,
            movementType: "supply",
            productType: PRODUCT_TYPE.KEROSENE,
            toWarehouseId: warehouse.id,
            quantityKg: "10",
            purchasePrice: "10",
            deliveryCost: "10",
            storageCost: "5",
            totalCost: "115",
            costPerKg: "11.5",
          })
          .returning();
        movementId = createdMovement.id;

        const { transaction } =
          await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
            tx,
            warehouse.id,
            TRANSACTION_TYPE.RECEIPT,
            PRODUCT_TYPE.KEROSENE,
            SOURCE_TYPE.MOVEMENT,
            createdMovement.id,
            10,
            115,
            undefined,
            movementDate,
          );
        await tx
          .update(movement)
          .set({ transactionId: transaction.id })
          .where(eq(movement.id, createdMovement.id));
      });

      const storage = new MovementStorage();
      const deliveryUpdated = await storage.updateMovement(movementId!, {
        deliveryCost: "30",
        totalCost: "115",
      } as any);
      assert.equal(Number(deliveryUpdated?.totalCost), 135);

      let warehouseAfterEdit = await db.query.warehouses.findFirst({
        where: eq(warehouses.id, warehouseId!),
      });
      assert.ok(
        Math.abs(Number(warehouseAfterEdit?.averageCost) - 13.5) < 0.000001,
        `average cost after delivery charge edit: ${warehouseAfterEdit?.averageCost}`,
      );
      let receivingTransaction = await db.query.warehouseTransactions.findFirst({
        where: eq(warehouseTransactions.sourceId, movementId!),
      });
      assert.equal(Number(receivingTransaction?.sum), 135);
      assert.ok(
        Math.abs(Number(receivingTransaction?.averageCostAfter) - 13.5) <
          0.000001,
        `transaction average cost after delivery charge edit: ${receivingTransaction?.averageCostAfter}`,
      );

      const storageUpdated = await storage.updateMovement(movementId!, {
        storageCost: "25",
        totalCost: "135",
      } as any);
      assert.equal(Number(storageUpdated?.totalCost), 155);

      warehouseAfterEdit = await db.query.warehouses.findFirst({
        where: eq(warehouses.id, warehouseId!),
      });
      assert.ok(
        Math.abs(Number(warehouseAfterEdit?.averageCost) - 15.5) < 0.000001,
        `average cost after storage charge edit: ${warehouseAfterEdit?.averageCost}`,
      );
      receivingTransaction = await db.query.warehouseTransactions.findFirst({
        where: eq(warehouseTransactions.sourceId, movementId!),
      });
      assert.equal(Number(receivingTransaction?.sum), 155);
      assert.ok(
        Math.abs(Number(receivingTransaction?.averageCostAfter) - 15.5) <
          0.000001,
        `transaction average cost after storage charge edit: ${receivingTransaction?.averageCostAfter}`,
      );
    } finally {
      if (movementId && warehouseId) {
        await db.transaction(async (tx) => {
          await tx.delete(movement).where(eq(movement.id, movementId!));
          await tx
            .delete(warehouseTransactions)
            .where(eq(warehouseTransactions.sourceId, movementId!));
          await tx.delete(warehouses).where(eq(warehouses.id, warehouseId!));
        });
      } else if (warehouseId) {
        await db.delete(warehouses).where(eq(warehouses.id, warehouseId!));
      }
    }
  },
);

after(async () => {
  await pool.end();
});
