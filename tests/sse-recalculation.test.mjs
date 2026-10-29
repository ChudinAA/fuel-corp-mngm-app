import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import pg from "pg";

const { Pool } = pg;
const baseUrl = process.env.E2E_BASE_URL;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const connections = new Set();
let sessionCookie = "";

after(async () => {
  await Promise.all([...connections].map((connection) => connection.close()));
  await pool.end();
});

function createSseConnection(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const bufferedEvents = [];
  const waiters = [];
  let buffer = "";
  let closed = false;

  function dispatch(event) {
    const waiterIndex = waiters.findIndex(
      (waiter) => waiter.name === event.name && waiter.predicate(event.data),
    );
    if (waiterIndex === -1) {
      bufferedEvents.push(event);
      return;
    }

    const [waiter] = waiters.splice(waiterIndex, 1);
    clearTimeout(waiter.timer);
    waiter.resolve(event);
  }

  function parseBlock(block) {
    let name = "message";
    const dataLines = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) name = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return;
    dispatch({ name, data: JSON.parse(dataLines.join("\n")) });
  }

  async function pump() {
    try {
      while (!closed) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        while (true) {
          const boundary = buffer.match(/\r?\n\r?\n/);
          if (!boundary || boundary.index === undefined) break;
          parseBlock(buffer.slice(0, boundary.index));
          buffer = buffer.slice(boundary.index + boundary[0].length);
        }
      }
    } catch (error) {
      if (!closed) {
        for (const waiter of waiters.splice(0)) {
          clearTimeout(waiter.timer);
          waiter.reject(error);
        }
      }
    }
  }

  void pump();

  return {
    waitFor(name, predicate = () => true, timeoutMs = 20_000) {
      const bufferedIndex = bufferedEvents.findIndex(
        (event) => event.name === name && predicate(event.data),
      );
      if (bufferedIndex !== -1) {
        return Promise.resolve(bufferedEvents.splice(bufferedIndex, 1)[0]);
      }

      return new Promise((resolve, reject) => {
        const waiter = {
          name,
          predicate,
          resolve,
          reject,
          timer: setTimeout(() => {
            const index = waiters.indexOf(waiter);
            if (index !== -1) waiters.splice(index, 1);
            reject(new Error(`Timed out waiting for SSE event "${name}".`));
          }, timeoutMs),
        };
        waiters.push(waiter);
      });
    },
    hasEvent(name, predicate = () => true) {
      return bufferedEvents.some(
        (event) => event.name === name && predicate(event.data),
      );
    },
    async close() {
      if (closed) return;
      closed = true;
      for (const waiter of waiters.splice(0)) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error("SSE connection closed."));
      }
      await reader.cancel().catch(() => undefined);
    },
  };
}

async function api(path, { method = "GET", body, headers = {}, status = 200 } = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  assert.equal(
    response.status,
    status,
    `${method} ${path}: expected ${status}, received ${response.status}: ${text}`,
  );
  return data;
}

async function openSse(clientId, cookie) {
  const controller = new AbortController();
  const response = await fetch(
    new URL(
      `/api/warehouses/sse/events?clientId=${encodeURIComponent(clientId)}`,
      baseUrl,
    ),
    {
      headers: { Cookie: cookie },
      signal: controller.signal,
    },
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/event-stream/);

  const connection = createSseConnection(response);
  const originalClose = connection.close.bind(connection);
  connection.close = async () => {
    controller.abort();
    await originalClose();
    connections.delete(connection);
  };
  connections.add(connection);
  await connection.waitFor("message", (data) => data.type === "connected");
  return connection;
}

function makeRefueling({
  supplierId,
  buyerId,
  warehouseId,
  equipmentId,
  date,
  quantityTonnes,
}) {
  return {
    refuelingDate: date,
    productType: "kerosene",
    supplierId,
    buyerId,
    warehouseId: warehouseId ?? null,
    equipmentId: equipmentId ?? null,
    equipmentType: "common",
    inputMode: "tonnes",
    quantityTonnes,
    purchasePricePerTonne: 15_000,
    purchaseAmount: quantityTonnes * 15_000,
    salePricePerTonne: 16_000,
    saleAmount: quantityTonnes * 16_000,
    profit: quantityTonnes * 1_000,
    isDraft: false,
  };
}

test("SSE notifies observers after warehouse and equipment recalculations finish", async () => {
  assert.ok(baseUrl, "E2E_BASE_URL is required");
  assert.ok(process.env.E2E_ADMIN_EMAIL, "E2E_ADMIN_EMAIL is required");
  assert.ok(process.env.E2E_ADMIN_PASSWORD, "E2E_ADMIN_PASSWORD is required");

  const loginResponse = await fetch(new URL("/api/auth/login", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.E2E_ADMIN_EMAIL,
      password: process.env.E2E_ADMIN_PASSWORD,
    }),
  });
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie, "login establishes an HTTP session");
  sessionCookie = cookie;

  let supplierId;
  let buyerId;
  let warehouseId;
  let equipmentId;
  const refuelingIds = [];
  let warehouseSse;
  let equipmentSse;
  let observerSse;

  try {
    supplierId = (
      await pool.query(
        "INSERT INTO suppliers (name) VALUES ($1) RETURNING id",
        [`sse-recalc-supplier-${randomUUID()}`],
      )
    ).rows[0].id;
    buyerId = (
      await pool.query(
        "INSERT INTO customers (name, module) VALUES ($1, 'refueling') RETURNING id",
        [`sse-recalc-buyer-${randomUUID()}`],
      )
    ).rows[0].id;
    warehouseId = (
      await pool.query(
        `INSERT INTO warehouses
           (name, current_balance_tonnes, average_cost_per_tonne,
            pvkj_balance_tonnes, pvkj_average_cost_per_tonne)
         VALUES ($1, 2, 15000, 0, 0)
         RETURNING id`,
        [`sse-recalc-warehouse-${randomUUID()}`],
      )
    ).rows[0].id;
    equipmentId = (
      await pool.query(
        `INSERT INTO equipments
           (name, current_balance_tonnes, average_cost_per_tonne,
            pvkj_balance_tonnes, pvkj_average_cost_per_tonne)
         VALUES ($1, 2, 15000, 0, 0)
         RETURNING id`,
        [`sse-recalc-equipment-${randomUUID()}`],
      )
    ).rows[0].id;

    await pool.query(
      `INSERT INTO warehouse_transactions
         (warehouse_id, transaction_type, product_type, quantity_tonnes,
          source_type, balance_before_tonnes, balance_after_tonnes,
          average_cost_before_per_tonne, average_cost_after_per_tonne,
          sum, price_per_tonne, transaction_date)
       VALUES ($1, 'inventory', 'kerosene', 2, 'sse_test_seed',
               0, 2, 0, 15000, 30000, 15000, '2026-10-01T00:00:00.000Z')`,
      [warehouseId],
    );
    await pool.query(
      `INSERT INTO equipment_transactions
         (equipment_id, transaction_type, product_type, quantity_tonnes,
          source_type, balance_before_tonnes, balance_after_tonnes,
          average_cost_before_per_tonne, average_cost_after_per_tonne,
          sum, price_per_tonne, transaction_date)
       VALUES ($1, 'inventory', 'kerosene', 2, 'sse_test_seed',
               0, 2, 0, 15000, 30000, 15000, '2026-10-01T00:00:00.000Z')`,
      [equipmentId],
    );

    const laterWarehouseDeal = await api("/api/refueling", {
      method: "POST",
      status: 201,
      body: makeRefueling({
        supplierId,
        buyerId,
        warehouseId,
        date: "2026-10-20T12:00:00.000Z",
        quantityTonnes: 0.1,
      }),
    });
    const laterEquipmentDeal = await api("/api/refueling", {
      method: "POST",
      status: 201,
      body: makeRefueling({
        supplierId,
        buyerId,
        equipmentId,
        date: "2026-10-20T12:00:00.000Z",
        quantityTonnes: 0.1,
      }),
    });
    refuelingIds.push(laterWarehouseDeal.id, laterEquipmentDeal.id);

    warehouseSse = await openSse("sse-initiator", cookie);
    equipmentSse = await openSse("sse-observer", cookie);
    observerSse = equipmentSse;

    const backdatedWarehouseDeal = await api("/api/refueling", {
      method: "POST",
      status: 201,
      headers: { "x-client-id": "sse-initiator" },
      body: makeRefueling({
        supplierId,
        buyerId,
        warehouseId,
        date: "2026-10-15T12:00:00.000Z",
        quantityTonnes: 0.2,
      }),
    });
    const backdatedEquipmentDeal = await api("/api/refueling", {
      method: "POST",
      status: 201,
      headers: { "x-client-id": "sse-initiator" },
      body: makeRefueling({
        supplierId,
        buyerId,
        equipmentId,
        date: "2026-10-15T12:00:00.000Z",
        quantityTonnes: 0.2,
      }),
    });
    refuelingIds.push(backdatedWarehouseDeal.id, backdatedEquipmentDeal.id);

    const entityEvent = await observerSse.waitFor(
      "entity_changed",
      (data) => data.entity === "refueling",
    );
    assert.deepEqual(entityEvent.data, { entity: "refueling" });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(
      warehouseSse.hasEvent("entity_changed", (data) => data.entity === "refueling"),
      false,
      "the initiating client is excluded from its own immediate entity event",
    );

    const warehouseEvent = await observerSse.waitFor(
      "warehouse_recalculated",
      (data) => data.warehouseId === warehouseId && data.productType === "kerosene",
    );
    assert.deepEqual(warehouseEvent.data, {
      warehouseId,
      productType: "kerosene",
    });

    const equipmentEvent = await observerSse.waitFor(
      "equipment_recalculated",
      (data) => data.equipmentId === equipmentId && data.productType === "kerosene",
    );
    assert.deepEqual(equipmentEvent.data, {
      equipmentId,
      productType: "kerosene",
    });

    const [warehouseTask, equipmentTask, warehouse, equipment] = await Promise.all([
      pool.query(
        `SELECT status FROM recalculation_queue
         WHERE warehouse_id = $1 AND product_type = 'kerosene'
         ORDER BY created_at DESC LIMIT 1`,
        [warehouseId],
      ),
      pool.query(
        `SELECT status FROM equipment_recalculation_queue
         WHERE equipment_id = $1 AND product_type = 'kerosene'
         ORDER BY created_at DESC LIMIT 1`,
        [equipmentId],
      ),
      pool.query(
        "SELECT current_balance_tonnes FROM warehouses WHERE id = $1",
        [warehouseId],
      ),
      pool.query(
        "SELECT current_balance_tonnes FROM equipments WHERE id = $1",
        [equipmentId],
      ),
    ]);
    assert.equal(warehouseTask.rows[0]?.status, "completed");
    assert.equal(equipmentTask.rows[0]?.status, "completed");
    assert.equal(Number(warehouse.rows[0]?.current_balance_tonnes), 1.7);
    assert.equal(Number(equipment.rows[0]?.current_balance_tonnes), 1.7);
  } finally {
    await Promise.all(
      [...connections].map((connection) => connection.close()),
    );
    if (refuelingIds.length) {
      await pool.query(
        "DELETE FROM audit_log WHERE entity_id = ANY($1::uuid[])",
        [refuelingIds],
      );
      await pool.query(
        "DELETE FROM aircraft_refueling WHERE id = ANY($1::uuid[])",
        [refuelingIds],
      );
    }
    if (warehouseId) {
      await pool.query("DELETE FROM recalculation_queue WHERE warehouse_id = $1", [
        warehouseId,
      ]);
      await pool.query(
        "DELETE FROM warehouse_transactions WHERE warehouse_id = $1",
        [warehouseId],
      );
      await pool.query("DELETE FROM warehouses WHERE id = $1", [warehouseId]);
    }
    if (equipmentId) {
      await pool.query(
        "DELETE FROM equipment_recalculation_queue WHERE equipment_id = $1",
        [equipmentId],
      );
      await pool.query(
        "DELETE FROM equipment_transactions WHERE equipment_id = $1",
        [equipmentId],
      );
      await pool.query("DELETE FROM equipments WHERE id = $1", [equipmentId]);
    }
    if (buyerId) await pool.query("DELETE FROM customers WHERE id = $1", [buyerId]);
    if (supplierId) await pool.query("DELETE FROM suppliers WHERE id = $1", [supplierId]);
  }
});
