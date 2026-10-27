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
  // Middleware audit writes finish asynchronously after the HTTP response.
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const result = await pool.query(
      `SELECT id FROM audit_log
       WHERE entity_type = $1 AND entity_id = $2 AND operation = $3
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [entityType, entityId, operation],
    );
    if (result.rows[0]?.id) return result.rows[0].id;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`Timed out waiting for ${operation} audit row for ${entityType}:${entityId}`);
}

async function waitForAuditOperations(entityType, entityId, operations) {
  const expected = new Set(operations);
  const deadline = Date.now() + 10_000;
  let found = new Set();
  while (Date.now() < deadline) {
    const result = await pool.query(
      `SELECT operation FROM audit_log
       WHERE entity_type = $1 AND entity_id = $2`,
      [entityType, entityId],
    );
    found = new Set(result.rows.map((row) => row.operation));
    if ([...expected].every((operation) => found.has(operation))) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(
    `Audit history for ${entityType}:${entityId} is missing ${[...expected]
      .filter((operation) => !found.has(operation))
      .join(", ")}`,
  );
}

async function getStock(table, id) {
  assert.ok(
    table === "warehouses" || table === "equipments",
    `unsupported stock table: ${table}`,
  );
  const result = await pool.query(
    `SELECT current_balance, average_cost FROM ${table} WHERE id = $1`,
    [id],
  );
  assert.ok(result.rows[0], `${table} stock record exists`);
  return {
    quantity: Number(result.rows[0].current_balance),
    averageCost: Number(result.rows[0].average_cost),
  };
}

function assertStock(actual, quantity, averageCost, label) {
  assert.ok(
    Math.abs(actual.quantity - quantity) < 0.011,
    `${label} quantity: expected ${quantity}, received ${actual.quantity}`,
  );
  assert.ok(
    Math.abs(actual.averageCost - averageCost) < 0.011,
    `${label} average cost: expected ${averageCost}, received ${actual.averageCost}`,
  );
}

async function waitForCompletedQueue(table, ownerColumn, ownerId, productType) {
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
    if (rows.length > 0 && rows.every((row) => row.status === "completed")) {
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
  await pool.query(
    `INSERT INTO warehouse_transactions
       (warehouse_id, transaction_type, product_type, quantity, source_type,
        balance_before, balance_after, average_cost_before, average_cost_after,
        sum, price, transaction_date)
     VALUES ($1, 'receipt', 'kerosene', 1000, 'critical_flow_seed',
             0, 1000, 0, 10, 10000, 10, '2026-10-01T00:00:00.000Z')`,
    [warehouse.id],
  );
  await pool.query(
    `INSERT INTO equipment_transactions
       (equipment_id, transaction_type, product_type, quantity, source_type,
        balance_before, balance_after, average_cost_before, average_cost_after,
        sum, price, transaction_date)
     VALUES ($1, 'receipt', 'pvkj', 1000, 'critical_flow_seed',
             0, 1000, 0, 12, 12000, 12, '2026-10-01T00:00:00.000Z')`,
    [equipment.id],
  );

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
  const previouslyRemovedService = await pool.query(
    `SELECT deleted_at FROM aircraft_refueling WHERE id = $1`,
    [removedServiceId],
  );
  assert.ok(
    previouslyRemovedService.rows[0]?.deleted_at,
    "restoring an order does not revive a product removed in an earlier edit",
  );
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

  // Internal warehouse transfers must keep both ledgers and weighted cost in sync,
  // including when an existing transfer is edited to an earlier business date.
  const transferWarehouse = (
    await pool.query(
      `INSERT INTO warehouses (name, current_balance, average_cost)
       VALUES ('critical-flow-transfer-warehouse', 0, 0)
       RETURNING id`,
    )
  ).rows[0];
  const sourceBeforeTransfer = await getStock("warehouses", warehouse.id);
  const transferCreated = await api("/api/movement", {
    method: "POST",
    expectedStatus: 201,
    body: {
      movementDate: "2026-10-26T08:00:00.000Z",
      movementType: "internal",
      productType: "kerosene",
      fromWarehouseId: warehouse.id,
      toWarehouseId: transferWarehouse.id,
      quantityKg: 20,
      purchasePrice: 10,
      totalCost: 200,
      costPerKg: 10,
      isDraft: false,
      notes: "critical flow warehouse transfer",
    },
  });
  const transferId = transferCreated.id;
  assert.ok(transferId, "warehouse transfer is created");
  assertStock(
    await getStock("warehouses", warehouse.id),
    sourceBeforeTransfer.quantity - 20,
    sourceBeforeTransfer.averageCost,
    "warehouse transfer source after create",
  );
  assertStock(
    await getStock("warehouses", transferWarehouse.id),
    20,
    10,
    "warehouse transfer destination after create",
  );

  const transferUpdated = await api(`/api/movement/${transferId}`, {
    method: "PATCH",
    body: {
      movementDate: "2026-10-05T08:00:00.000Z",
      movementType: "internal",
      productType: "kerosene",
      fromWarehouseId: warehouse.id,
      toWarehouseId: transferWarehouse.id,
      quantityKg: 25,
      totalCost: 250,
      costPerKg: 10,
      isDraft: false,
      notes: "critical flow warehouse transfer edited retroactively",
    },
  });
  assert.equal(transferUpdated.id, transferId);
  await waitForCompletedQueue(
    "recalculation_queue",
    "warehouse_id",
    warehouse.id,
    "kerosene",
  );
  await waitForCompletedQueue(
    "recalculation_queue",
    "warehouse_id",
    transferWarehouse.id,
    "kerosene",
  );
  assertStock(
    await getStock("warehouses", warehouse.id),
    sourceBeforeTransfer.quantity - 25,
    sourceBeforeTransfer.averageCost,
    "warehouse transfer source after backdated edit",
  );
  assertStock(
    await getStock("warehouses", transferWarehouse.id),
    25,
    10,
    "warehouse transfer destination after backdated edit",
  );
  const activeWarehouseTransactions = await pool.query(
    `SELECT transaction_type, quantity, sum, deleted_at
     FROM warehouse_transactions
     WHERE source_type = 'movement' AND source_id = $1
     ORDER BY transaction_type`,
    [transferId],
  );
  assert.equal(activeWarehouseTransactions.rows.length, 2);
  assert.deepEqual(
    activeWarehouseTransactions.rows.map((row) => row.transaction_type).sort(),
    ["transfer_in", "transfer_out"],
  );
  assert.ok(
    activeWarehouseTransactions.rows.every((row) => row.deleted_at === null),
    "both active warehouse transactions remain linked to the transfer",
  );
  assert.deepEqual(
    activeWarehouseTransactions.rows.map((row) => Number(row.quantity)).sort((a, b) => a - b),
    [-25, 25],
    "transfer source and destination quantities reconcile",
  );
  assert.ok(
    Math.abs(Number(activeWarehouseTransactions.rows.find((row) => row.transaction_type === "transfer_in").sum) - 250) < 0.011,
    "the destination movement retains the transferred acquisition cost",
  );
  await waitForAuditOperations("movement", transferId, ["CREATE", "UPDATE"]);
  await api(`/api/movement/${transferId}`, { method: "DELETE" });
  await waitForCompletedQueue(
    "recalculation_queue",
    "warehouse_id",
    warehouse.id,
    "kerosene",
  );
  await waitForCompletedQueue(
    "recalculation_queue",
    "warehouse_id",
    transferWarehouse.id,
    "kerosene",
  );
  assertStock(
    await getStock("warehouses", warehouse.id),
    sourceBeforeTransfer.quantity,
    sourceBeforeTransfer.averageCost,
    "warehouse transfer source after delete",
  );
  assertStock(
    await getStock("warehouses", transferWarehouse.id),
    0,
    0,
    "warehouse transfer destination after delete",
  );
  const deletedWarehouseTransactions = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM warehouse_transactions
     WHERE source_type = 'movement' AND source_id = $1 AND deleted_at IS NOT NULL`,
    [transferId],
  );
  assert.equal(
    deletedWarehouseTransactions.rows[0].count,
    2,
    "deleting a transfer soft-deletes both inventory movements",
  );
  const transferDeleteAuditId = await latestAuditId("movement", transferId);
  const restoredTransfer = await api(
    `/api/audit/rollback/${transferDeleteAuditId}`,
    { method: "POST", body: {} },
  );
  assert.equal(restoredTransfer.success, true);
  await waitForCompletedQueue(
    "recalculation_queue",
    "warehouse_id",
    warehouse.id,
    "kerosene",
  );
  await waitForCompletedQueue(
    "recalculation_queue",
    "warehouse_id",
    transferWarehouse.id,
    "kerosene",
  );
  assertStock(
    await getStock("warehouses", warehouse.id),
    sourceBeforeTransfer.quantity - 25,
    sourceBeforeTransfer.averageCost,
    "warehouse transfer source after restore",
  );
  assertStock(
    await getStock("warehouses", transferWarehouse.id),
    25,
    10,
    "warehouse transfer destination after restore",
  );
  const restoredWarehouseTransactions = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM warehouse_transactions
     WHERE source_type = 'movement' AND source_id = $1 AND deleted_at IS NULL`,
    [transferId],
  );
  assert.equal(
    restoredWarehouseTransactions.rows[0].count,
    2,
    "restoring a transfer restores both inventory movements",
  );
  await waitForAuditOperations("movement", transferId, ["CREATE", "UPDATE", "DELETE", "RESTORE"]);

  // A transfer between a warehouse and fuel equipment has the same lifecycle.
  const transferEquipment = (
    await pool.query(
      `INSERT INTO equipments (name, current_balance, average_cost)
       VALUES ('critical-flow-transfer-equipment', 0, 0)
       RETURNING id`,
    )
  ).rows[0];
  const kilogramUnit = (
    await pool.query(
      `INSERT INTO units_of_measure (short_name, full_name)
       VALUES ('kg-critical-flow', 'Kilogram critical flow')
       RETURNING id`,
    )
  ).rows[0];
  const keroseneNomenclature = (
    await pool.query(
      `INSERT INTO nomenclature (product_type, name, unit_id)
       VALUES ('kerosene', 'critical-flow-kerosene', $1)
       RETURNING id`,
      [kilogramUnit.id],
    )
  ).rows[0];
  const sourceBeforeEquipmentTransfer = await getStock("warehouses", warehouse.id);
  const equipmentTransferCreated = await api("/api/equipment-movement", {
    method: "POST",
    expectedStatus: 201,
    body: {
      movementDate: "2026-10-26T09:00:00.000Z",
      movementType: "storage_to_tzk",
      productType: "kerosene",
      nomenclatureId: keroseneNomenclature.id,
      fromWarehouseId: warehouse.id,
      toEquipmentId: transferEquipment.id,
      quantityKg: "10",
      totalCost: 100,
      costPerKg: 10,
      isDraft: false,
      notes: "critical flow warehouse to equipment",
    },
  });
  const equipmentTransferId = equipmentTransferCreated.id;
  assert.ok(equipmentTransferId, "warehouse-to-equipment transfer is created");
  assertStock(
    await getStock("warehouses", warehouse.id),
    sourceBeforeEquipmentTransfer.quantity - 10,
    sourceBeforeEquipmentTransfer.averageCost,
    "equipment transfer warehouse source after create",
  );
  assertStock(
    await getStock("equipments", transferEquipment.id),
    10,
    10,
    "equipment transfer destination after create",
  );

  await api(`/api/equipment-movement/${equipmentTransferId}`, {
    method: "PATCH",
    body: {
      movementDate: "2026-10-06T09:00:00.000Z",
      movementType: "storage_to_tzk",
      productType: "kerosene",
      nomenclatureId: keroseneNomenclature.id,
      fromWarehouseId: warehouse.id,
      toEquipmentId: transferEquipment.id,
      quantityKg: "15",
      totalCost: 150,
      costPerKg: 10,
      isDraft: false,
      notes: "critical flow warehouse to equipment edited retroactively",
    },
  });
  await waitForCompletedQueue(
    "recalculation_queue",
    "warehouse_id",
    warehouse.id,
    "kerosene",
  );
  assertStock(
    await getStock("warehouses", warehouse.id),
    sourceBeforeEquipmentTransfer.quantity - 15,
    sourceBeforeEquipmentTransfer.averageCost,
    "equipment transfer warehouse source after backdated edit",
  );
  assertStock(
    await getStock("equipments", transferEquipment.id),
    15,
    10,
    "equipment transfer destination after backdated edit",
  );
  const equipmentTransferRecord = await api(
    `/api/equipment-movement/${equipmentTransferId}`,
  );
  const equipmentTransferWarehouseRow = await pool.query(
    `SELECT transaction_type, quantity, deleted_at
     FROM warehouse_transactions WHERE id = $1`,
    [equipmentTransferRecord.sourceWarehouseTransactionId],
  );
  assert.equal(equipmentTransferWarehouseRow.rows.length, 1);
  assert.equal(equipmentTransferWarehouseRow.rows[0].transaction_type, "transfer_out");
  assert.equal(Number(equipmentTransferWarehouseRow.rows[0].quantity), -15);
  assert.equal(
    equipmentTransferWarehouseRow.rows[0].deleted_at,
    null,
    "the warehouse source movement remains active",
  );
  const equipmentTransferEquipmentRow = await pool.query(
    `SELECT transaction_type, quantity, sum, deleted_at
     FROM equipment_transactions WHERE id = $1`,
    [equipmentTransferRecord.transactionId],
  );
  assert.equal(equipmentTransferEquipmentRow.rows.length, 1);
  assert.equal(equipmentTransferEquipmentRow.rows[0].transaction_type, "transfer_in");
  assert.equal(Number(equipmentTransferEquipmentRow.rows[0].quantity), 15);
  assert.ok(
    Math.abs(Number(equipmentTransferEquipmentRow.rows[0].sum) - 150) < 0.011,
    "equipment receipt keeps the source transfer cost",
  );
  assert.equal(
    equipmentTransferEquipmentRow.rows[0].deleted_at,
    null,
    "the equipment destination movement remains active",
  );
  const equipmentTransferDeleteAuditWait = waitForAuditOperations(
    "equipment_movement",
    equipmentTransferId,
    ["CREATE", "UPDATE"],
  );
  await equipmentTransferDeleteAuditWait;
  await api(`/api/equipment-movement/${equipmentTransferId}`, { method: "DELETE" });
  await waitForCompletedQueue(
    "recalculation_queue",
    "warehouse_id",
    warehouse.id,
    "kerosene",
  );
  assertStock(
    await getStock("warehouses", warehouse.id),
    sourceBeforeEquipmentTransfer.quantity,
    sourceBeforeEquipmentTransfer.averageCost,
    "equipment transfer warehouse source after delete",
  );
  assertStock(
    await getStock("equipments", transferEquipment.id),
    0,
    10,
    "equipment transfer destination after delete",
  );
  const equipmentTransferDeleteAuditId = await latestAuditId(
    "equipment_movement",
    equipmentTransferId,
  );
  const restoredEquipmentTransfer = await api(
    `/api/audit/rollback/${equipmentTransferDeleteAuditId}`,
    { method: "POST", body: {} },
  );
  assert.equal(restoredEquipmentTransfer.success, true);
  await waitForCompletedQueue(
    "recalculation_queue",
    "warehouse_id",
    warehouse.id,
    "kerosene",
  );
  assertStock(
    await getStock("warehouses", warehouse.id),
    sourceBeforeEquipmentTransfer.quantity - 15,
    sourceBeforeEquipmentTransfer.averageCost,
    "equipment transfer warehouse source after restore",
  );
  assertStock(
    await getStock("equipments", transferEquipment.id),
    15,
    10,
    "equipment transfer destination after restore",
  );
  await waitForAuditOperations(
    "equipment_movement",
    equipmentTransferId,
    ["CREATE", "UPDATE", "DELETE", "RESTORE"],
  );
  const restoredEquipmentTransactions = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM equipment_transactions
     WHERE source_type = 'movement' AND source_id = $1 AND deleted_at IS NULL`,
    [equipmentTransferId],
  );
  assert.equal(
    restoredEquipmentTransactions.rows[0].count,
    1,
    "restoring the equipment transfer restores its equipment ledger entry",
  );

  // A later, higher-cost receipt makes a backdated equipment return recalculate
  // its source cost and cascade that cost into the receiving warehouse.
  const equipmentTopUp = await api("/api/equipment-movement", {
    method: "POST",
    expectedStatus: 201,
    body: {
      movementDate: "2026-11-01T09:00:00.000Z",
      movementType: "storage_to_tzk",
      productType: "kerosene",
      nomenclatureId: keroseneNomenclature.id,
      fromWarehouseId: warehouse.id,
      toEquipmentId: transferEquipment.id,
      quantityKg: "5",
      totalCost: 100,
      costPerKg: 20,
      isDraft: false,
      notes: "critical flow equipment cost checkpoint",
    },
  });
  assert.ok(equipmentTopUp.id, "later equipment receipt is created");
  assertStock(
    await getStock("equipments", transferEquipment.id),
    20,
    12.5,
    "equipment after later higher-cost receipt",
  );

  const returnWarehouseBefore = await getStock(
    "warehouses",
    transferWarehouse.id,
  );
  const equipmentReturn = await api("/api/equipment-movement", {
    method: "POST",
    expectedStatus: 201,
    body: {
      movementDate: "2026-11-02T09:00:00.000Z",
      movementType: "tzk_to_storage",
      productType: "kerosene",
      nomenclatureId: keroseneNomenclature.id,
      fromEquipmentId: transferEquipment.id,
      toWarehouseId: transferWarehouse.id,
      quantityKg: "5",
      totalCost: 62.5,
      costPerKg: 12.5,
      isDraft: false,
      notes: "critical flow equipment to warehouse",
    },
  });
  const equipmentReturnId = equipmentReturn.id;
  assert.ok(equipmentReturnId, "equipment-to-warehouse transfer is created");
  assertStock(
    await getStock("equipments", transferEquipment.id),
    15,
    12.5,
    "equipment return source after create",
  );
  assertStock(
    await getStock("warehouses", transferWarehouse.id),
    returnWarehouseBefore.quantity + 5,
    (returnWarehouseBefore.quantity * returnWarehouseBefore.averageCost + 62.5) /
      (returnWarehouseBefore.quantity + 5),
    "equipment return warehouse destination after create",
  );

  await api(`/api/equipment-movement/${equipmentReturnId}`, {
    method: "PATCH",
    body: {
      movementDate: "2026-10-15T09:00:00.000Z",
      movementType: "tzk_to_storage",
      productType: "kerosene",
      nomenclatureId: keroseneNomenclature.id,
      fromEquipmentId: transferEquipment.id,
      toWarehouseId: transferWarehouse.id,
      quantityKg: "6",
      totalCost: 75,
      costPerKg: 12.5,
      isDraft: false,
      notes: "critical flow equipment return edited retroactively",
    },
  });
  await waitForCompletedQueue(
    "equipment_recalculation_queue",
    "equipment_id",
    transferEquipment.id,
    "kerosene",
  );
  await waitForCompletedQueue(
    "recalculation_queue",
    "warehouse_id",
    transferWarehouse.id,
    "kerosene",
  );
  assertStock(
    await getStock("equipments", transferEquipment.id),
    14,
    190 / 14,
    "equipment return source after backdated edit",
  );
  assertStock(
    await getStock("warehouses", transferWarehouse.id),
    returnWarehouseBefore.quantity + 6,
    (returnWarehouseBefore.quantity * returnWarehouseBefore.averageCost + 60) /
      (returnWarehouseBefore.quantity + 6),
    "equipment return warehouse destination after backdated edit",
  );
  const equipmentReturnRecord = await api(
    `/api/equipment-movement/${equipmentReturnId}`,
  );
  assert.ok(
    Math.abs(Number(equipmentReturnRecord.totalCost) - 60) < 0.011,
    "retroactive equipment recalculation updates the return's transferred cost",
  );
  assert.ok(
    Math.abs(Number(equipmentReturnRecord.costPerKg) - 10) < 0.011,
    "return cost uses the equipment average at the backdated date",
  );
  const equipmentReturnEquipmentRow = await pool.query(
    `SELECT transaction_type, quantity, sum, deleted_at
     FROM equipment_transactions WHERE id = $1`,
    [equipmentReturnRecord.sourceTransactionId],
  );
  assert.equal(equipmentReturnEquipmentRow.rows.length, 1);
  assert.equal(equipmentReturnEquipmentRow.rows[0].transaction_type, "transfer_out");
  assert.equal(Number(equipmentReturnEquipmentRow.rows[0].quantity), -6);
  assert.ok(
    Math.abs(Number(equipmentReturnEquipmentRow.rows[0].sum) - 60) < 0.011,
    "equipment source ledger reflects the recalculated transferred cost",
  );
  assert.equal(equipmentReturnEquipmentRow.rows[0].deleted_at, null);
  const equipmentReturnWarehouseRow = await pool.query(
    `SELECT transaction_type, quantity, sum, deleted_at
     FROM warehouse_transactions WHERE id = $1`,
    [equipmentReturnRecord.warehouseTransactionId],
  );
  assert.equal(equipmentReturnWarehouseRow.rows.length, 1);
  assert.equal(equipmentReturnWarehouseRow.rows[0].transaction_type, "transfer_in");
  assert.equal(Number(equipmentReturnWarehouseRow.rows[0].quantity), 6);
  assert.ok(
    Math.abs(Number(equipmentReturnWarehouseRow.rows[0].sum) - 60) < 0.011,
    "warehouse destination ledger receives the recalculated transfer cost",
  );
  assert.equal(equipmentReturnWarehouseRow.rows[0].deleted_at, null);

  await waitForAuditOperations("equipment_movement", equipmentReturnId, ["CREATE", "UPDATE"]);
  await api(`/api/equipment-movement/${equipmentReturnId}`, { method: "DELETE" });
  await waitForCompletedQueue(
    "equipment_recalculation_queue",
    "equipment_id",
    transferEquipment.id,
    "kerosene",
  );
  assertStock(
    await getStock("equipments", transferEquipment.id),
    20,
    12.5,
    "equipment return source after delete",
  );
  assertStock(
    await getStock("warehouses", transferWarehouse.id),
    returnWarehouseBefore.quantity,
    returnWarehouseBefore.averageCost,
    "equipment return warehouse destination after delete",
  );
  const deletedReturnRows = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM equipment_transactions
        WHERE source_type = 'movement' AND source_id = $1 AND deleted_at IS NOT NULL) AS equipment_count,
       (SELECT COUNT(*)::int FROM warehouse_transactions
        WHERE source_type = 'movement' AND source_id = $1 AND deleted_at IS NOT NULL) AS warehouse_count`,
    [equipmentReturnId],
  );
  assert.equal(deletedReturnRows.rows[0].equipment_count, 1);
  assert.equal(deletedReturnRows.rows[0].warehouse_count, 1);

  const equipmentReturnDeleteAuditId = await latestAuditId(
    "equipment_movement",
    equipmentReturnId,
  );
  const restoredEquipmentReturn = await api(
    `/api/audit/rollback/${equipmentReturnDeleteAuditId}`,
    { method: "POST", body: {} },
  );
  assert.equal(restoredEquipmentReturn.success, true);
  await waitForCompletedQueue(
    "equipment_recalculation_queue",
    "equipment_id",
    transferEquipment.id,
    "kerosene",
  );
  assertStock(
    await getStock("equipments", transferEquipment.id),
    14,
    190 / 14,
    "equipment return source after audit restore",
  );
  assertStock(
    await getStock("warehouses", transferWarehouse.id),
    returnWarehouseBefore.quantity + 6,
    (returnWarehouseBefore.quantity * returnWarehouseBefore.averageCost + 60) /
      (returnWarehouseBefore.quantity + 6),
    "equipment return warehouse destination after audit restore",
  );
  await waitForAuditOperations(
    "equipment_movement",
    equipmentReturnId,
    ["CREATE", "UPDATE", "DELETE", "RESTORE"],
  );
  const restoredReturnRows = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM equipment_transactions
        WHERE source_type = 'movement' AND source_id = $1 AND deleted_at IS NULL) AS equipment_count,
       (SELECT COUNT(*)::int FROM warehouse_transactions
        WHERE source_type = 'movement' AND source_id = $1 AND deleted_at IS NULL) AS warehouse_count`,
    [equipmentReturnId],
  );
  assert.equal(restoredReturnRows.rows[0].equipment_count, 1);
  assert.equal(restoredReturnRows.rows[0].warehouse_count, 1);

  // Cashflow transactions are the monetary ledger: CRUD and audit rollback
  // must preserve date-based totals and linked movement references.
  const cashflowWindow = "/api/cashflow/summary?startDate=2026-10-01&endDate=2026-10-31";
  const baselineCashflow = await api(cashflowWindow);
  const summaryAmount = (summary, category) =>
    Number(summary.find((row) => row.category === category)?.total || 0);
  const baselineIncome = summaryAmount(baselineCashflow, "income");
  const baselineExpense = summaryAmount(baselineCashflow, "expense");
  const cashflowCreated = await api("/api/cashflow", {
    method: "POST",
    expectedStatus: 201,
    body: {
      transactionDate: "2026-10-26T10:00:00.000Z",
      category: "income",
      subcategory: "critical_flow",
      amount: 1000,
      currency: "RUB",
      description: "critical-flow movement settlement",
      counterparty: "critical-flow-counterparty",
      paymentMethod: "bank_transfer",
      referenceType: "movement",
      referenceId: transferId,
      isPlanned: false,
    },
  });
  const cashflowId = cashflowCreated.id;
  assert.ok(cashflowId, "cashflow transaction is created");
  assert.equal(summaryAmount(await api(cashflowWindow), "income"), baselineIncome + 1000);
  const cashflowReference = await pool.query(
    `SELECT reference_type, reference_id FROM cashflow_transactions WHERE id = $1`,
    [cashflowId],
  );
  assert.equal(cashflowReference.rows[0]?.reference_type, "movement");
  assert.equal(cashflowReference.rows[0]?.reference_id, transferId);

  const cashflowUpdated = await api(`/api/cashflow/${cashflowId}`, {
    method: "PATCH",
    body: {
      transactionDate: "2026-10-10T10:00:00.000Z",
      category: "expense",
      amount: 275,
      description: "critical-flow movement settlement corrected retroactively",
    },
  });
  assert.equal(Number(cashflowUpdated.amount), 275);
  assert.equal(
    new Date(cashflowUpdated.transactionDate).toISOString().slice(0, 10),
    "2026-10-10",
  );
  const updatedCashflowSummary = await api(cashflowWindow);
  assert.equal(summaryAmount(updatedCashflowSummary, "income"), baselineIncome);
  assert.equal(summaryAmount(updatedCashflowSummary, "expense"), baselineExpense + 275);
  await waitForAuditOperations(
    "cashflow_transactions",
    cashflowId,
    ["CREATE", "UPDATE"],
  );

  await api(`/api/cashflow/${cashflowId}`, { method: "DELETE" });
  const deletedCashflow = await pool.query(
    `SELECT deleted_at FROM cashflow_transactions WHERE id = $1`,
    [cashflowId],
  );
  assert.ok(deletedCashflow.rows[0]?.deleted_at, "cashflow transaction is soft-deleted");
  const deletedCashflowSummary = await api(cashflowWindow);
  assert.equal(summaryAmount(deletedCashflowSummary, "income"), baselineIncome);
  assert.equal(summaryAmount(deletedCashflowSummary, "expense"), baselineExpense);
  const cashflowDeleteAuditId = await latestAuditId(
    "cashflow_transactions",
    cashflowId,
  );
  const restoredCashflow = await api(
    `/api/audit/rollback/${cashflowDeleteAuditId}`,
    { method: "POST", body: {} },
  );
  assert.equal(restoredCashflow.success, true);
  const restoredCashflowRow = await pool.query(
    `SELECT deleted_at, amount, category, transaction_date
     FROM cashflow_transactions WHERE id = $1`,
    [cashflowId],
  );
  assert.equal(restoredCashflowRow.rows[0]?.deleted_at, null);
  assert.equal(Number(restoredCashflowRow.rows[0]?.amount), 275);
  assert.equal(restoredCashflowRow.rows[0]?.category, "expense");
  assert.equal(
    new Date(restoredCashflowRow.rows[0]?.transaction_date).toISOString().slice(0, 10),
    "2026-10-10",
  );
  const restoredCashflowSummary = await api(cashflowWindow);
  assert.equal(summaryAmount(restoredCashflowSummary, "income"), baselineIncome);
  assert.equal(summaryAmount(restoredCashflowSummary, "expense"), baselineExpense + 275);
  await waitForAuditOperations(
    "cashflow_transactions",
    cashflowId,
    ["CREATE", "UPDATE", "DELETE", "RESTORE"],
  );

  // Exchange advance card movements must change the balance and restore it
  // correctly when a transaction is removed.
  const advanceCardCreated = await api("/api/exchange-advances", {
    method: "POST",
    expectedStatus: 201,
    body: { sellerId: supplier.id, notes: "critical-flow advance card" },
  });
  assert.ok(advanceCardCreated.id, "exchange advance card is created");
  const advanceTxn = await api(
    `/api/exchange-advances/${advanceCardCreated.id}/transactions`,
    {
      method: "POST",
      expectedStatus: 201,
      body: {
        transactionType: "income",
        amount: 450,
        transactionDate: "2026-10-09T12:00:00.000Z",
        description: "critical-flow advance funding",
      },
    },
  );
  assert.equal(Number(advanceTxn.balanceBefore), 0);
  assert.equal(Number(advanceTxn.balanceAfter), 450);
  const advanceCardAfterCredit = await api(
    `/api/exchange-advances/${advanceCardCreated.id}`,
  );
  assert.equal(Number(advanceCardAfterCredit.currentBalance), 450);
  const advanceTransactions = await api(
    `/api/exchange-advances/${advanceCardCreated.id}/transactions`,
  );
  assert.equal(advanceTransactions.total, 1);
  assert.equal(advanceTransactions.data[0]?.id, advanceTxn.id);
  await api(`/api/exchange-advances/transactions/${advanceTxn.id}`, {
    method: "DELETE",
  });
  const advanceCardAfterDelete = await api(
    `/api/exchange-advances/${advanceCardCreated.id}`,
  );
  assert.equal(
    Number(advanceCardAfterDelete.currentBalance),
    0,
    "deleting the advance transaction restores its prior card balance",
  );
  const deletedAdvanceTxn = await pool.query(
    `SELECT deleted_at FROM exchange_advance_transactions WHERE id = $1`,
    [advanceTxn.id],
  );
  assert.ok(deletedAdvanceTxn.rows[0]?.deleted_at);
  await waitForAuditOperations(
    "exchange_advance_cards",
    advanceCardCreated.id,
    ["CREATE"],
  );
});
