import assert from "node:assert/strict";
import { after, test } from "node:test";
import { inArray, sql } from "drizzle-orm";
import { db, pool } from "../server/db";
import { PRODUCT_TYPE } from "../shared/constants";
import { aircraftRefueling } from "../server/modules/refueling/entities/refueling";
import { AircraftRefuelingStorage } from "../server/modules/refueling/storage/aircraft-refueling-storage";
import { suppliers } from "../server/modules/suppliers/entities/suppliers";
import { customers } from "../server/modules/customers/entities/customers";
import {
  warehouseTransactions,
  warehouses,
} from "../server/modules/warehouses/entities/warehouses";
import { WarehouseTransactionService } from "../server/modules/warehouses/services/warehouse-transaction-service";
import {
  equipmentTransactions,
  equipments,
} from "../server/modules/warehouses-equipment/entities/equipment";
import { EquipmentTransactionService } from "../server/modules/warehouses-equipment/services/equipment-transaction-service";

const firstDate = "2026-10-20T10:00:00.000Z";

type Fixture = {
  supplierId: string;
  customerId: string;
  warehouseIds: string[];
  equipmentIds: string[];
  deals: any[];
};

after(async () => {
  await pool.end();
});

function makeDeal(
  productType: string,
  supplierId: string,
  customerId: string,
  warehouseId: string,
  quantityKg: number,
  options: { isDraft?: boolean; refuelingDate?: string } = {},
) {
  return {
    refuelingDate: options.refuelingDate || firstDate,
    productType,
    supplierId,
    buyerId: customerId,
    warehouseId,
    quantityKg,
    purchasePrice: 10,
    purchaseAmount: quantityKg * 10,
    salePrice: 15,
    saleAmount: quantityKg * 15,
    isDraft: options.isDraft ?? false,
  } as any;
}

async function createFixture(
  productTypes: string[],
  options: {
    isDraft?: boolean;
    createSecondWarehouse?: boolean;
    useEquipment?: boolean;
  } = {},
): Promise<Fixture> {
  const [supplier] = await db
    .insert(suppliers)
    .values({ name: `refueling-atomicity-supplier-${crypto.randomUUID()}` })
    .returning();
  const [customer] = await db
    .insert(customers)
    .values({
      name: `refueling-atomicity-customer-${crypto.randomUUID()}`,
      module: "refueling",
    })
    .returning();

  const warehousesCreated = await db
    .insert(warehouses)
    .values(
      Array.from(
        { length: options.createSecondWarehouse ? 2 : 1 },
        (_, index) => ({
          name: `refueling-atomicity-warehouse-${index}-${crypto.randomUUID()}`,
          currentBalance: "100",
          averageCost: "10",
          pvkjBalance: "100",
          pvkjAverageCost: "10",
        }),
      ),
    )
    .returning();
  const warehouseIds = warehousesCreated.map((warehouse) => warehouse.id);
  const equipmentIds: string[] = [];

  try {
    if (options.useEquipment) {
      const [equipment] = await db
        .insert(equipments)
        .values({
          name: `refueling-atomicity-equipment-${crypto.randomUUID()}`,
          currentBalance: "100",
          averageCost: "10",
          pvkjBalance: "100",
          pvkjAverageCost: "10",
        })
        .returning();
      equipmentIds.push(equipment.id);
    }

    const storage = new AircraftRefuelingStorage();
    const deals = await storage.createRefuelings(
      productTypes.map((type) => {
        const deal = makeDeal(
          type,
          supplier.id,
          customer.id,
          warehouseIds[0],
          type === PRODUCT_TYPE.SERVICE ? 3 : 10,
          { isDraft: options.isDraft },
        );
        return options.useEquipment
          ? { ...deal, equipmentId: equipmentIds[0], warehouseId: null }
          : deal;
      }),
    );
    return {
      supplierId: supplier.id,
      customerId: customer.id,
      warehouseIds,
      equipmentIds,
      deals,
    };
  } catch (error) {
    if (equipmentIds.length) {
      await db
        .delete(equipmentTransactions)
        .where(inArray(equipmentTransactions.equipmentId, equipmentIds));
      await db.delete(equipments).where(inArray(equipments.id, equipmentIds));
    }
    await db.delete(warehouseTransactions).where(
      inArray(warehouseTransactions.warehouseId, warehouseIds),
    );
    await db.delete(warehouses).where(inArray(warehouses.id, warehouseIds));
    await db.delete(customers).where(sql`${customers.id} = ${customer.id}`);
    await db.delete(suppliers).where(sql`${suppliers.id} = ${supplier.id}`);
    throw error;
  }
}

async function cleanupFixture(fixture: Fixture) {
  const dealIds = fixture.deals.map((deal) => deal.id);
  if (fixture.equipmentIds.length) {
    await db
      .delete(equipmentTransactions)
      .where(inArray(equipmentTransactions.equipmentId, fixture.equipmentIds));
  }
  if (dealIds.length) {
    await db
      .delete(aircraftRefueling)
      .where(inArray(aircraftRefueling.id, dealIds));
  }
  await db
    .delete(warehouseTransactions)
    .where(inArray(warehouseTransactions.warehouseId, fixture.warehouseIds));
  await db
    .delete(warehouses)
    .where(inArray(warehouses.id, fixture.warehouseIds));
  if (fixture.equipmentIds.length) {
    await db.delete(equipments).where(inArray(equipments.id, fixture.equipmentIds));
  }
  await db.delete(customers).where(sql`${customers.id} = ${fixture.customerId}`);
  await db.delete(suppliers).where(sql`${suppliers.id} = ${fixture.supplierId}`);
}

async function readSnapshot(fixture: Fixture) {
  const dealIds = fixture.deals.map((deal) => deal.id);
  const [
    dealRows,
    transactionRows,
    warehouseRows,
    equipmentTransactionRows,
    equipmentRows,
  ] = await Promise.all([
    db
      .select()
      .from(aircraftRefueling)
      .where(inArray(aircraftRefueling.id, dealIds)),
    db
      .select()
      .from(warehouseTransactions)
      .where(inArray(warehouseTransactions.warehouseId, fixture.warehouseIds)),
    db
      .select()
      .from(warehouses)
      .where(inArray(warehouses.id, fixture.warehouseIds)),
    fixture.equipmentIds.length
      ? db
          .select()
          .from(equipmentTransactions)
          .where(inArray(equipmentTransactions.equipmentId, fixture.equipmentIds))
      : Promise.resolve([]),
    fixture.equipmentIds.length
      ? db
          .select()
          .from(equipments)
          .where(inArray(equipments.id, fixture.equipmentIds))
      : Promise.resolve([]),
  ]);
  return {
    deals: dealRows.sort((a, b) => a.id.localeCompare(b.id)),
    transactions: transactionRows.sort((a, b) => a.id.localeCompare(b.id)),
    warehouses: warehouseRows.sort((a, b) => a.id.localeCompare(b.id)),
    equipmentTransactions: equipmentTransactionRows.sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
    equipments: equipmentRows.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function editDeal(deal: any, quantityKg: number, refuelingDate: string, warehouseId = deal.warehouseId) {
  return {
    ...deal,
    quantityKg,
    purchaseAmount: quantityKg * 10,
    saleAmount: quantityKg * 15,
    refuelingDate,
    warehouseId,
  };
}

test("refueling order edits and failures preserve deals, movements, and stock atomically", async (t) => {
  const schemaResult = await db.execute(sql`
    SELECT
      to_regclass('aircraft_refueling') IS NOT NULL
        AND to_regclass('warehouse_transactions') IS NOT NULL
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
  const productSets = [
    [PRODUCT_TYPE.KEROSENE],
    [PRODUCT_TYPE.KEROSENE, PRODUCT_TYPE.PVKJ],
    [PRODUCT_TYPE.KEROSENE, PRODUCT_TYPE.PVKJ, PRODUCT_TYPE.SERVICE],
  ];

  for (const productTypes of productSets) {
    await t.test(`edits ${productTypes.length}-product orders repeatedly`, async () => {
      const fixture = await createFixture(productTypes);
      try {
        const originalIds = fixture.deals.map((deal) => deal.id).sort();
        for (const [editIndex, date] of [
          "2026-10-21T10:00:00.000Z",
          "2026-10-22T10:00:00.000Z",
        ].entries()) {
          const currentDeals = await storage.getRefuelingOrder(fixture.deals[0].id);
          const quantities = new Map(
            currentDeals.map((deal) => [
              deal.productType,
              Number(deal.quantityKg) + editIndex + 1,
            ]),
          );
          const updated = await storage.updateRefuelingOrder(
            fixture.deals[0].id,
            productTypes.map((type) => {
              const deal = currentDeals.find((item) => item.productType === type)!;
              return editDeal(deal, quantities.get(type)!, date);
            }),
          );

          assert.deepEqual(
            updated.deals.map((deal) => deal.id).sort(),
            originalIds,
            "re-editing should retain the existing product row IDs",
          );
          const reloaded = await storage.getRefuelingOrder(fixture.deals[0].id);
          for (const deal of reloaded) {
            assert.equal(new Date(deal.refuelingDate).toISOString(), date);
            assert.equal(Number(deal.quantityKg), quantities.get(deal.productType));
            if (
              deal.productType === PRODUCT_TYPE.KEROSENE ||
              deal.productType === PRODUCT_TYPE.PVKJ
            ) {
              const [transaction] = await db
                .select()
                .from(warehouseTransactions)
                .where(sql`${warehouseTransactions.id} = ${deal.transactionId}`);
              assert.ok(transaction, `${deal.productType} movement exists`);
              assert.equal(Number(transaction.quantity), -Number(deal.quantityKg));
              assert.equal(
                new Date(transaction.transactionDate!).toISOString(),
                date,
              );
              assert.equal(transaction.deletedAt, null);
            } else {
              assert.equal(deal.transactionId, null);
            }
          }

          const warehouse = await db.query.warehouses.findFirst({
            where: sql`${warehouses.id} = ${fixture.warehouseIds[0]}`,
          });
          const expectedKerosene = 100 -
            Number(reloaded.find((deal) => deal.productType === PRODUCT_TYPE.KEROSENE)?.quantityKg || 0);
          const expectedPvkj = 100 -
            Number(reloaded.find((deal) => deal.productType === PRODUCT_TYPE.PVKJ)?.quantityKg || 0);
          assert.equal(Number(warehouse?.currentBalance), expectedKerosene);
          assert.equal(Number(warehouse?.pvkjBalance), expectedPvkj);
        }
      } finally {
        await cleanupFixture(fixture);
      }
    });
  }

  await t.test("moves an edited order to a different warehouse", async () => {
    const fixture = await createFixture(
      [PRODUCT_TYPE.KEROSENE, PRODUCT_TYPE.PVKJ],
      { createSecondWarehouse: true },
    );
    try {
      const updated = await storage.updateRefuelingOrder(
        fixture.deals[0].id,
        fixture.deals.map((deal) =>
          editDeal(deal, Number(deal.quantityKg) + 2, "2026-10-23T10:00:00.000Z", fixture.warehouseIds[1]),
        ),
      );
      const [oldWarehouse, newWarehouse] = await Promise.all(
        fixture.warehouseIds.map((id) =>
          db.query.warehouses.findFirst({
            where: sql`${warehouses.id} = ${id}`,
          }),
        ),
      );

      assert.equal(Number(oldWarehouse?.currentBalance), 100);
      assert.equal(Number(oldWarehouse?.pvkjBalance), 100);
      assert.equal(Number(newWarehouse?.currentBalance), 88);
      assert.equal(Number(newWarehouse?.pvkjBalance), 88);
      for (const deal of updated.deals) {
        assert.equal(deal.warehouseId, fixture.warehouseIds[1]);
        const [transaction] = await db
          .select()
          .from(warehouseTransactions)
          .where(sql`${warehouseTransactions.id} = ${deal.transactionId}`);
        assert.equal(transaction.warehouseId, fixture.warehouseIds[1]);
      }
    } finally {
      await cleanupFixture(fixture);
    }
  });

  await t.test("editing a draft changes no stock movements", async () => {
    const fixture = await createFixture(
      [PRODUCT_TYPE.KEROSENE, PRODUCT_TYPE.PVKJ, PRODUCT_TYPE.SERVICE],
      { isDraft: true },
    );
    try {
      const updated = await storage.updateRefuelingOrder(
        fixture.deals[0].id,
        fixture.deals.map((deal) =>
          editDeal(deal, Number(deal.quantityKg) + 4, "2026-10-24T10:00:00.000Z"),
        ),
      );
      assert.ok(updated.deals.every((deal) => deal.isDraft));
      const snapshot = await readSnapshot(fixture);
      assert.equal(snapshot.transactions.length, 0);
      assert.equal(Number(snapshot.warehouses[0].currentBalance), 100);
      assert.equal(Number(snapshot.warehouses[0].pvkjBalance), 100);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  await t.test("a legacy single deal without an order ID remains editable", async () => {
    const fixture = await createFixture([PRODUCT_TYPE.KEROSENE]);
    try {
      await db
        .update(aircraftRefueling)
        .set({ refuelingOrderId: null })
        .where(sql`${aircraftRefueling.id} = ${fixture.deals[0].id}`);
      const [legacyDeal] = await db
        .select()
        .from(aircraftRefueling)
        .where(sql`${aircraftRefueling.id} = ${fixture.deals[0].id}`);
      const updated = await storage.updateRefuelingOrder(
        legacyDeal.id,
        [editDeal(legacyDeal, 17, "2026-10-25T10:00:00.000Z")],
      );
      assert.equal(updated.deals.length, 1);
      assert.equal(updated.deals[0].id, legacyDeal.id);
      assert.equal(Number(updated.deals[0].quantityKg), 17);
      assert.equal(
        new Date(updated.deals[0].refuelingDate).toISOString(),
        "2026-10-25T10:00:00.000Z",
      );
      const warehouse = await db.query.warehouses.findFirst({
        where: sql`${warehouses.id} = ${fixture.warehouseIds[0]}`,
      });
      assert.equal(Number(warehouse?.currentBalance), 83);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  await t.test("a failed stock update rolls back the whole multi-product edit", async () => {
    const fixture = await createFixture([
      PRODUCT_TYPE.KEROSENE,
      PRODUCT_TYPE.PVKJ,
    ]);
    const before = await readSnapshot(fixture);
    const originalCreate = WarehouseTransactionService.createTransactionAndUpdateWarehouse;
    try {
      (WarehouseTransactionService as any).createTransactionAndUpdateWarehouse = async (
        ...args: any[]
      ) => {
        const result = await originalCreate.apply(
          WarehouseTransactionService,
          args,
        );
        if (args[3] === PRODUCT_TYPE.PVKJ) {
          throw new Error("Simulated failure after applying PVKJ stock movement");
        }
        return result;
      };

      await assert.rejects(
        storage.updateRefuelingOrder(
          fixture.deals[0].id,
          fixture.deals.map((deal) =>
            editDeal(deal, Number(deal.quantityKg) + 5, "2026-10-26T10:00:00.000Z"),
          ),
        ),
        /Simulated failure/,
      );
      assert.deepEqual(await readSnapshot(fixture), before);
    } finally {
      WarehouseTransactionService.createTransactionAndUpdateWarehouse = originalCreate;
      await cleanupFixture(fixture);
    }
  });

  await t.test("a failed equipment movement rolls back the whole multi-product edit", async () => {
    const fixture = await createFixture(
      [PRODUCT_TYPE.KEROSENE, PRODUCT_TYPE.PVKJ, PRODUCT_TYPE.SERVICE],
      { useEquipment: true },
    );
    assert.ok(
      fixture.deals.every((deal) => deal.equipmentId === fixture.equipmentIds[0]),
      "all product rows in the order should point to the fuel equipment",
    );
    const initialEquipmentMovements = await db
      .select()
      .from(equipmentTransactions)
      .where(inArray(equipmentTransactions.equipmentId, fixture.equipmentIds));
    assert.equal(
      initialEquipmentMovements.length,
      2,
      "kerosene and PVKJ should each have an equipment movement",
    );
    const before = await readSnapshot(fixture);
    const originalCreate =
      EquipmentTransactionService.createTransactionAndUpdateEquipment;
    let appliedMovementCount = 0;
    try {
      (EquipmentTransactionService as any).createTransactionAndUpdateEquipment =
        async (...args: any[]) => {
          const result = await originalCreate.apply(
            EquipmentTransactionService,
            args,
          );
          appliedMovementCount += 1;
          if (appliedMovementCount === 1) {
            throw new Error(
              "Simulated failure after applying the first equipment movement",
            );
          }
          return result;
        };

      await assert.rejects(
        storage.updateRefuelingOrder(
          fixture.deals[0].id,
          fixture.deals.map((deal) =>
            editDeal(
              deal,
              Number(deal.quantityKg) + 5,
              "2026-10-26T10:00:00.000Z",
            ),
          ),
        ),
        /Simulated failure/,
      );
      assert.equal(
        appliedMovementCount,
        1,
        "the failure should occur after one equipment movement was applied",
      );
      assert.deepEqual(await readSnapshot(fixture), before);
    } finally {
      EquipmentTransactionService.createTransactionAndUpdateEquipment =
        originalCreate;
      await cleanupFixture(fixture);
    }
  });

  await t.test("a failed movement restoration leaves the deleted order unchanged", async () => {
    const fixture = await createFixture([
      PRODUCT_TYPE.KEROSENE,
      PRODUCT_TYPE.PVKJ,
    ]);
    const originalRestore = WarehouseTransactionService.restoreTransactionAndRecalculateWarehouse;
    try {
      await storage.deleteRefuelingOrder(fixture.deals[0].id);
      const before = await readSnapshot(fixture);
      let restoreCount = 0;
      (WarehouseTransactionService as any).restoreTransactionAndRecalculateWarehouse = async (
        ...args: any[]
      ) => {
        const result = await originalRestore.apply(
          WarehouseTransactionService,
          args,
        );
        restoreCount += 1;
        if (restoreCount === 2) {
          throw new Error("Simulated failure after restoring the second movement");
        }
        return result;
      };

      await assert.rejects(
        storage.restoreRefuelingOrder(fixture.deals[0].id),
        /Simulated failure/,
      );
      assert.equal(restoreCount, 2);
      assert.deepEqual(await readSnapshot(fixture), before);
    } finally {
      WarehouseTransactionService.restoreTransactionAndRecalculateWarehouse = originalRestore;
      await cleanupFixture(fixture);
    }
  });
});
