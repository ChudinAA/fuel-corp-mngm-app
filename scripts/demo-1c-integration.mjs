import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const entityIds = {
  supplier: "f1c00000-1000-4000-8000-000000000001",
  customer: "f1c00000-1000-4000-8000-000000000002",
  carrier: "f1c00000-1000-4000-8000-000000000003",
  matchedSupplier: "f1c00000-1000-4000-8000-000000000004",
  deletedSupplier: "f1c00000-1000-4000-8000-000000000005",
};
const externalIds = {
  supplier: "f1c00000-0000-4000-8000-000000000001",
  customer: "f1c00000-0000-4000-8000-000000000002",
  carrier: "f1c00000-0000-4000-8000-000000000003",
  matchedSupplier: "f1c00000-0000-4000-8000-000000000004",
  deletedSupplier: "f1c00000-0000-4000-8000-000000000005",
  unknownDeletion: "f1c00000-0000-4000-8000-000000000006",
};
const requestId = "f1c00000-0000-4000-8000-000000000010";
const demoInns = {
  supplier: "DEMO-1C-SUPPLIER-001",
  customer: "DEMO-1C-CUSTOMER-001",
  carrier: "DEMO-1C-CARRIER-001",
  matched: "DEMO-1C-LINKED-SUPPLIER-001",
  deleted: "DEMO-1C-DELETED-SUPPLIER-001",
};
const incomingItems = [
  { type: "supplier", id_1c: externalIds.supplier, inn: demoInns.supplier, name: "DEMO 1C — Новый поставщик", full_name: "Демо: новое полное название поставщика", status: "active" },
  { type: "customer", id_1c: externalIds.customer, inn: demoInns.customer, name: "DEMO 1C — Новый покупатель", full_name: "Демо: новое полное название покупателя", status: "enabled" },
  { type: "carrier", id_1c: externalIds.carrier, inn: demoInns.carrier, name: "DEMO 1C — Новый перевозчик", full_name: "Демо: новое полное название перевозчика", status: "активен" },
  { type: "supplier", id_1c: externalIds.matchedSupplier, inn: demoInns.matched, name: "DEMO 1C — Сопоставленный поставщик", full_name: "Демо: обновлённое название после сопоставления по ИНН", status: "active" },
  { type: "supplier", id_1c: externalIds.deletedSupplier, inn: demoInns.deleted, name: "DEMO 1C — Помеченный на удаление поставщик", full_name: "Демо: запись удалена в 1С", status: "deletion_marked" },
  { type: "carrier", id_1c: externalIds.unknownDeletion, name: "DEMO 1C — Удаление неизвестной записи", status: "deletion_marked" },
];

function assertDevelopmentEnvironment() {
  const host = process.env.REPLIT_DEV_DOMAIN ?? "";
  if (process.env.NODE_ENV !== "development" || !host.endsWith(".replit.dev")) {
    throw new Error("Демо-скрипт разрешён только из development-среды Replit.");
  }
}

async function ensureNoReferences(client, tableName, entityIdsToCheck, allowedReferences = []) {
  if (!entityIdsToCheck.length) return;
  const refs = await client.query(
    `SELECT kcu.table_name, kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.constraint_schema = kcu.constraint_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND ccu.table_schema = 'public'
       AND ccu.table_name = $1
       AND ccu.column_name = 'id'`,
    [tableName],
  );
  for (const { table_name, column_name } of refs.rows) {
    if (allowedReferences.includes(`${table_name}.${column_name}`)) continue;
    if (!/^[a-z_][a-z0-9_]*$/i.test(table_name) || !/^[a-z_][a-z0-9_]*$/i.test(column_name)) {
      throw new Error("Не удалось проверить зависимости демо-записи.");
    }
    const dependent = await client.query(
      `SELECT EXISTS(SELECT 1 FROM "${table_name}" WHERE "${column_name}" = ANY($1::uuid[])) AS found`,
      [entityIdsToCheck],
    );
    if (dependent.rows[0]?.found) {
      throw new Error(`Очистка остановлена: демо-запись используется в ${table_name}. Сначала удалите тестовую связь.`);
    }
  }
}

async function cleanupDemo() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const supplierRows = await client.query(
      "SELECT id FROM suppliers WHERE id = ANY($1::uuid[]) FOR UPDATE",
      [[entityIds.supplier, entityIds.matchedSupplier, entityIds.deletedSupplier]],
    );
    const customerRows = await client.query(
      "SELECT id FROM customers WHERE id = $1 FOR UPDATE",
      [entityIds.customer],
    );
    const carrierRows = await client.query(
      "SELECT id FROM logistics_carriers WHERE id = $1 FOR UPDATE",
      [entityIds.carrier],
    );
    const supplierIds = supplierRows.rows.map((row) => row.id);
    const customerIds = customerRows.rows.map((row) => row.id);
    const carrierIds = carrierRows.rows.map((row) => row.id);

    await ensureNoReferences(client, "suppliers", supplierIds, ["supplier_bases.supplier_id"]);
    await ensureNoReferences(client, "customers", customerIds, ["customer_bases.customer_id"]);
    await ensureNoReferences(client, "logistics_carriers", carrierIds);

    await client.query("DELETE FROM integration_change_logs WHERE request_id = $1", [requestId]);
    await client.query("DELETE FROM integration_request_logs WHERE request_id = $1", [requestId]);
    if (supplierIds.length) {
      await client.query("DELETE FROM supplier_bases WHERE supplier_id = ANY($1::uuid[])", [supplierIds]);
      await client.query("DELETE FROM suppliers WHERE id = ANY($1::uuid[])", [supplierIds]);
    }
    if (customerIds.length) {
      await client.query("DELETE FROM customer_bases WHERE customer_id = ANY($1::uuid[])", [customerIds]);
      await client.query("DELETE FROM customers WHERE id = ANY($1::uuid[])", [customerIds]);
    }
    if (carrierIds.length) {
      await client.query("DELETE FROM logistics_carriers WHERE id = ANY($1::uuid[])", [carrierIds]);
    }
    await client.query("COMMIT");
    console.log("Демо-записи и синтетический журнал обмена удалены. API-ключ и настройки интеграции не затронуты.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function seedDemo() {
  assertDevelopmentEnvironment();
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const existing = await client.query(
      `SELECT EXISTS(
         SELECT 1 FROM suppliers WHERE id = ANY($1::uuid[]) OR id_1c = ANY($2::text[]) OR inn = ANY($3::text[])
         UNION ALL SELECT 1 FROM customers WHERE id = $4 OR id_1c = $5 OR inn = $6
         UNION ALL SELECT 1 FROM logistics_carriers WHERE id = $7 OR id_1c = $8 OR inn = $9
         UNION ALL SELECT 1 FROM integration_request_logs WHERE request_id = $10
       ) AS found`,
      [
        [entityIds.supplier, entityIds.matchedSupplier, entityIds.deletedSupplier],
        [externalIds.supplier, externalIds.matchedSupplier, externalIds.deletedSupplier],
        [demoInns.supplier, demoInns.matched, demoInns.deleted],
        entityIds.customer, externalIds.customer, demoInns.customer,
        entityIds.carrier, externalIds.carrier, demoInns.carrier, requestId,
      ],
    );
    if (existing.rows[0]?.found) {
      throw new Error("Демо-данные уже существуют или их идентификаторы заняты. Сначала проверьте данные.");
    }

    const inputLength = Buffer.byteLength(JSON.stringify({ items: incomingItems }));
    const results = [];
    await client.query(
      `INSERT INTO suppliers (id, name, full_name, inn, is_active, integration_pending_review)
       VALUES ($1, $2, $3, $4, true, false)`,
      [entityIds.matchedSupplier, "DEMO 1C — Поставщик до сопоставления", "Старая полная запись до обмена", demoInns.matched],
    );

    const supplier = await client.query(
      `INSERT INTO suppliers (id, name, full_name, inn, id_1c, integration_status, integration_pending_review, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true, true) RETURNING id`,
      [entityIds.supplier, incomingItems[0].name, incomingItems[0].full_name, demoInns.supplier, externalIds.supplier, incomingItems[0].status],
    );
    const customer = await client.query(
      `INSERT INTO customers (id, name, full_name, inn, id_1c, integration_status, integration_pending_review, module, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true, 'both', true) RETURNING id`,
      [entityIds.customer, incomingItems[1].name, incomingItems[1].full_name, demoInns.customer, externalIds.customer, incomingItems[1].status],
    );
    const carrier = await client.query(
      `INSERT INTO logistics_carriers (id, name, full_name, inn, id_1c, integration_status, integration_pending_review, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true, true) RETURNING id`,
      [entityIds.carrier, incomingItems[2].name, incomingItems[2].full_name, demoInns.carrier, externalIds.carrier, incomingItems[2].status],
    );

    const matchedBefore = {
      id_1c: null,
      inn: demoInns.matched,
      name: "DEMO 1C — Поставщик до сопоставления",
      full_name: "Старая полная запись до обмена",
      status: null,
      deleted_at: null,
    };
    const matchedAfter = {
      id_1c: externalIds.matchedSupplier,
      inn: demoInns.matched,
      name: incomingItems[3].name,
      full_name: incomingItems[3].full_name,
      status: incomingItems[3].status,
      deleted_at: null,
    };
    await client.query(
      `UPDATE suppliers SET id_1c = $1, name = $2, full_name = $3, integration_status = $4, updated_at = now()
       WHERE id = $5`,
      [externalIds.matchedSupplier, incomingItems[3].name, incomingItems[3].full_name, incomingItems[3].status, entityIds.matchedSupplier],
    );

    const deletedSupplier = await client.query(
      `INSERT INTO suppliers (id, name, full_name, inn, id_1c, integration_status, integration_pending_review, is_active, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, false, now()) RETURNING id`,
      [entityIds.deletedSupplier, incomingItems[4].name, incomingItems[4].full_name, demoInns.deleted, externalIds.deletedSupplier, incomingItems[4].status],
    );

    const newEntitySnapshots = [
      { type: "supplier", item: incomingItems[0], id: supplier.rows[0].id },
      { type: "customer", item: incomingItems[1], id: customer.rows[0].id },
      { type: "carrier", item: incomingItems[2], id: carrier.rows[0].id },
    ];
    for (const { type, item, id } of newEntitySnapshots) {
      await client.query(
        `INSERT INTO integration_change_logs
          (request_id, entity_type, entity_id, id_1c, operation, outcome, incoming_data, new_data)
         VALUES ($1, $2, $3, $4, 'create', 'created', $5::jsonb, $6::jsonb)`,
        [
          requestId, type, id, item.id_1c, JSON.stringify(item),
          JSON.stringify({ id_1c: item.id_1c, inn: item.inn, name: item.name, full_name: item.full_name, status: item.status, deleted_at: null }),
        ],
      );
      results.push({ id_1c: item.id_1c, type, outcome: "created", code: "id_1c", entity_id: id });
    }
    await client.query(
      `INSERT INTO integration_change_logs
        (request_id, entity_type, entity_id, id_1c, operation, outcome, incoming_data, old_data, new_data)
       VALUES ($1, 'supplier', $2, $3, 'link_and_update', 'updated', $4::jsonb, $5::jsonb, $6::jsonb)`,
      [requestId, entityIds.matchedSupplier, externalIds.matchedSupplier, JSON.stringify(incomingItems[3]), JSON.stringify(matchedBefore), JSON.stringify(matchedAfter)],
    );
    results.push({ id_1c: externalIds.matchedSupplier, type: "supplier", outcome: "updated", code: "inn", entity_id: entityIds.matchedSupplier });

    const deletedAfter = {
      id_1c: externalIds.deletedSupplier,
      inn: demoInns.deleted,
      name: incomingItems[4].name,
      full_name: incomingItems[4].full_name,
      status: incomingItems[4].status,
      deleted_at: new Date().toISOString(),
    };
    await client.query(
      `INSERT INTO integration_change_logs
        (request_id, entity_type, entity_id, id_1c, operation, outcome, incoming_data, old_data, new_data)
       VALUES ($1, 'supplier', $2, $3, 'delete', 'deleted', $4::jsonb, $5::jsonb, $6::jsonb)`,
      [requestId, deletedSupplier.rows[0].id, externalIds.deletedSupplier, JSON.stringify(incomingItems[4]), JSON.stringify({ id_1c: externalIds.deletedSupplier, inn: demoInns.deleted, name: incomingItems[4].name, full_name: incomingItems[4].full_name, status: "active", deleted_at: null }), JSON.stringify(deletedAfter)],
    );
    results.push({ id_1c: externalIds.deletedSupplier, type: "supplier", outcome: "deleted", code: "id_1c", entity_id: entityIds.deletedSupplier });

    await client.query(
      `INSERT INTO integration_change_logs
        (request_id, entity_type, id_1c, operation, outcome, incoming_data, error_code, error_message)
       VALUES ($1, 'carrier', $2, 'delete', 'skipped', $3::jsonb, 'delete_for_unknown_entity', 'Удаление неизвестной записи пропущено')`,
      [requestId, externalIds.unknownDeletion, JSON.stringify(incomingItems[5])],
    );
    results.push({ id_1c: externalIds.unknownDeletion, type: "carrier", outcome: "skipped", code: "delete_for_unknown_entity", entity_id: null });

    const responseSummary = {
      request_id: requestId,
      count: results.length,
      counts: { created: 3, updated: 1, deleted: 1, skipped: 1 },
      results,
    };
    const responseLength = Buffer.byteLength(JSON.stringify(responseSummary));
    await client.query(
      `INSERT INTO integration_request_logs
        (request_id, method, path, status_code, duration_ms, item_count, client_ip, user_agent,
         request_content_type, request_content_length, response_content_type, response_content_length, response_summary)
       VALUES ($1, 'POST', '/api/integrations/1c/v1/counterparties/sync', 200, 38, $2, '127.0.0.1',
         '1C Demo Fixture — synthetic UI data', 'application/json', $3, 'application/json', $4, $5::jsonb)`,
      [requestId, incomingItems.length, inputLength, responseLength, JSON.stringify(responseSummary)],
    );
    await client.query("COMMIT");

    console.log(`Созданы демо-записи: 3 новых на проверке, 1 сопоставленная по ИНН, 1 удалённая и 1 пропущенное неизвестное удаление. ID запроса: ${requestId}`);
    console.log("Это синтетические данные только для просмотра UI; API-ключ и настройки интеграции не менялись.");
    console.log("После проверки выполните: npm run demo:1c:cleanup");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

const action = process.argv[2];
try {
  assertDevelopmentEnvironment();
  if (action === "seed") await seedDemo();
  else if (action === "cleanup") await cleanupDemo();
  else throw new Error("Используйте команду seed или cleanup.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
