import assert from "node:assert/strict";
import { after, test } from "node:test";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "../server/db";
import { PRODUCT_TYPE, SOURCE_TYPE } from "../shared/constants";
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
import { AuditService } from "../server/modules/audit/services/audit-service";
import { RollbackService } from "../server/modules/audit/services/rollback-service";

after(async () => {
  await pool.end();
});

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
  }
});

test("an audit-write failure rolls back the entire refueling order restoration", async (t) => {
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
  let auditEntryIds: string[] = [];
  const originalAuditLog = AuditService.log;

  try {
    const [supplier] = await db
      .insert(suppliers)
      .values({ name: `restore-audit-failure-supplier-${crypto.randomUUID()}` })
      .returning();
    supplierId = supplier.id;

    const [customer] = await db
      .insert(customers)
      .values({
        name: `restore-audit-failure-customer-${crypto.randomUUID()}`,
        module: "refueling",
      })
      .returning();
    customerId = customer.id;

    const [warehouse] = await db
      .insert(warehouses)
      .values({
        name: `restore-audit-failure-warehouse-${crypto.randomUUID()}`,
        currentBalance: "100",
        averageCost: "10",
      })
      .returning();
    warehouseId = warehouse.id;

    const [equipment] = await db
      .insert(equipments)
      .values({
        name: `restore-audit-failure-equipment-${crypto.randomUUID()}`,
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

    const deletedDeals = await storage.deleteRefuelingOrder(createdDeals[0].id);
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
    auditEntryIds = auditEntries.map((entry) => entry.id);

    (AuditService as any).log = async () => {
      throw new Error("simulated audit write failure");
    };
    const rollback = await RollbackService.rollback({
      auditLogId: auditEntries[0].id,
      context: { userName: "restore-audit-failure-test" },
    });
    assert.equal(rollback.success, false);
    assert.match(rollback.message, /simulated audit write failure/);

    const [remainingDeals, warehouseMovements, equipmentMovements, rollbackEntries, restoreEntries] =
      await Promise.all([
        db.select().from(aircraftRefueling).where(inArray(aircraftRefueling.id, dealIds)),
        db.select().from(warehouseTransactions).where(inArray(warehouseTransactions.id, warehouseTransactionIds)),
        db.select().from(equipmentTransactions).where(inArray(equipmentTransactions.id, equipmentTransactionIds)),
        db.select().from(auditLog).where(inArray(auditLog.id, auditEntryIds)),
        db
          .select()
          .from(auditLog)
          .where(
            and(
              eq(auditLog.entityType, "aircraft_refueling"),
              eq(auditLog.operation, AUDIT_OPERATIONS.RESTORE),
              inArray(auditLog.entityId, dealIds),
            ),
          ),
      ]);

    assert.ok(remainingDeals.every((deal) => deal.deletedAt), "all deal rows should remain deleted");
    assert.ok(warehouseMovements.every((movement) => movement.deletedAt), "warehouse movements should remain deleted");
    assert.ok(equipmentMovements.every((movement) => movement.deletedAt), "equipment movements should remain deleted");
    assert.ok(rollbackEntries.every((entry) => !entry.rolledBackAt), "rollback markers should remain unchanged");
    assert.equal(restoreEntries.length, 0, "a failed restore audit entry should not be recorded");

    const [unchangedWarehouse, unchangedEquipment] = await Promise.all([
      db.query.warehouses.findFirst({ where: eq(warehouses.id, warehouseId) }),
      db.query.equipments.findFirst({ where: eq(equipments.id, equipmentId) }),
    ]);
    assert.equal(Number(unchangedWarehouse?.currentBalance), 100);
    assert.equal(Number(unchangedEquipment?.pvkjBalance), 60);
  } finally {
    AuditService.log = originalAuditLog;
    if (auditEntryIds.length) {
      await db.delete(auditLog).where(inArray(auditLog.id, auditEntryIds));
    }
    if (dealIds.length) {
      await db.delete(aircraftRefueling).where(inArray(aircraftRefueling.id, dealIds));
    }
    if (warehouseTransactionIds.length) {
      await db.delete(warehouseTransactions).where(inArray(warehouseTransactions.id, warehouseTransactionIds));
    }
    if (equipmentTransactionIds.length) {
      await db.delete(equipmentTransactions).where(inArray(equipmentTransactions.id, equipmentTransactionIds));
    }
    if (warehouseId) await db.delete(warehouses).where(eq(warehouses.id, warehouseId));
    if (equipmentId) await db.delete(equipments).where(eq(equipments.id, equipmentId));
    if (supplierId) await db.delete(suppliers).where(eq(suppliers.id, supplierId));
    if (customerId) await db.delete(customers).where(eq(customers.id, customerId));
  }
});

test("rolling back a legacy deleted single refueling restores only its original row and movement", async (t) => {
  const schemaResult = await db.execute(sql`
    SELECT
      to_regclass('aircraft_refueling') IS NOT NULL
        AND to_regclass('warehouse_transactions') IS NOT NULL
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
    return;
  }

  const storage = new AircraftRefuelingStorage();
  let supplierId: string | undefined;
  let customerId: string | undefined;
  let warehouseId: string | undefined;
  let dealIds: string[] = [];
  let movementIds: string[] = [];
  let auditEntryId: string | undefined;

  try {
    const [supplier] = await db
      .insert(suppliers)
      .values({ name: `legacy-restore-test-supplier-${crypto.randomUUID()}` })
      .returning();
    supplierId = supplier.id;

    const [customer] = await db
      .insert(customers)
      .values({
        name: `legacy-restore-test-customer-${crypto.randomUUID()}`,
        module: "refueling",
      })
      .returning();
    customerId = customer.id;

    const [warehouse] = await db
      .insert(warehouses)
      .values({
        name: `legacy-restore-test-warehouse-${crypto.randomUUID()}`,
        currentBalance: "100",
        averageCost: "10",
      })
      .returning();
    warehouseId = warehouse.id;

    const legacyCreated = await storage.createRefueling({
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
    } as any);
    dealIds.push(legacyCreated.id);
    const unrelatedCreated = await storage.createRefueling({
      refuelingDate: new Date().toISOString(),
      productType: PRODUCT_TYPE.KEROSENE,
      supplierId,
      buyerId: customerId,
      warehouseId,
      quantityKg: 5,
      purchasePrice: 10,
      purchaseAmount: 50,
      salePrice: 15,
      saleAmount: 75,
      isDraft: false,
    } as any);
    dealIds.push(unrelatedCreated.id);

    // Older records had no order grouping identifier. Keep two such records
    // together in the fixture to ensure a rollback is scoped to its row ID.
    await db
      .update(aircraftRefueling)
      .set({ refuelingOrderId: null })
      .where(inArray(aircraftRefueling.id, dealIds));

    const legacyDeal = await db.query.aircraftRefueling.findFirst({
      where: eq(aircraftRefueling.id, dealIds[0]),
    });
    const unrelatedDeal = await db.query.aircraftRefueling.findFirst({
      where: eq(aircraftRefueling.id, dealIds[1]),
    });
    assert.ok(legacyDeal);
    assert.ok(legacyDeal.transactionId);
    assert.ok(unrelatedDeal);
    assert.ok(unrelatedDeal.transactionId);
    assert.equal(legacyDeal.refuelingOrderId, null);
    assert.equal(unrelatedDeal.refuelingOrderId, null);
    movementIds = [legacyDeal.transactionId, unrelatedDeal.transactionId];

    const { refuelingOrderId: _legacyGroupId, ...legacyAuditData } = legacyDeal;
    await storage.deleteRefuelingOrder(legacyDeal.id);
    const [auditEntry] = await db
      .insert(auditLog)
      .values({
        entityType: "aircraft_refueling",
        entityId: legacyDeal.id,
        operation: AUDIT_OPERATIONS.DELETE,
        oldData: legacyAuditData,
      })
      .returning();
    auditEntryId = auditEntry.id;

    const [deletedLegacyMovement, activeUnrelatedMovement] = await Promise.all([
      db.query.warehouseTransactions.findFirst({
        where: eq(warehouseTransactions.id, legacyDeal.transactionId),
      }),
      db.query.warehouseTransactions.findFirst({
        where: eq(warehouseTransactions.id, unrelatedDeal.transactionId),
      }),
    ]);
    assert.ok(deletedLegacyMovement?.deletedAt);
    assert.equal(activeUnrelatedMovement?.deletedAt, null);

    const rollback = await RollbackService.rollback({
      auditLogId: auditEntry.id,
      context: { userName: "legacy-single-refueling-restore-test" },
    });
    assert.equal(rollback.success, true, rollback.message);

    const restoredRows = await db
      .select()
      .from(aircraftRefueling)
      .where(inArray(aircraftRefueling.id, dealIds));
    const restoredLegacyDeal = restoredRows.find((deal) => deal.id === legacyDeal.id);
    const unchangedUnrelatedDeal = restoredRows.find(
      (deal) => deal.id === unrelatedDeal.id,
    );
    assert.ok(restoredLegacyDeal);
    assert.equal(restoredLegacyDeal.deletedAt, null);
    assert.equal(restoredLegacyDeal.transactionId, legacyDeal.transactionId);
    assert.ok(unchangedUnrelatedDeal);
    assert.equal(unchangedUnrelatedDeal.deletedAt, null);
    assert.equal(unchangedUnrelatedDeal.transactionId, unrelatedDeal.transactionId);
    assert.equal(unchangedUnrelatedDeal.quantityKg, unrelatedDeal.quantityKg);

    const restoredMovements = await db
      .select()
      .from(warehouseTransactions)
      .where(inArray(warehouseTransactions.id, movementIds));
    assert.equal(restoredMovements.length, 2);
    assert.ok(restoredMovements.every((movement) => !movement.deletedAt));
    for (const dealId of dealIds) {
      const movementsForDeal = await db
        .select()
        .from(warehouseTransactions)
        .where(
          and(
            eq(warehouseTransactions.sourceId, dealId),
            eq(warehouseTransactions.sourceType, SOURCE_TYPE.REFUELING),
          ),
        );
      assert.equal(movementsForDeal.length, 1, "rollback must not create a duplicate movement");
    }

    const finalWarehouse = await db.query.warehouses.findFirst({
      where: eq(warehouses.id, warehouseId),
    });
    assert.equal(Number(finalWarehouse?.currentBalance), 83);
  } finally {
    if (auditEntryId) {
      await db.delete(auditLog).where(eq(auditLog.id, auditEntryId));
    }
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
    if (movementIds.length) {
      await db
        .delete(warehouseTransactions)
        .where(inArray(warehouseTransactions.id, movementIds));
    }
    if (warehouseId) {
      await db.delete(warehouses).where(eq(warehouses.id, warehouseId));
    }
    if (supplierId) {
      await db.delete(suppliers).where(eq(suppliers.id, supplierId));
    }
    if (customerId) {
      await db.delete(customers).where(eq(customers.id, customerId));
    }
  }
});

test("rolling back a legacy deleted equipment refueling restores its original movement and balance", async (t) => {
  const schemaResult = await db.execute(sql`
    SELECT
      to_regclass('aircraft_refueling') IS NOT NULL
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
    return;
  }

  const storage = new AircraftRefuelingStorage();
  let supplierId: string | undefined;
  let customerId: string | undefined;
  let equipmentId: string | undefined;
  let dealId: string | undefined;
  let movementId: string | undefined;
  let auditEntryId: string | undefined;

  try {
    const [supplier] = await db
      .insert(suppliers)
      .values({ name: `legacy-equipment-restore-supplier-${crypto.randomUUID()}` })
      .returning();
    supplierId = supplier.id;

    const [customer] = await db
      .insert(customers)
      .values({
        name: `legacy-equipment-restore-customer-${crypto.randomUUID()}`,
        module: "refueling",
      })
      .returning();
    customerId = customer.id;

    const [equipment] = await db
      .insert(equipments)
      .values({
        name: `legacy-equipment-restore-equipment-${crypto.randomUUID()}`,
        pvkjBalance: "60",
        pvkjAverageCost: "12",
      })
      .returning();
    equipmentId = equipment.id;

    const createdDeal = await storage.createRefueling({
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
    } as any);
    dealId = createdDeal.id;
    assert.ok(createdDeal.equipmentTransactionId);
    movementId = createdDeal.equipmentTransactionId;

    // Model old standalone records without an order identifier in either row or audit data.
    await db
      .update(aircraftRefueling)
      .set({ refuelingOrderId: null })
      .where(eq(aircraftRefueling.id, dealId));
    const legacyDeal = await db.query.aircraftRefueling.findFirst({
      where: eq(aircraftRefueling.id, dealId),
    });
    assert.ok(legacyDeal);
    assert.equal(legacyDeal.refuelingOrderId, null);
    const { refuelingOrderId: _legacyGroupId, ...legacyAuditData } = legacyDeal;

    await storage.deleteRefuelingOrder(dealId);
    const [auditEntry] = await db
      .insert(auditLog)
      .values({
        entityType: "aircraft_refueling",
        entityId: dealId,
        operation: AUDIT_OPERATIONS.DELETE,
        oldData: legacyAuditData,
      })
      .returning();
    auditEntryId = auditEntry.id;
    assert.equal(
      Object.hasOwn(auditEntry.oldData as object, "refuelingOrderId"),
      false,
      "the legacy audit snapshot must not contain an order identifier",
    );

    const deletedMovement = await db.query.equipmentTransactions.findFirst({
      where: eq(equipmentTransactions.id, movementId),
    });
    assert.ok(deletedMovement?.deletedAt);
    const deletedEquipment = await db.query.equipments.findFirst({
      where: eq(equipments.id, equipmentId),
    });
    assert.equal(Number(deletedEquipment?.pvkjBalance), 60);

    const rollback = await RollbackService.rollback({
      auditLogId: auditEntry.id,
      context: { userName: "legacy-equipment-refueling-restore-test" },
    });
    assert.equal(rollback.success, true, rollback.message);

    const restoredDeal = await db.query.aircraftRefueling.findFirst({
      where: eq(aircraftRefueling.id, dealId),
    });
    assert.ok(restoredDeal);
    assert.equal(restoredDeal.deletedAt, null);
    assert.equal(restoredDeal.equipmentTransactionId, movementId);

    const equipmentMovements = await db
      .select()
      .from(equipmentTransactions)
      .where(
        and(
          eq(equipmentTransactions.sourceId, dealId),
          eq(equipmentTransactions.sourceType, SOURCE_TYPE.REFUELING),
        ),
      );
    assert.equal(equipmentMovements.length, 1, "rollback must not create a replacement movement");
    assert.equal(equipmentMovements[0].id, movementId);
    assert.equal(equipmentMovements[0].deletedAt, null);

    const restoredEquipment = await db.query.equipments.findFirst({
      where: eq(equipments.id, equipmentId),
    });
    assert.equal(Number(restoredEquipment?.pvkjBalance), 53);
  } finally {
    if (auditEntryId) {
      await db.delete(auditLog).where(eq(auditLog.id, auditEntryId));
    }
    if (dealId) {
      await db
        .delete(auditLog)
        .where(
          and(
            eq(auditLog.entityType, "aircraft_refueling"),
            eq(auditLog.entityId, dealId),
          ),
        );
      await db.delete(aircraftRefueling).where(eq(aircraftRefueling.id, dealId));
    }
    if (movementId) {
      await db
        .delete(equipmentTransactions)
        .where(eq(equipmentTransactions.id, movementId));
    }
    if (equipmentId) {
      await db.delete(equipments).where(eq(equipments.id, equipmentId));
    }
    if (supplierId) {
      await db.delete(suppliers).where(eq(suppliers.id, supplierId));
    }
    if (customerId) {
      await db.delete(customers).where(eq(customers.id, customerId));
    }
  }
});

test("rolling back a deleted order fails without restoring any item when a movement is missing", async (t) => {
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
    return;
  }

  let supplierId: string | undefined;
  let customerId: string | undefined;
  let warehouseId: string | undefined;
  let equipmentId: string | undefined;
  const storage = new AircraftRefuelingStorage();
  const context = { userName: "restore-order-missing-movement-test" };

  try {
    const [supplier] = await db
      .insert(suppliers)
      .values({ name: `restore-missing-movement-supplier-${crypto.randomUUID()}` })
      .returning();
    supplierId = supplier.id;

    const [customer] = await db
      .insert(customers)
      .values({
        name: `restore-missing-movement-customer-${crypto.randomUUID()}`,
        module: "refueling",
      })
      .returning();
    customerId = customer.id;

    const [warehouse] = await db
      .insert(warehouses)
      .values({
        name: `restore-missing-movement-warehouse-${crypto.randomUUID()}`,
        currentBalance: "100",
        averageCost: "10",
      })
      .returning();
    warehouseId = warehouse.id;

    const [equipment] = await db
      .insert(equipments)
      .values({
        name: `restore-missing-movement-equipment-${crypto.randomUUID()}`,
        pvkjBalance: "60",
        pvkjAverageCost: "12",
      })
      .returning();
    equipmentId = equipment.id;

    for (const missingMovementType of ["warehouse", "equipment"] as const) {
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
      const dealIds = createdDeals.map((deal) => deal.id);
      const warehouseTransactionIds = createdDeals
        .map((deal) => deal.transactionId)
        .filter((id): id is string => Boolean(id));
      const equipmentTransactionIds = createdDeals
        .map((deal) => deal.equipmentTransactionId)
        .filter((id): id is string => Boolean(id));
      let auditEntryIds: string[] = [];

      try {
        const deletedDeals = await storage.deleteRefuelingOrder(createdDeals[0].id);
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
        auditEntryIds = auditEntries.map((entry) => entry.id);

        const missingDeal = createdDeals.find((deal) =>
          missingMovementType === "equipment"
            ? Boolean(deal.equipmentTransactionId)
            : Boolean(deal.transactionId),
        );
        assert.ok(missingDeal, `the order should have a ${missingMovementType} movement`);
        if (missingMovementType === "equipment") {
          await db
            .update(aircraftRefueling)
            .set({ equipmentTransactionId: null })
            .where(eq(aircraftRefueling.id, missingDeal.id));
          await db
            .delete(equipmentTransactions)
            .where(eq(equipmentTransactions.id, missingDeal.equipmentTransactionId!));
        } else {
          await db
            .update(aircraftRefueling)
            .set({ transactionId: null })
            .where(eq(aircraftRefueling.id, missingDeal.id));
          await db
            .delete(warehouseTransactions)
            .where(eq(warehouseTransactions.id, missingDeal.transactionId!));
        }

        const rollback = await RollbackService.rollback({
          auditLogId: auditEntries.find((entry) => entry.entityId === missingDeal.id)!.id,
          context,
        });
        assert.equal(rollback.success, false, "the whole order restoration should fail");

        const remainingDeals = await db
          .select()
          .from(aircraftRefueling)
          .where(inArray(aircraftRefueling.id, dealIds));
        assert.equal(remainingDeals.length, 2);
        assert.ok(remainingDeals.every((deal) => deal.deletedAt), "no product row should be restored");

        const [unchangedWarehouse, unchangedEquipment] = await Promise.all([
          db.query.warehouses.findFirst({
            where: eq(warehouses.id, warehouseId!),
          }),
          db.query.equipments.findFirst({
            where: eq(equipments.id, equipmentId!),
          }),
        ]);
        assert.equal(Number(unchangedWarehouse?.currentBalance), 100);
        assert.equal(Number(unchangedEquipment?.pvkjBalance), 60);

        const [remainingWarehouseTransactions, remainingEquipmentTransactions, unchangedAudits] =
          await Promise.all([
            db
              .select()
              .from(warehouseTransactions)
              .where(inArray(warehouseTransactions.id, warehouseTransactionIds)),
            db
              .select()
              .from(equipmentTransactions)
              .where(inArray(equipmentTransactions.id, equipmentTransactionIds)),
            db
              .select()
              .from(auditLog)
              .where(inArray(auditLog.id, auditEntryIds)),
          ]);
        assert.ok(
          remainingWarehouseTransactions.every((transaction) => transaction.deletedAt),
          "remaining warehouse movements should stay deleted",
        );
        assert.ok(
          remainingEquipmentTransactions.every((transaction) => transaction.deletedAt),
          "remaining equipment movements should stay deleted",
        );
        assert.ok(unchangedAudits.every((entry) => !entry.rolledBackAt));
      } finally {
        if (auditEntryIds.length) {
          await db.delete(auditLog).where(inArray(auditLog.id, auditEntryIds));
        }
        await db.delete(aircraftRefueling).where(inArray(aircraftRefueling.id, dealIds));
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
      }
    }
  } finally {
    if (warehouseId) {
      await db.delete(warehouses).where(eq(warehouses.id, warehouseId));
    }
    if (equipmentId) {
      await db.delete(equipments).where(eq(equipments.id, equipmentId));
    }
    if (supplierId) {
      await db.delete(suppliers).where(eq(suppliers.id, supplierId));
    }
    if (customerId) {
      await db.delete(customers).where(eq(customers.id, customerId));
    }
  }
});
