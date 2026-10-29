import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import pg from "pg";

const { Pool } = pg;
const baseUrl = process.env.E2E_BASE_URL;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let sessionCookie = "";

after(async () => {
  await pool.end();
});

async function api(path, { method = "GET", body, status = 200 } = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      Cookie: sessionCookie,
      ...(body ? { "Content-Type": "application/json" } : {}),
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

async function login() {
  const response = await fetch(new URL("/api/auth/login", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.E2E_ADMIN_EMAIL,
      password: process.env.E2E_ADMIN_PASSWORD,
    }),
  });
  assert.equal(response.status, 200);
  sessionCookie = response.headers.get("set-cookie")?.split(";", 1)[0] || "";
  assert.ok(sessionCookie);
}

test("monthly plans and logistics routes stay isolated by scenario and tonnes", async () => {
  assert.ok(baseUrl, "E2E_BASE_URL is required");
  await login();

  let warehouseId;
  const scenarioIds = [];
  const planEntryIds = [];
  const routeIds = [];
  const syncIds = [];

  try {
    warehouseId = (
      await pool.query(
        `INSERT INTO warehouses
           (name, current_balance_tonnes, average_cost_per_tonne,
            pvkj_balance_tonnes, pvkj_average_cost_per_tonne)
         VALUES ($1, 0, 0, 0, 0)
         RETURNING id`,
        [`planning-logistics-${randomUUID()}`],
      )
    ).rows[0].id;

    const scenarioA = await api("/api/planning/scenarios", {
      method: "POST",
      status: 201,
      body: { name: `Regression A ${randomUUID()}` },
    });
    const scenarioB = await api("/api/planning/scenarios", {
      method: "POST",
      status: 201,
      body: { name: `Regression B ${randomUUID()}` },
    });
    scenarioIds.push(scenarioA.id, scenarioB.id);

    async function createEntry(scenarioId, volumeTonnes, date) {
      const entry = await api("/api/planning/entries", {
        method: "POST",
        status: 201,
        body: {
          warehouseId,
          date,
          type: "income",
          volumeTonnes,
          scenarioId,
        },
      });
      planEntryIds.push(entry.id);
      return entry;
    }

    const entryA1 = await createEntry(
      scenarioA.id,
      0.12345,
      "2026-10-05T12:00:00.000Z",
    );
    const entryA2 = await createEntry(
      scenarioA.id,
      0.02345,
      "2026-10-08T12:00:00.000Z",
    );
    const entryB = await createEntry(
      scenarioB.id,
      0.54321,
      "2026-10-05T12:00:00.000Z",
    );

    const entryQuery = (scenarioId) => {
      const params = new URLSearchParams({
        warehouseId,
        dateFrom: "2026-10-01",
        dateTo: "2026-10-31",
      });
      if (scenarioId) params.set("scenarioId", scenarioId);
      return `/api/planning/entries?${params}`;
    };
    const entriesA = await api(entryQuery(scenarioA.id));
    const entriesB = await api(entryQuery(scenarioB.id));
    assert.deepEqual(
      entriesA.map((entry) => entry.id).sort(),
      [entryA1.id, entryA2.id].sort(),
    );
    assert.deepEqual(entriesB.map((entry) => entry.id), [entryB.id]);
    assert.equal(Number(entriesA.find((entry) => entry.id === entryA1.id).volumeTonnes), 0.12345);
    assert.equal(Number(entriesB[0].volumeTonnes), 0.54321);

    async function createRoute(scenarioId, entry, day) {
      const route = await api("/api/logistics-plan/routes", {
        method: "POST",
        status: 201,
        body: {
          type: "route",
          status: "manual",
          scenarioId,
          planEntryId: entry.id,
          fromEntityType: "base",
          fromEntityName: "Regression origin",
          toEntityType: "warehouse",
          toEntityId: warehouseId,
          toEntityName: "Regression warehouse",
          dateStart: `2026-10-${day}T08:00:00.000Z`,
          dateEnd: `2026-10-${day}T12:00:00.000Z`,
          periodFrom: "2026-10-01T00:00:00.000Z",
          periodTo: "2026-10-31T23:59:59.999Z",
        },
      });
      routeIds.push(route.id);
      return route;
    }

    const routeA = await createRoute(scenarioA.id, entryA1, "05");
    const routeB = await createRoute(scenarioB.id, entryB, "05");
    const routeQuery = (scenarioId) => {
      const params = new URLSearchParams({
        periodFrom: "2026-10-01T00:00:00.000Z",
        periodTo: "2026-10-31T23:59:59.999Z",
      });
      if (scenarioId) params.set("scenarioId", scenarioId);
      return `/api/logistics-plan/routes?${params}`;
    };
    assert.deepEqual(await api(routeQuery(scenarioA.id)).then((rows) => rows.map((row) => row.id)), [routeA.id]);
    assert.deepEqual(await api(routeQuery(scenarioB.id)).then((rows) => rows.map((row) => row.id)), [routeB.id]);
    assert.deepEqual(
      await api(routeQuery(null)).then((rows) => rows.map((row) => row.id)),
      [],
      "unselected scenario routes are not mixed into the default plan",
    );

    const unassignedA = await api(
      `/api/logistics-plan/routes/unassigned?periodFrom=2026-10-01&periodTo=2026-10-31&scenarioId=${scenarioA.id}`,
    );
    assert.deepEqual(
      unassignedA.map((row) => row.id),
      [entryA2.id],
      "only this scenario's unassigned plan entry is shown",
    );

    for (const [scenarioId, expectedEntryIds] of [
      [scenarioA.id, [entryA1.id, entryA2.id]],
      [scenarioB.id, [entryB.id]],
    ]) {
      const sync = await api("/api/logistics-plan/sync", {
        method: "POST",
        status: 201,
        body: {
          scenarioId,
          periodFrom: "2026-10-01T00:00:00.000Z",
          periodTo: "2026-10-31T23:59:59.999Z",
        },
      });
      syncIds.push(sync.id);
      assert.equal(sync.scenarioId, scenarioId);
      assert.deepEqual(
        sync.snapshotData.map((entry) => entry.id).sort(),
        expectedEntryIds.sort(),
      );
      assert.ok(
        sync.snapshotData.every((entry) => entry.scenarioId === scenarioId),
        "monthly logistics snapshot contains only its selected scenario",
      );
    }
  } finally {
    if (routeIds.length) {
      await pool.query(
        "DELETE FROM logistics_plan_comments WHERE route_id = ANY($1::uuid[])",
        [routeIds],
      );
      await pool.query(
        "DELETE FROM logistics_plan_routes WHERE id = ANY($1::uuid[])",
        [routeIds],
      );
    }
    if (syncIds.length) {
      await pool.query(
        "DELETE FROM logistics_plan_notifications WHERE sync_id = ANY($1::uuid[])",
        [syncIds],
      );
      await pool.query(
        "DELETE FROM logistics_monthly_syncs WHERE id = ANY($1::uuid[])",
        [syncIds],
      );
    }
    if (planEntryIds.length) {
      await pool.query(
        "DELETE FROM audit_log WHERE entity_id = ANY($1::uuid[])",
        [planEntryIds],
      );
      await pool.query("DELETE FROM plan_entries WHERE id = ANY($1::uuid[])", [
        planEntryIds,
      ]);
    }
    if (scenarioIds.length) {
      await pool.query(
        "DELETE FROM audit_log WHERE entity_id = ANY($1::uuid[])",
        [scenarioIds],
      );
      await pool.query(
        "DELETE FROM planning_scenarios WHERE id = ANY($1::uuid[])",
        [scenarioIds],
      );
    }
    if (warehouseId) {
      await pool.query("DELETE FROM warehouses WHERE id = $1", [warehouseId]);
    }
  }
});
