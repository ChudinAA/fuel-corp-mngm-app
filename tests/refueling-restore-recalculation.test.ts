import assert from "node:assert/strict";
import { test } from "node:test";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "../server/db";
import { PRODUCT_TYPE, SOURCE_TYPE, TRANSACTION_TYPE } from "../shared/constants";
import { movement } from "../server/modules/movement/entities/movement";
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
};

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
          ) AS is_fuel_equipment_schema
    `);
    if (!schemaResult.rows[0]?.is_fuel_equipment_schema) {
      t.skip("The configured database has not been migrated to the fuel-equipment schema.");
      return;
    }

    await db.transaction(async (tx) => {
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
        await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
          tx,
          warehouse.id,
          TRANSACTION_TYPE.SALE,
          productType,
          "",
          crypto.randomUUID(),
          10,
          0,
          undefined,
          testDates.laterSale,
        );

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
        await EquipmentTransactionService.createTransactionAndUpdateEquipment(
          tx,
          equipment.id,
          TRANSACTION_TYPE.SALE,
          productType,
          "",
          crypto.randomUUID(),
          10,
          0,
          undefined,
          testDates.laterSale,
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

        assert.equal(warehouseBalance, 110, `warehouse ${productType} balance`);
        assert.equal(equipmentBalance, 110, `equipment ${productType} balance`);
        assert.ok(
          Math.abs(warehouseAverageCost - 11.666667) < 0.000001,
          `warehouse ${productType} average cost: ${warehouseAverageCost}`,
        );
        assert.ok(
          Math.abs(equipmentAverageCost - 11.6667) < 0.0001,
          `equipment ${productType} average cost: ${equipmentAverageCost}`,
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
        assert.ok(openingWarehouseTx && openingEquipmentTx);
      }

      // Force rollback so this integration test leaves no persistent fixtures or queue entries.
      throw rollbackMarker;
    });
    assert.fail("The fixture transaction should have been rolled back.");
  } catch (error) {
    if (error !== rollbackMarker) throw error;
  } finally {
    await pool.end();
  }
});
