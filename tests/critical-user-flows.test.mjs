import assert from "node:assert/strict";
import { after, test } from "node:test";
import pg from "pg";

const { Pool } = pg;
const baseUrl = process.env.E2E_BASE_URL;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let sessionCookie;

after(async () => {
  await pool.end();
});

async function api(path, { method = "GET", body, expectedStatus = 200 } = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) sessionCookie = setCookie.split(";", 1)[0];
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  assert.equal(
    response.status,
    expectedStatus,
    `${method} ${path}: expected ${expectedStatus}, received ${response.status}: ${text}`,
  );
  return data;
}

async function getInventory(warehouseId, equipmentId) {
  const [warehouse, equipment] = await Promise.all([
    pool.query(
      `SELECT current_balance, pvkj_balance FROM warehouses WHERE id = $1`,
      [warehouseId],
    ),
    pool.query(
      `SELECT current_balance, pvkj_balance FROM equipments WHERE id = $1`,
      [equipmentId],
    ),
  ]);
  return {
    warehouseKerosene: Number(warehouse.rows[0]?.current_balance),
    warehousePvkj: Number(warehouse.rows[0]?.pvkj_balance),
    equipmentKerosene: Number(equipment.rows[0]?.current_balance),
    equipmentPvkj: Number(equipment.rows[0]?.pvkj_balance),
  };
}

async function latestAuditId(entityType, entityId, operation = "DELETE") {
  const result = await pool.query(
    `SELECT id FROM audit_log
     WHERE entity_type = $1 AND entity_id = $2 AND operation = $3
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [entityType, entityId, operation],
  );
  assert.ok(result.rows[0]?.id, `audit row exists for ${entityType}:${entityId}`);
  return result.rows[0].id;
}

async function getQueueCount(table, ownerColumn, ownerId, productType) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM ${table}
     WHERE ${ownerColumn} = $1 AND product_type = $2`,
    [ownerId, productType],
  );
  return result.rows[0].count;
}

async function waitForCompletedQueue(
  table,
  ownerColumn,
  ownerId,
  productType,
  previousCount = 0,
) {
  const deadline = Date.now() + 45_000;
  let rows = [];
  while (Date.now() < deadline) {
    const result = await pool.query(
      `SELECT status FROM ${table}
       WHERE ${ownerColumn} = $1 AND product_type = $2
       ORDER BY created_at`,
      [ownerId, productType],
    );
    rows = result.rows;
    assert.ok(
      !rows.some((row) => row.status === "failed"),
      `${table} has no failed recalculation tasks`,
    );
    if (
      rows.length > previousCount &&
      rows.every((row) => row.status === "completed")
    ) {
      return rows;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.fail(
    `Timed out waiting for ${table} recalculation; last states: ${JSON.stringify(rows)}`,
  );
}

function makeRefuelingDeal({
  productType,
  date,
  supplierId,
  buyerId,
  warehouseId,
  equipmentId,
  quantityKg,
  purchasePrice,
  salePrice,
}) {
  const purchaseAmount = quantityKg * purchasePrice;
  const saleAmount = quantityKg * salePrice;
  return {
    refuelingDate: date,
    productType,
    supplierId,
    buyerId,
    warehouseId: warehouseId ?? null,
    equipmentId: equipmentId ?? null,
    equipmentType: "common",
    inputMode: "kg",
    quantityKg,
    purchasePrice,
    purchaseAmount,
    salePrice,
    saleAmount,
    profit: saleAmount - purchaseAmount,
    isDraft: false,
    isAgentFeeEnabled: true,
    isOtherServiceEnabled: true,
  };
}

function assertDealEconomics(deals) {
  for (const deal of deals) {
    const enabledAgentFee =
      deal.isAgentFeeEnabled === false ? 0 : Number(deal.agentFee || 0);
    const enabledOtherFee =
      deal.isOtherServiceEnabled === false
        ? 0
        : Number(deal.otherServiceFee || 0);
    const expectedProfit =
      Number(deal.saleAmount || 0) -
      Number(deal.purchaseAmount || 0) -
      enabledAgentFee -
      enabledOtherFee;
    assert.ok(
      Math.abs(Number(deal.profit || 0) - expectedProfit) < 0.011,
      `profit reconciles for ${deal.productType}`,
    );
  }
}

test("authenticated refueling and OPT flows reconcile inventory, audit, and retroactive changes", async () => {
  assert.ok(baseUrl, "E2E_BASE_URL is required");
  assert.ok(process.env.E2E_ADMIN_EMAIL, "E2E_ADMIN_EMAIL is required");
  assert.ok(process.env.E2E_ADMIN_PASSWORD, "E2E_ADMIN_PASSWORD is required");

  const unauthorized = await api("/api/auth/user", { expectedStatus: 401 });
  assert.equal(unauthorized.message, "Не авторизован");

  const registered = await api("/api/auth/register", {
    method: "POST",
    expectedStatus: 201,
    body: {
      email: process.env.E2E_ADMIN_EMAIL,
      password: process.env.E2E_ADMIN_PASSWORD,
      confirmPassword: process.env.E2E_ADMIN_PASSWORD,
      firstName: "Critical",
      lastName: "Flow",
    },
  });
  assert.equal(registered.role?.name, "Админ");
  assert.ok(sessionCookie, "registration establishes an HTTP session");

  await api("/api/auth/logout", { method: "POST" });
  sessionCookie = undefined;
  const loggedIn = await api("/api/auth/login", {
    method: "POST",
    body: {
      email: process.env.E2E_ADMIN_EMAIL,
      password: process.env.E2E_ADMIN_PASSWORD,
    },
  });
  assert.equal(loggedIn.role?.name, "Админ");

  const supplier = (
    await pool.query(
      `INSERT INTO suppliers (name) VALUES ('critical-flow-supplier') RETURNING id`,
    )
  ).rows[0];
  const refuelingBuyer = (
    await pool.query(
      `INSERT INTO customers (name, module)
       VALUES ('critical-flow-refueling-buyer', 'refueling') RETURNING id`,
    )
  ).rows[0];
  const wholesaleBuyer = (
    await pool.query(
      `INSERT INTO customers (name, module)
       VALUES ('critical-flow-wholesale-buyer', 'wholesale') RETURNING id`,
    )
  ).rows[0];
  const warehouse = (
    await pool.query(
      `INSERT INTO warehouses
         (name, current_balance, average_cost, pvkj_balance, pvkj_average_cost)
       VALUES ('critical-flow-warehouse', 1000, 10, 1000, 12)
       RETURNING id`,
    )
  ).rows[0];
  const equipment = (
    await pool.query(
      `INSERT INTO equipments (name, current_balance, average_cost, pvkj_balance, pvkj_average_cost)
       VALUES ('critical-flow-equipment', 1000, 10, 1000, 12)
       RETURNING id`,
    )
  ).rows[0];

  const initialDeals = [
    makeRefuelingDeal({
      productType: "kerosene",
      date: "2026-10-20T12:00:00.000Z",
      supplierId: supplier.id,
      buyerId: refuelingBuyer.id,
      warehouseId: warehouse.id,
      quantityKg: 10,
      purchasePrice: 10,
      salePrice: 15,
    }),
    makeRefuelingDeal({
      productType: "pvkj",
      date: "2026-10-20T12:00:00.000Z",
      supplierId: supplier.id,
      buyerId: refuelingBuyer.id,
      equipmentId: equipment.id,
      quantityKg: 7,
      purchasePrice: 12,
      salePrice: 18,
    }),
    makeRefuelingDeal({
      productType: "service",
      date: "2026-10-20T12:00:00.000Z",
      supplierId: supplier.id,
      buyerId: refuelingBuyer.id,
      quantityKg: 17,
      purchasePrice: 0,
      salePrice: 2,
    }),
  ];
  const createdOrder = await api("/api/refueling/bulk", {
    method: "POST",
    expectedStatus: 201,
    body: { deals: initialDeals },
  });
  assert.equal(createdOrder.length, 3);
  assert.equal(new Set(createdOrder.map((deal) => deal.refuelingOrderId)).size, 1);
  assertDealEconomics(createdOrder);
  const anchorId = createdOrder.find((deal) => deal.productType === "kerosene").id;
  const originalIds = new Map(
    createdOrder.map((deal) => [deal.productType, deal.id]),
  );
  assert.deepEqual(await getInventory(warehouse.id, equipment.id), {
    warehouseKerosene: 990,
    warehousePvkj: 1000,
    equipmentKerosene: 1000,
    equipmentPvkj: 993,
  });

  const laterOrder = await api("/api/refueling/bulk", {
    method: "POST",
    expectedStatus: 201,
    body: {
      deals: [
        makeRefuelingDeal({
          productType: "kerosene",
          date: "2026-10-26T12:00:00.000Z",
          supplierId: supplier.id,
          buyerId: refuelingBuyer.id,
          warehouseId: warehouse.id,
          quantityKg: 2,
          purchasePrice: 10,
          salePrice: 15,
        }),
        makeRefuelingDeal({
          productType: "pvkj",
          date: "2026-10-26T12:00:00.000Z",
          supplierId: supplier.id,
          buyerId: refuelingBuyer.id,
          equipmentId: equipment.id,
          quantityKg: 2,
          purchasePrice: 12,
          salePrice: 18,
        }),
      ],
    },
  });
  assert.equal(laterOrder.length, 2);

  const backdatedDeals = [
    makeRefuelingDeal({
      productType: "kerosene",
      date: "2026-10-15T12:00:00.000Z",
      supplierId: supplier.id,
      buyerId: refuelingBuyer.id,
      warehouseId: warehouse.id,
      quantityKg: 11,
      purchasePrice: 10,
      salePrice: 15,
    }),
    makeRefuelingDeal({
      productType: "pvkj",
      date: "2026-10-15T12:00:00.000Z",
      supplierId: supplier.id,
      buyerId: refuelingBuyer.id,
      equipmentId: equipment.id,
      quantityKg: 8,
      purchasePrice: 12,
      salePrice: 18,
    }),
    makeRefuelingDeal({
      productType: "service",
      date: "2026-10-15T12:00:00.000Z",
      supplierId: supplier.id,
      buyerId: refuelingBuyer.id,
      quantityKg: 19,
      purchasePrice: 0,
      salePrice: 2,
    }),
  ];
  const editedOrder = await api(`/api/refueling/order/${anchorId}`, {
    method: "PUT",
    body: { deals: backdatedDeals },
  });
  assert.equal(editedOrder.length, 3);
  assert.equal(
    editedOrder.find((deal) => deal.productType === "kerosene").id,
    originalIds.get("kerosene"),
  );
  assert.equal(
    editedOrder.find((deal) => deal.productType === "pvkj").id,
    originalIds.get("pvkj"),
  );
  assert.equal(
    editedOrder.find((deal) => deal.productType === "service").id,
    originalIds.get("service"),
    "retained product rows keep their IDs",
  );
  assertDealEconomics(editedOrder);

  const laterService = makeRefuelingDeal({
    productType: "service",
    date: "2026-10-15T12:00:00.000Z",
    supplierId: supplier.id,
    buyerId: refuelingBuyer.id,
    quantityKg: 19,
    purchasePrice: 0,
    salePrice: 2,
  });
  const withoutService = backdatedDeals.filter(
    (deal) => deal.productType !== "service",
  );
  const removedServiceId = editedOrder.find(
    (deal) => deal.productType === "service",
  ).id;
  const removedServiceEdit = await api(`/api/refueling/order/${anchorId}`, {
    method: "PUT",
    body: { deals: withoutService },
  });
  assert.equal(removedServiceEdit.length, 2);
  const removedService = await pool.query(
    `SELECT deleted_at FROM aircraft_refueling WHERE id = $1`,
    [removedServiceId],
  );
  assert.ok(removedService.rows[0]?.deleted_at, "removed product is soft-deleted");

  const addedServiceEdit = await api(`/api/refueling/order/${anchorId}`, {
    method: "PUT",
    body: {
      deals: [...withoutService, laterService],
    },
  });
  assert.equal(addedServiceEdit.length, 3);
  assert.notEqual(
    addedServiceEdit.find((deal) => deal.productType === "service").id,
    removedServiceId,
    "re-adding a removed product creates a fresh row",
  );
  assert.deepEqual(await getInventory(warehouse.id, equipment.id), {
    warehouseKerosene: 987,
    warehousePvkj: 1000,
    equipmentKerosene: 1000,
    equipmentPvkj: 990,
  });

  await waitForCompletedQueue(
    "recalculation_queue",
    "warehouse_id",
    warehouse.id,
    "kerosene",
  );
  await waitForCompletedQueue(
    "equipment_recalculation_queue",
    "equipment_id",
    equipment.id,
    "pvkj",
  );

  const refuelingAuditEntries = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM audit_log
     WHERE entity_type = 'aircraft_refueling'
       AND entity_id = ANY($1::uuid[])`,
    [addedServiceEdit.map((deal) => deal.id)],
  );
  assert.ok(refuelingAuditEntries.rows[0].count >= 6);

  const deleteOrder = await api(`/api/refueling/order/${anchorId}`, {
    method: "DELETE",
  });
  assert.equal(deleteOrder.deletedDeals, 3);
  assert.deepEqual(await getInventory(warehouse.id, equipment.id), {
    warehouseKerosene: 998,
    warehousePvkj: 1000,
    equipmentKerosene: 1000,
    equipmentPvkj: 998,
  });
  const refuelingDeleteAuditId = await latestAuditId(
    "aircraft_refueling",
    anchorId,
  );
  const restoredOrder = await api(
    `/api/audit/rollback/${refuelingDeleteAuditId}`,
    { method: "POST", body: {} },
  );
  assert.equal(restoredOrder.success, true);
  const restoredRefuelingDeals = await api(`/api/refueling/order/${anchorId}`);
  assert.equal(restoredRefuelingDeals.length, 3);
  assert.deepEqual(await getInventory(warehouse.id, equipment.id), {
    warehouseKerosene: 987,
    warehousePvkj: 1000,
    equipmentKerosene: 1000,
    equipmentPvkj: 990,
  });
  assertDealEconomics(restoredRefuelingDeals);

  const optCreated = await api("/api/opt", {
    method: "POST",
    expectedStatus: 201,
    body: {
      supplierId: supplier.id,
      buyerId: wholesaleBuyer.id,
      warehouseId: warehouse.id,
      dealDate: "2026-10-26T12:00:00.000Z",
      productType: "kerosene",
      quantityKg: 20,
      inputMode: "kg",
      purchasePrice: 10,
      salePrice: 15,
      purchaseAmount: 200,
      saleAmount: 300,
      profit: 100,
      isDraft: false,
      isNoDeliveryRequired: true,
    },
  });
  assert.equal(Number(optCreated.quantityKg), 20);
  assert.equal(Number(optCreated.profit), 100);
  assert.equal((await getInventory(warehouse.id, equipment.id)).warehouseKerosene, 967);

  const previousWarehouseQueueCount = await getQueueCount(
    "recalculation_queue",
    "warehouse_id",
    warehouse.id,
    "kerosene",
  );
  const optUpdated = await api(`/api/opt/${optCreated.id}`, {
    method: "PATCH",
    body: {
      dealDate: "2026-10-10T12:00:00.000Z",
      quantityKg: 25,
      purchasePrice: 10,
      salePrice: 15,
      purchaseAmount: 250,
      saleAmount: 375,
      profit: 125,
    },
  });
  assert.equal(Number(optUpdated.quantityKg), 25);
  assert.equal(Number(optUpdated.profit), 125);
  assert.equal((await getInventory(warehouse.id, equipment.id)).warehouseKerosene, 962);
  await waitForCompletedQueue(
    "recalculation_queue",
    "warehouse_id",
    warehouse.id,
    "kerosene",
    previousWarehouseQueueCount,
  );

  const optMovement = await pool.query(
    `SELECT quantity, transaction_date, deleted_at
     FROM warehouse_transactions WHERE id = $1`,
    [optUpdated.transactionId],
  );
  assert.equal(Number(optMovement.rows[0]?.quantity), -25);
  assert.equal(optMovement.rows[0]?.deleted_at, null);
  assert.equal(
    new Date(optMovement.rows[0]?.transaction_date).toISOString().slice(0, 10),
    "2026-10-10",
  );
  assertDealEconomics([optUpdated]);

  const deleteOpt = await api(`/api/opt/${optCreated.id}`, { method: "DELETE" });
  assert.equal(deleteOpt.message, "Сделка удалена");
  assert.equal((await getInventory(warehouse.id, equipment.id)).warehouseKerosene, 987);
  const optDeleteAuditId = await latestAuditId("opt", optCreated.id);
  const restoredOpt = await api(`/api/audit/rollback/${optDeleteAuditId}`, {
    method: "POST",
    body: {},
  });
  assert.equal(restoredOpt.success, true);
  const activeOpt = await api(`/api/opt/${optCreated.id}`);
  assert.equal(Number(activeOpt.quantityKg), 25);
  assert.equal(Number(activeOpt.profit), 125);
  assert.equal((await getInventory(warehouse.id, equipment.id)).warehouseKerosene, 962);

  const auditCounts = await pool.query(
    `SELECT entity_type, COUNT(*)::int AS count
     FROM audit_log
     WHERE entity_id = ANY($1::uuid[])
     GROUP BY entity_type`,
    [[...addedServiceEdit.map((deal) => deal.id), optCreated.id]],
  );
  assert.ok(auditCounts.rows.some((row) => row.entity_type === "aircraft_refueling"));
  assert.ok(auditCounts.rows.some((row) => row.entity_type === "opt"));
});
