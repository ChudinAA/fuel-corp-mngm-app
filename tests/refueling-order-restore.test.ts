import assert from "node:assert/strict";
import { test } from "node:test";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "../server/db";
import { PRODUCT_TYPE } from "../shared/constants";
import { aircraftRefueling } from "../server/modules/refueling/entities/refueling";
import { AircraftRefuelingStorage } from "../server/modules/refueling/storage/aircraft-refueling-storage";
import { suppliers } from "../server/modules/suppliers/entities/suppliers";
import { customers } from "../server/modules/customers/entities/customers";
import {
  warehouses,
  warehouseTransactions,
} from "../server/modules/warehouses/entities/warehouses";
import {
  equipments,
  equipmentTransactions,
} from "../server/modules/warehouses-equipment/entities/equipment";
import {
  AUDIT_OPERATIONS,
  auditLog,
} from "../server/modules/audit/entities/audit";
import { RollbackService } from "../server/modules/audit/services/rollback-service";

test("rolling back a deleted multi-product refueling order restores original rows and stock once", async (t) => {
  const schemaResult = await db.execute(sql`
    SELECT
      to_regclass('aircraft_refueling') IS NOT NULL
        AND to_regclass('warehouse_transactions') IS NOT NULL
        AND to_regclass('equipment_transactions') IS NOT NULL
        AND to_regclass('audit_log') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'aircraft_refueling'
            AND column_name = 'refueling_order_id'
        ) AS has_refueling_order_schema
  `);
  if (!schemaResult.rows[0]?.has_refueling_order_schema) {
    t.skip("The configured database has not been migrated to the refueling-order schema.");
    await pool.end();
    return;
  }

  const storage = new AircraftRefuelingStorage();
  let supplierId: string | undefined;
  let customerId: string | undefined;
  let warehouseId: string | undefined;
  let equipmentId: string | undefined;
  let dealIds: string[] = [];
  let warehouseTransactionIds: string[] = [];
  let equipmentTransactionIds: string[] = [];

  try {
    const [supplier] = await db
      .insert(suppliers)
      .values({ name: `restore-order-test-supplier-${crypto.randomUUID()}` })
      .returning();
    supplierId = supplier.id;

    const [customer] = await db
      .insert(customers)
      .values({
        name: `restore-order-test-customer-${crypto.randomUUID()}`,
        module: "refueling",
      })
      .returning();
    customerId = customer.id;

    const [warehouse] = await db
      .insert(warehouses)
      .values({
        name: `restore-order-test-warehouse-${crypto.randomUUID()}`,
        currentBalance: "100",
        averageCost: "10",
      })
      .returning();
    warehouseId = warehouse.id;

    const [equipment] = await db
      .insert(equipments)
      .values({
        name: `restore-order-test-equipment-${crypto.randomUUID()}`,
        pvkjBalance: "60",
        pvkjAverageCost: "12",
      })
      .returning();
    equipmentId = equipment.id;

    const createdDeals = await storage.createRefuelings([
      {
        refuelingDate: new Date().toISOString(),
        productType: PRODUCT_TYPE.KEROSENE,
        supplierId,
        buyerId: customerId,
        warehouseId,
        quantityKg: 12,
        purchasePrice: 10,
        purchaseAmount: 120,
        salePrice: 15,
        saleAmount: 180,
        isDraft: false,
      } as any,
      {
        refuelingDate: new Date().toISOString(),
        productType: PRODUCT_TYPE.PVKJ,
        supplierId,
        buyerId: customerId,
        equipmentId,
        quantityKg: 7,
        purchasePrice: 12,
        purchaseAmount: 84,
        salePrice: 18,
        saleAmount: 126,
        isDraft: false,
      } as any,
    ]);
    dealIds = createdDeals.map((deal) => deal.id);
    warehouseTransactionIds = createdDeals
      .map((deal) => deal.transactionId)
      .filter((id): id is string => Boolean(id));
    equipmentTransactionIds = createdDeals
      .map((deal) => deal.equipmentTransactionId)
      .filter((id): id is string => Boolean(id));

    assert.equal(createdDeals.length, 2);
    assert.deepEqual(
      createdDeals.map((deal) => deal.productType).sort(),
      [PRODUCT_TYPE.KEROSENE, PRODUCT_TYPE.PVKJ].sort(),
    );
    assert.equal(warehouseTransactionIds.length, 1);
    assert.equal(equipmentTransactionIds.length, 1);
    assert.equal(Number(createdDeals.find((deal) => deal.productType === PRODUCT_TYPE.KEROSENE)?.quantityKg), 12);
    assert.equal(Number(createdDeals.find((deal) => deal.productType === PRODUCT_TYPE.PVKJ)?.quantityKg), 7);

    const deletedDeals = await storage.deleteRefuelingOrder(createdDeals[0].id);
    assert.deepEqual(
      deletedDeals.map((deal) => deal.id).sort(),
      dealIds.slice().sort(),
      "deleting the order should soft-delete all of its product rows",
    );

    const auditEntries = await db
      .insert(auditLog)
      .values(
        deletedDeals.map((deal) => ({
          entityType: "aircraft_refueling",
          entityId: deal.id,
          operation: AUDIT_OPERATIONS.DELETE,
          oldData: deal,
        })),
      )
      .returning();

    const deletedWarehouse = await db.query.warehouses.findFirst({
      where: sql`${warehouses.id} = ${warehouseId}`,
    });
    const deletedEquipment = await db.query.equipments.findFirst({
      where: sql`${equipments.id} = ${equipmentId}`,
    });
    assert.equal(Number(deletedWarehouse?.currentBalance), 100);
    assert.equal(Number(deletedEquipment?.pvkjBalance), 60);

    const deletedWarehouseTransactions = await db
      .select()
      .from(warehouseTransactions)
      .where(inArray(warehouseTransactions.id, warehouseTransactionIds));
    const deletedEquipmentTransactions = await db
      .select()
      .from(equipmentTransactions)
      .where(inArray(equipmentTransactions.id, equipmentTransactionIds));
    assert.equal(deletedWarehouseTransactions.length, 1);
    assert.ok(deletedWarehouseTransactions[0].deletedAt);
    assert.equal(deletedEquipmentTransactions.length, 1);
    assert.ok(deletedEquipmentTransactions[0].deletedAt);

    const context = { userName: "restore-order-test" };
    const rollbackResults = await Promise.all(
      auditEntries.map((entry) =>
        RollbackService.rollback({ auditLogId: entry.id, context }),
      ),
    );
    assert.equal(
      rollbackResults.filter((result) => result.success).length,
      1,
      "only one concurrent rollback request should restore the order",
    );
    assert.equal(
      rollbackResults.filter((result) => !result.success).length,
      1,
      "the competing rollback request should be rejected",
    );

    const restoredDeals = await storage.getRefuelingOrder(createdDeals[0].id);
    assert.deepEqual(
      restoredDeals.map((deal) => deal.id).sort(),
      dealIds.slice().sort(),
      "restoration should return all product rows with their original IDs",
    );
    assert.deepEqual(
      restoredDeals
        .map((deal) => [deal.productType, deal.quantityKg])
        .sort(([typeA], [typeB]) => String(typeA).localeCompare(String(typeB))),
      [
        [PRODUCT_TYPE.KEROSENE, "12.00"],
        [PRODUCT_TYPE.PVKJ, "7.00"],
      ].sort(([typeA], [typeB]) => String(typeA).localeCompare(String(typeB))),
    );
    assert.deepEqual(
      restoredDeals
        .map((deal) => deal.transactionId)
        .filter(Boolean)
        .sort(),
      warehouseTransactionIds.slice().sort(),
      "the original warehouse transaction ID should be retained",
    );
    assert.deepEqual(
      restoredDeals
        .map((deal) => deal.equipmentTransactionId)
        .filter(Boolean)
        .sort(),
      equipmentTransactionIds.slice().sort(),
      "the original fuel-equipment transaction ID should be retained",
    );

    const restoredWarehouseTransactions = await db
      .select()
      .from(warehouseTransactions)
      .where(inArray(warehouseTransactions.id, warehouseTransactionIds));
    const restoredEquipmentTransactions = await db
      .select()
      .from(equipmentTransactions)
      .where(inArray(equipmentTransactions.id, equipmentTransactionIds));
    assert.ok(restoredWarehouseTransactions.every((tx) => !tx.deletedAt));
    assert.ok(restoredEquipmentTransactions.every((tx) => !tx.deletedAt));

    const restoredWarehouse = await db.query.warehouses.findFirst({
      where: sql`${warehouses.id} = ${warehouseId}`,
    });
    const restoredEquipment = await db.query.equipments.findFirst({
      where: sql`${equipments.id} = ${equipmentId}`,
    });
    assert.equal(Number(restoredWarehouse?.currentBalance), 88);
    assert.equal(Number(restoredEquipment?.pvkjBalance), 53);

    const repeatedRollback = await RollbackService.rollback({
      auditLogId: auditEntries[0].id,
      context,
    });
    assert.equal(repeatedRollback.success, false);

    const finalWarehouse = await db.query.warehouses.findFirst({
      where: sql`${warehouses.id} = ${warehouseId}`,
    });
    const finalEquipment = await db.query.equipments.findFirst({
      where: sql`${equipments.id} = ${equipmentId}`,
    });
    assert.equal(Number(finalWarehouse?.currentBalance), 88);
    assert.equal(Number(finalEquipment?.pvkjBalance), 53);

    const finalAuditEntries = await db
      .select()
      .from(auditLog)
      .where(inArray(auditLog.id, auditEntries.map((entry) => entry.id)));
    assert.ok(finalAuditEntries.every((entry) => entry.rolledBackAt));
  } finally {
    if (dealIds.length) {
      await db
        .delete(auditLog)
        .where(
          and(
            eq(auditLog.entityType, "aircraft_refueling"),
            inArray(auditLog.entityId, dealIds),
          ),
        );
      await db
        .delete(aircraftRefueling)
        .where(inArray(aircraftRefueling.id, dealIds));
    }
    if (warehouseTransactionIds.length) {
      await db
        .delete(warehouseTransactions)
        .where(inArray(warehouseTransactions.id, warehouseTransactionIds));
    }
    if (equipmentTransactionIds.length) {
      await db
        .delete(equipmentTransactions)
        .where(inArray(equipmentTransactions.id, equipmentTransactionIds));
    }
    if (warehouseId) {
      await db.delete(warehouses).where(sql`${warehouses.id} = ${warehouseId}`);
    }
    if (equipmentId) {
      await db.delete(equipments).where(sql`${equipments.id} = ${equipmentId}`);
    }
    if (supplierId) {
      await db.delete(suppliers).where(sql`${suppliers.id} = ${supplierId}`);
    }
    if (customerId) {
      await db.delete(customers).where(sql`${customers.id} = ${customerId}`);
    }
    await pool.end();
  }
});
