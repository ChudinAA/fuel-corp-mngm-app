import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { after, test } from "node:test";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const baseUrl = process.env.E2E_BASE_URL;
const apiRoot = "/api/integrations/1c/v1";
const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
const ids = {
  supplier: randomUUID(),
  customer: randomUUID(),
  carrier: randomUUID(),
  matchedSupplier: randomUUID(),
  unknownDeletion: randomUUID(),
  ambiguous: randomUUID(),
};
const inns = {
  supplier: `1C-TEST-${suffix}-S`,
  customer: `1C-TEST-${suffix}-C`,
  carrier: `1C-TEST-${suffix}-T`,
  matched: `1C-TEST-${suffix}-M`,
  ambiguous: `1C-TEST-${suffix}-A`,
};
const trackedRequestIds = new Set();
const apiKeyIds = new Set();
const paginationLogIds = [];
let adminCookie;
let testEditorRoleId;
const testEditorEmail = `1c-editor-${suffix}@example.test`;

async function fetchJson(path, { method = "GET", body, token, cookie = adminCookie } = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      "User-Agent": "1C-integration-test",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const requestId = response.headers.get("x-request-id");
  if (requestId) trackedRequestIds.add(requestId);
  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }
  return { response, data, requestId, setCookie: response.headers.get("set-cookie") };
}

async function loginAdmin() {
  const credentials = {
    email: process.env.E2E_ADMIN_EMAIL,
    password: process.env.E2E_ADMIN_PASSWORD,
  };
  assert.ok(credentials.email && credentials.password, "isolated admin credentials are available");

  let response = await fetch(new URL("/api/auth/login", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  let expectedStatus = 200;
  if (response.status === 401) {
    expectedStatus = 201;
    response = await fetch(new URL("/api/auth/register", baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...credentials,
        confirmPassword: credentials.password,
        firstName: "1C",
        lastName: "Integration Test",
      }),
    });
  }
  assert.equal(response.status, expectedStatus, `test administrator login/registration: ${response.status}`);
  adminCookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(adminCookie, "administrator session cookie is set");
}

async function waitForRequestLog(requestId) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const result = await pool.query(
      "SELECT * FROM integration_request_logs WHERE request_id = $1",
      [requestId],
    );
    if (result.rows[0]) return result.rows[0];
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  assert.fail(`Timed out waiting for integration request log ${requestId}`);
}

after(async () => {
  try {
    if (trackedRequestIds.size) {
      const requestIds = [...trackedRequestIds];
      await pool.query("DELETE FROM integration_change_logs WHERE request_id = ANY($1::uuid[])", [requestIds]);
      await pool.query("DELETE FROM integration_request_logs WHERE request_id = ANY($1::uuid[])", [requestIds]);
    }
    if (paginationLogIds.length) {
      await pool.query("DELETE FROM integration_request_logs WHERE id = ANY($1::int[])", [paginationLogIds]);
    }
    await pool.query("DELETE FROM integration_change_logs WHERE id_1c = ANY($1::text[])", [[
      ids.supplier, ids.customer, ids.carrier, ids.matchedSupplier, ids.unknownDeletion, ids.ambiguous,
    ]]);
    await pool.query("DELETE FROM suppliers WHERE id_1c = ANY($1::text[]) OR inn = ANY($2::text[])", [
      [ids.supplier, ids.matchedSupplier, ids.ambiguous],
      [inns.supplier, inns.matched, inns.ambiguous],
    ]);
    await pool.query("DELETE FROM customers WHERE id_1c = $1", [ids.customer]);
    await pool.query("DELETE FROM logistics_carriers WHERE id_1c = $1", [ids.carrier]);
    if (apiKeyIds.size) {
      const keys = [...apiKeyIds];
      await pool.query("DELETE FROM integration_request_logs WHERE api_key_id = ANY($1::uuid[])", [keys]);
      await pool.query("DELETE FROM integration_api_keys WHERE id = ANY($1::uuid[])", [keys]);
    }
    await pool.query(
      "DELETE FROM audit_log WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
      [testEditorEmail],
    );
    await pool.query("DELETE FROM users WHERE email = $1", [testEditorEmail]);
    if (testEditorRoleId) await pool.query("DELETE FROM roles WHERE id = $1", [testEditorRoleId]);
    await pool.query("DELETE FROM integration_settings WHERE id = 1");
  } finally {
    await pool.end();
  }
});

test("1C API authenticates, syncs counterparties, audits changes and paginates request logs", async () => {
  assert.ok(baseUrl, "E2E_BASE_URL is required");
  await loginAdmin();

  const initialStatus = await fetchJson("/api/admin/integrations/1c/status");
  assert.equal(initialStatus.response.status, 200);
  assert.equal(initialStatus.data.activeKey, null);

  const created = await fetchJson("/api/admin/integrations/1c/api-key", { method: "POST", body: {} });
  assert.equal(created.response.status, 201);
  const firstKey = created.data.apiKey;
  assert.match(firstKey, /^1c_live_/);
  apiKeyIds.add(created.data.activeKey.id);
  assert.equal(created.data.activeKey.keyPrefix.length > 0, true);
  assert.equal(Object.hasOwn(created.data.activeKey, "keyHash"), false);

  const activeStatus = await fetchJson("/api/admin/integrations/1c/status");
  assert.equal(Object.hasOwn(activeStatus.data, "apiKey"), false);
  await pool.query(
    `INSERT INTO integration_settings (id, counterparty_master_data_enabled, updated_at)
     VALUES (1, false, now())
     ON CONFLICT (id) DO UPDATE SET counterparty_master_data_enabled = false`,
  );
  const masterDataMode = await fetchJson("/api/integrations/1c/mode");
  assert.equal(masterDataMode.data.counterpartyMasterDataEnabled, true);

  const missingAuth = await fetchJson(`${apiRoot}/health`, { cookie: null });
  assert.equal(missingAuth.response.status, 401);
  const invalidAuth = await fetchJson(`${apiRoot}/health`, { token: "not-a-valid-key", cookie: null });
  assert.equal(invalidAuth.response.status, 401);
  const health = await fetchJson(`${apiRoot}/health`, { token: firstKey, cookie: null });
  assert.equal(health.response.status, 200);
  assert.equal(health.data.status, "ok");

  const invalidPayload = await fetchJson(`${apiRoot}/counterparties/sync`, {
    method: "POST",
    token: firstKey,
    cookie: null,
    body: { items: [{
      type: "supplier",
      id_1c: ids.supplier,
      inn: inns.supplier,
      name: "Запрещённое поле",
      isActive: false,
    }] },
  });
  assert.equal(invalidPayload.response.status, 400);

  const matchSeed = await pool.query(
    `INSERT INTO suppliers (name, full_name, inn, is_active, integration_pending_review)
     VALUES ($1, $2, $3, true, false) RETURNING id`,
    ["Старое название из справочника", "Старое полное название", inns.matched],
  );
  const matchedSupplierId = matchSeed.rows[0].id;

  const batch = [
    { type: "supplier", id_1c: ids.supplier, inn: inns.supplier, name: "1С: новый поставщик", full_name: "Полное название поставщика", status: "active" },
    { type: "customer", id_1c: ids.customer, inn: inns.customer, name: "1С: новый покупатель", full_name: "Полное название покупателя", status: "enabled" },
    { type: "carrier", id_1c: ids.carrier, inn: inns.carrier, name: "1С: новый перевозчик", full_name: "Полное название перевозчика", status: "активен" },
    { type: "supplier", id_1c: ids.matchedSupplier, inn: inns.matched, name: "1С: сопоставленный поставщик", full_name: "Обновлённое полное название", status: "active" },
  ];
  const imported = await fetchJson(`${apiRoot}/counterparties/sync`, {
    method: "POST",
    token: firstKey,
    cookie: null,
    body: { items: batch },
  });
  assert.equal(imported.response.status, 200, JSON.stringify(imported.data));
  assert.deepEqual(imported.data.counts, { created: 3, updated: 1 });
  assert.equal(imported.data.request_id, imported.requestId);

  const [supplier, customer, carrier, matched] = await Promise.all([
    pool.query("SELECT * FROM suppliers WHERE id_1c = $1", [ids.supplier]),
    pool.query("SELECT * FROM customers WHERE id_1c = $1", [ids.customer]),
    pool.query("SELECT * FROM logistics_carriers WHERE id_1c = $1", [ids.carrier]),
    pool.query("SELECT * FROM suppliers WHERE id = $1", [matchedSupplierId]),
  ]);
  assert.equal(supplier.rows[0].integration_pending_review, true);
  assert.equal(customer.rows[0].module, "both");
  assert.equal(customer.rows[0].integration_pending_review, true);
  assert.equal(carrier.rows[0].full_name, "Полное название перевозчика");
  assert.equal(carrier.rows[0].integration_pending_review, true);
  assert.equal(matched.rows[0].id_1c, ids.matchedSupplier);
  assert.equal(matched.rows[0].integration_pending_review, false);

  const pendingPageOne = await fetchJson("/api/admin/integrations/1c/pending?limit=2");
  assert.equal(pendingPageOne.response.status, 200);
  assert.equal(pendingPageOne.data.items.length, 2);
  assert.equal(pendingPageOne.data.pageSize, 2);
  assert.equal(pendingPageOne.data.hasMore, true);
  const pendingPageTwo = await fetchJson(`/api/admin/integrations/1c/pending?limit=2&beforeId=${pendingPageOne.data.nextCursor}`);
  assert.equal(pendingPageTwo.data.items.length, 1);
  assert.equal(pendingPageTwo.data.hasMore, false);
  const pendingImportedItems = [...pendingPageOne.data.items, ...pendingPageTwo.data.items];
  assert.equal(
    new Set(pendingImportedItems.map((item) => item.entityId)).size,
    3,
    "pending review pages do not duplicate imported entities",
  );

  const adminEdit = await fetchJson(`/api/suppliers/${supplier.rows[0].id}`, {
    method: "PATCH",
    body: {
      name: "Ручная корректировка администратора",
      fullName: "Полное название после корректировки",
      inn: "1C-TEST-ADMIN-EDIT",
    },
  });
  assert.equal(adminEdit.response.status, 200, "administrators retain the ability to edit 1C master fields");

  const editorRole = await pool.query(
    `INSERT INTO roles (name, description, permissions, is_default, is_system)
     VALUES ($1, 'Temporary integration-test editor',
       ARRAY['counterparties.edit', 'directories.edit', 'counterparties.create',
             'directories.create', 'counterparties.delete', 'directories.delete'],
       false, false)
     RETURNING id`,
    [`1C editor ${suffix}`],
  );
  testEditorRoleId = editorRole.rows[0].id;
  const editorPassword = `1C-editor-${randomUUID()}`;
  const editorRegistration = await fetchJson("/api/auth/register", {
    method: "POST",
    cookie: null,
    body: {
      email: testEditorEmail,
      password: editorPassword,
      confirmPassword: editorPassword,
      firstName: "1C",
      lastName: "Editor",
    },
  });
  assert.equal(editorRegistration.response.status, 201);
  const editorCookie = editorRegistration.setCookie?.split(";", 1)[0];
  assert.ok(editorCookie, "ordinary editor session cookie is set");
  await pool.query(
    "UPDATE users SET role_id = $1 WHERE email = $2",
    [testEditorRoleId, testEditorEmail],
  );
  const editOperationalField = await fetchJson(`/api/suppliers/${supplier.rows[0].id}`, {
    method: "PATCH",
    cookie: editorCookie,
    body: { description: "Поле приложения доступно обычному пользователю" },
  });
  assert.equal(editOperationalField.response.status, 200);
  const editMasterField = await fetchJson(`/api/suppliers/${supplier.rows[0].id}`, {
    method: "PATCH",
    cookie: editorCookie,
    body: { name: "Обычный пользователь не может менять название" },
  });
  assert.equal(editMasterField.response.status, 409);
  const createAsEditor = await fetchJson("/api/suppliers", {
    method: "POST",
    cookie: editorCookie,
    body: { name: "Обычный пользователь не может создать запись" },
  });
  assert.equal(createAsEditor.response.status, 403);
  const deleteAsEditor = await fetchJson(`/api/suppliers/${supplier.rows[0].id}`, {
    method: "DELETE",
    cookie: editorCookie,
  });
  assert.equal(deleteAsEditor.response.status, 403);
  const reviewAsEditor = await fetchJson(`/api/admin/integrations/1c/entities/supplier/${supplier.rows[0].id}/review`, {
    method: "POST",
    cookie: editorCookie,
    body: { action: "approve" },
  });
  assert.equal(reviewAsEditor.response.status, 403, "only administrators may review 1C records");

  const approveOne = await fetchJson("/api/admin/integrations/1c/changes/review-bulk", {
    method: "POST",
    body: { ids: [pendingImportedItems.find((item) => item.entityType === "supplier").id], action: "approve" },
  });
  assert.equal(approveOne.response.status, 200);
  assert.equal(approveOne.data.reviewed, 1);
  const supplierAfterReview = await pool.query("SELECT integration_pending_review FROM suppliers WHERE id = $1", [supplier.rows[0].id]);
  assert.equal(supplierAfterReview.rows[0].integration_pending_review, false);

  const rejectCustomerInline = await fetchJson(`/api/admin/integrations/1c/entities/customer/${customer.rows[0].id}/review`, {
    method: "POST",
    body: { action: "reject" },
  });
  assert.equal(rejectCustomerInline.response.status, 200);
  const customerAfterReview = await pool.query("SELECT integration_pending_review, deleted_at FROM customers WHERE id = $1", [customer.rows[0].id]);
  assert.equal(customerAfterReview.rows[0].integration_pending_review, false);
  assert.ok(customerAfterReview.rows[0].deleted_at, "inline rejection softly deletes the new entity");

  const approveAllRemaining = await fetchJson("/api/admin/integrations/1c/changes/review-bulk", {
    method: "POST",
    body: { all: true, excludeIds: [], action: "approve" },
  });
  assert.equal(approveAllRemaining.response.status, 200);
  assert.equal(approveAllRemaining.data.reviewed, 1, "select-all acts on all remaining pending records");
  const pendingAfterReview = await fetchJson("/api/admin/integrations/1c/status");
  assert.equal(pendingAfterReview.data.pendingReviewCount, 0);

  const update = await fetchJson(`${apiRoot}/counterparties/sync`, {
    method: "POST",
    token: firstKey,
    cookie: null,
    body: { items: [{
      type: "supplier",
      id_1c: ids.supplier,
      inn: inns.supplier,
      name: "1С: обновлённый поставщик",
      full_name: "Обновлённое полное название поставщика",
      status: "active",
    }] },
  });
  assert.equal(update.data.results[0].outcome, "updated");
  const updatedSupplier = await pool.query("SELECT name, full_name FROM suppliers WHERE id_1c = $1", [ids.supplier]);
  assert.equal(updatedSupplier.rows[0].name, "1С: обновлённый поставщик");
  assert.equal(updatedSupplier.rows[0].full_name, "Обновлённое полное название поставщика");

  const deletion = await fetchJson(`${apiRoot}/counterparties/sync`, {
    method: "POST",
    token: firstKey,
    cookie: null,
    body: { items: [{
      type: "customer",
      id_1c: ids.customer,
      name: "1С: новый покупатель",
      status: "deletion_marked",
    }] },
  });
  assert.equal(deletion.data.results[0].outcome, "deleted");
  const deletedCustomer = await pool.query("SELECT deleted_at FROM customers WHERE id_1c = $1", [ids.customer]);
  assert.ok(deletedCustomer.rows[0].deleted_at, "1C deletion is represented as a soft delete");

  const restore = await fetchJson(`${apiRoot}/counterparties/sync`, {
    method: "POST",
    token: firstKey,
    cookie: null,
    body: { items: [{
      type: "customer",
      id_1c: ids.customer,
      name: "1С: восстановленный покупатель",
      status: "active",
    }] },
  });
  assert.equal(restore.data.results[0].outcome, "updated");
  const restoredCustomer = await pool.query("SELECT deleted_at FROM customers WHERE id_1c = $1", [ids.customer]);
  assert.equal(restoredCustomer.rows[0].deleted_at, null);

  await pool.query(
    `INSERT INTO suppliers (name, inn) VALUES ('1C test duplicate A', $1), ('1C test duplicate B', $1)`,
    [inns.ambiguous],
  );
  const conflict = await fetchJson(`${apiRoot}/counterparties/sync`, {
    method: "POST",
    token: firstKey,
    cookie: null,
    body: { items: [{
      type: "supplier",
      id_1c: ids.ambiguous,
      inn: inns.ambiguous,
      name: "Неоднозначное сопоставление",
      status: "active",
    }] },
  });
  assert.equal(conflict.data.results[0].outcome, "conflict");
  assert.equal(conflict.data.results[0].code, "ambiguous_inn");

  const unknownDeletion = await fetchJson(`${apiRoot}/counterparties/sync`, {
    method: "POST",
    token: firstKey,
    cookie: undefined,
    body: { items: [{
      type: "carrier",
      id_1c: ids.unknownDeletion,
      name: "Неизвестное удаление",
      status: "удален",
    }] },
  });
  assert.equal(unknownDeletion.data.results[0].outcome, "skipped");

  const exportResponse = await fetchJson(`${apiRoot}/counterparties`, { token: firstKey, cookie: null });
  assert.equal(exportResponse.response.status, 200);
  assert.ok(exportResponse.data.items.some((row) => row.id_1c === ids.supplier && row.type === "supplier"));
  assert.ok(exportResponse.data.items.some((row) => row.id_1c === ids.carrier && row.type === "carrier"));

  for (const requestId of trackedRequestIds) await waitForRequestLog(requestId);
  const requestLog = await waitForRequestLog(imported.requestId);
  assert.equal(requestLog.path, `${apiRoot}/counterparties/sync`);
  assert.equal(requestLog.item_count, 4);
  assert.ok(requestLog.request_content_length > 0);
  assert.ok(requestLog.response_content_length > 0);
  assert.equal(requestLog.user_agent, "1C-integration-test");
  assert.ok(requestLog.response_summary.results.length === 4);
  assert.equal(JSON.stringify(requestLog.response_summary).includes(firstKey), false);
  const failedItemLog = await pool.query(
    "SELECT error_code FROM integration_request_logs WHERE request_id = $1",
    [conflict.requestId],
  );
  assert.equal(failedItemLog.rows[0].error_code, "item_errors");
  const audit = await pool.query(
    "SELECT operation, outcome, incoming_data, old_data, new_data FROM integration_change_logs WHERE request_id = $1",
    [imported.requestId],
  );
  assert.equal(audit.rows.length, 4);
  assert.equal(audit.rows.find((row) => row.incoming_data?.id_1c === ids.supplier)?.incoming_data?.inn, inns.supplier);
  assert.equal(audit.rows.find((row) => row.incoming_data?.id_1c === ids.supplier)?.new_data?.name, "1С: новый поставщик");
  assert.ok(audit.rows.some((row) => row.operation === "link_and_update" && row.outcome === "updated"));

  const rotated = await fetchJson("/api/admin/integrations/1c/api-key", { method: "POST", body: {} });
  assert.equal(rotated.response.status, 201);
  const secondKey = rotated.data.apiKey;
  apiKeyIds.add(rotated.data.activeKey.id);
  assert.notEqual(secondKey, firstKey);
  const revokedFirstKeyHealth = await fetchJson(`${apiRoot}/health`, { token: firstKey, cookie: null });
  assert.equal(revokedFirstKeyHealth.response.status, 401);
  const rotatedKeyHealth = await fetchJson(`${apiRoot}/health`, { token: secondKey, cookie: null });
  assert.equal(rotatedKeyHealth.response.status, 200);

  const paginationSeed = await pool.query(
    `INSERT INTO integration_request_logs (request_id, method, path, status_code, duration_ms)
     SELECT gen_random_uuid(), 'GET', '/api/integrations/1c/v1/pagination-test', 200, 1
     FROM generate_series(1, 55) RETURNING id`,
  );
  paginationLogIds.push(...paginationSeed.rows.map((row) => row.id));
  const firstPage = await fetchJson("/api/admin/integrations/1c/logs");
  assert.equal(firstPage.response.status, 200);
  assert.equal(firstPage.data.pageSize, 50);
  assert.equal(firstPage.data.requests.length, 50);
  assert.equal(firstPage.data.hasMoreRequests, true);
  const secondPage = await fetchJson(`/api/admin/integrations/1c/logs?beforeId=${firstPage.data.nextCursor}`);
  assert.ok(secondPage.data.requests.length > 0);
  const firstPageIds = new Set(firstPage.data.requests.map((row) => row.id));
  assert.ok(secondPage.data.requests.every((row) => !firstPageIds.has(row.id)));
  assert.deepEqual(secondPage.data.changes, []);

  const revoke = await fetchJson("/api/admin/integrations/1c/api-key", { method: "DELETE" });
  assert.equal(revoke.response.status, 200);
  const revokedSecondKeyHealth = await fetchJson(`${apiRoot}/health`, { token: secondKey, cookie: null });
  assert.equal(revokedSecondKeyHealth.response.status, 401);

  const storedKeys = await pool.query(
    "SELECT key_hash, revoked_at FROM integration_api_keys WHERE id = ANY($1::uuid[])",
    [[...apiKeyIds]],
  );
  assert.equal(storedKeys.rows.length, 2);
  assert.ok(storedKeys.rows.every((row) => row.revoked_at), "rotated and revoked keys are no longer active");
  const expectedHashes = new Set(
    [firstKey, secondKey].map((key) => createHash("sha256").update(key, "utf8").digest("hex")),
  );
  assert.ok(storedKeys.rows.every((row) => expectedHashes.has(row.key_hash)));
  const disabledMode = await fetchJson("/api/integrations/1c/mode");
  assert.equal(disabledMode.data.counterpartyMasterDataEnabled, false);
});
