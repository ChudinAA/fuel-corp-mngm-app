import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import pg from "pg";
import WebSocket from "ws";

const { Pool } = pg;
const baseUrl = process.env.E2E_BASE_URL;
const runId = randomUUID();
const fixtures = {
  baseName: `ui-smoke-base-${runId}`,
  wholesaleBaseName: `ui-wholesale-base-${runId}`,
  abroadBaseName: `ui-abroad-base-${runId}`,
  supplierName: `ui-smoke-supplier-${runId}`,
  mixedSupplierName: `ui-mixed-supplier-${runId}`,
  foreignSupplierName: `ui-foreign-supplier-${runId}`,
  buyerName: `ui-smoke-buyer-${runId}`,
  wholesaleBuyerName: `ui-wholesale-buyer-${runId}`,
  foreignBuyerName: `ui-foreign-buyer-${runId}`,
  supplierContractName: `ui-supplier-contract-${runId}`,
  supplierContractNumber: `S-${runId.slice(0, 8)}`,
  buyerContractName: `ui-buyer-contract-${runId}`,
  buyerContractNumber: `B-${runId.slice(0, 8)}`,
  carrierContractName: `ui-carrier-contract-${runId}`,
  carrierContractNumber: `C-${runId.slice(0, 8)}`,
  warehouseName: `ui-smoke-warehouse-${runId}`,
  refuelingNote: `ui-smoke-refueling-${runId}`,
  movementNote: `ui-smoke-movement-${runId}`,
  operationalWarehouseName: `ui-operations-warehouse-${runId}`,
  transferWarehouseName: `ui-operations-transfer-warehouse-${runId}`,
  equipmentName: `ui-operations-equipment-${runId}`,
  carrierName: `ui-operations-carrier-${runId}`,
  nomenclatureNames: {
    kerosene: `ui-operations-kerosene-${runId}`,
    pvkj: `ui-operations-pvkj-${runId}`,
    service: `ui-operations-service-${runId}`,
  },
  nomenclatureUnitShortName: `t-ui-${runId}`,
  receiptNote: `ui-operations-receipt-${runId}`,
  secondReceiptNote: `ui-operations-second-receipt-${runId}`,
  warehouseTransferNote: `ui-operations-warehouse-transfer-${runId}`,
  equipmentTransferNote: `ui-operations-equipment-transfer-${runId}`,
  finalRefuelingNote: `ui-operations-final-refueling-${runId}`,
};
let browser;
let profileDir;
let pool;
let nomenclatureIds = {};
let basisIds = {};

after(async () => {
  await stopBrowser();
  try {
    if (pool) await cleanUiFixtures();
  } finally {
    if (pool) {
      await pool.end();
      pool = undefined;
    }
    if (profileDir) await removeProfile();
  }
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function seedUiFixtures() {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const bases = await pool.query(
    `INSERT INTO bases (name, base_type)
     VALUES ($1, 'refueling'),
            ($2, 'wholesale'),
            ($3, 'abroad')
     RETURNING id, name`,
    [
      fixtures.baseName,
      fixtures.wholesaleBaseName,
      fixtures.abroadBaseName,
    ],
  );
  basisIds = Object.fromEntries(
    bases.rows.map((base) => [base.name, base.id]),
  );
  const supplier = await pool.query(
    "INSERT INTO suppliers (name) VALUES ($1) RETURNING id",
    [fixtures.supplierName],
  );
  const mixedSupplier = await pool.query(
    "INSERT INTO suppliers (name) VALUES ($1) RETURNING id",
    [fixtures.mixedSupplierName],
  );
  const foreignSupplier = await pool.query(
    "INSERT INTO suppliers (name, is_foreign) VALUES ($1, true) RETURNING id",
    [fixtures.foreignSupplierName],
  );
  await pool.query(
    `INSERT INTO supplier_bases (supplier_id, base_id)
     VALUES ($1, $2), ($3, $4), ($3, $5), ($6, $7)`,
    [
      supplier.rows[0].id,
      basisIds[fixtures.baseName],
      mixedSupplier.rows[0].id,
      basisIds[fixtures.baseName],
      basisIds[fixtures.wholesaleBaseName],
      foreignSupplier.rows[0].id,
      basisIds[fixtures.abroadBaseName],
    ],
  );
  const buyer = await pool.query(
    "INSERT INTO customers (name, module) VALUES ($1, 'refueling') RETURNING id",
    [fixtures.buyerName],
  );
  const wholesaleBuyer = await pool.query(
    "INSERT INTO customers (name, module) VALUES ($1, 'wholesale') RETURNING id",
    [fixtures.wholesaleBuyerName],
  );
  const foreignBuyer = await pool.query(
    "INSERT INTO customers (name, module, is_foreign) VALUES ($1, 'wholesale', true) RETURNING id",
    [fixtures.foreignBuyerName],
  );
  await pool.query(
    `INSERT INTO customer_bases (customer_id, base_id)
     VALUES ($1, $2), ($3, $4), ($5, $6)`,
    [
      buyer.rows[0].id,
      basisIds[fixtures.baseName],
      wholesaleBuyer.rows[0].id,
      basisIds[fixtures.wholesaleBaseName],
      foreignBuyer.rows[0].id,
      basisIds[fixtures.abroadBaseName],
    ],
  );
  await pool.query(
    `INSERT INTO warehouses
       (name, current_balance_tonnes, average_cost_per_tonne,
        pvkj_balance_tonnes, pvkj_average_cost_per_tonne)
     VALUES ($1, 0, 0, 0, 0)`,
    [fixtures.warehouseName],
  );
  const operationalWarehouses = await Promise.all([
    pool.query(
      `INSERT INTO warehouses
         (name, current_balance_tonnes, average_cost_per_tonne,
          pvkj_balance_tonnes, pvkj_average_cost_per_tonne, equipment_type)
       VALUES ($1, 0, 0, 0, 0, 'lik')
       RETURNING id`,
      [fixtures.operationalWarehouseName],
    ),
    pool.query(
      `INSERT INTO warehouses
         (name, current_balance_tonnes, average_cost_per_tonne,
          pvkj_balance_tonnes, pvkj_average_cost_per_tonne, equipment_type)
       VALUES ($1, 0, 0, 0, 0, 'lik')
       RETURNING id`,
      [fixtures.transferWarehouseName],
    ),
  ]);
  for (const { rows } of operationalWarehouses) {
    await pool.query(
      "INSERT INTO warehouse_bases (warehouse_id, base_id) VALUES ($1, (SELECT id FROM bases WHERE name = $2))",
      [rows[0].id, fixtures.baseName],
    );
  }
  await pool.query(
    "UPDATE warehouses SET supplier_id = $1 WHERE id = $2",
    [supplier.rows[0].id, operationalWarehouses[0].rows[0].id],
  );
  const carrier = await pool.query(
    "INSERT INTO logistics_carriers (name) VALUES ($1) RETURNING id",
    [fixtures.carrierName],
  );
  await pool.query(
    `INSERT INTO delivery_cost
       (carrier_id, from_entity_type, from_entity_id, from_location,
        to_entity_type, to_entity_id, to_location, cost_per_tonne)
     VALUES ($1, 'base', $2, $3, 'warehouse', $4, $5, 0),
            ($1, 'base', $6, $7, 'warehouse', $4, $5, 250)`,
    [
      carrier.rows[0].id,
      basisIds[fixtures.baseName],
      fixtures.baseName,
      operationalWarehouses[1].rows[0].id,
      fixtures.transferWarehouseName,
      basisIds[fixtures.wholesaleBaseName],
      fixtures.wholesaleBaseName,
    ],
  );
  await pool.query(
    `INSERT INTO counterparty_contracts
       (contract_name, contract_number, contract_date, supplier_id)
     VALUES ($1, $2, '2026-01-01', $3)`,
    [
      fixtures.supplierContractName,
      fixtures.supplierContractNumber,
      supplier.rows[0].id,
    ],
  );
  await pool.query(
    `INSERT INTO counterparty_contracts
       (contract_name, contract_number, contract_date, buyer_id)
     VALUES ($1, $2, '2026-01-01', $3)`,
    [
      fixtures.buyerContractName,
      fixtures.buyerContractNumber,
      wholesaleBuyer.rows[0].id,
    ],
  );
  await pool.query(
    `INSERT INTO counterparty_contracts
       (contract_name, contract_number, contract_date, carrier_id)
     VALUES ($1, $2, '2026-01-01', $3)`,
    [
      fixtures.carrierContractName,
      fixtures.carrierContractNumber,
      carrier.rows[0].id,
    ],
  );
  const equipment = await pool.query(
    `INSERT INTO equipments
       (name, current_balance_tonnes, average_cost_per_tonne,
        pvkj_balance_tonnes, pvkj_average_cost_per_tonne)
     VALUES ($1, 0, 0, 0, 0)
     RETURNING id`,
    [fixtures.equipmentName],
  );
  const unit = await pool.query(
    `INSERT INTO units_of_measure (short_name, full_name)
     VALUES ($1, 'UI test unit')
     RETURNING id`,
    [fixtures.nomenclatureUnitShortName],
  );
  nomenclatureIds = {};
  for (const productType of ["kerosene", "pvkj", "service"]) {
    const nomenclature = await pool.query(
      `INSERT INTO nomenclature (product_type, name, unit_id, is_default)
       VALUES ($1, $2, $3, true)
       RETURNING id`,
      [
        productType,
        fixtures.nomenclatureNames[productType],
        unit.rows[0].id,
      ],
    );
    nomenclatureIds[productType] = nomenclature.rows[0].id;
  }
  await pool.query(
    `INSERT INTO supplier_basis_prices
       (supplier_id, basis_id, service_price_per_tonne,
        agent_fee_per_tonne, other_service_type, other_service_value,
        other_service_name, other_service_quantity)
     VALUES ($1, $2, 125, 75, 'fixed', 30, 'Обработка', 1),
            ($1, $3, 250, NULL, 'fixed', 40, 'Погрузка', 1),
            ($4, $5, 500, 100, 'fixed', 50, 'Терминал', 1)`,
    [
      mixedSupplier.rows[0].id,
      basisIds[fixtures.baseName],
      basisIds[fixtures.wholesaleBaseName],
      foreignSupplier.rows[0].id,
      basisIds[fixtures.abroadBaseName],
    ],
  );
  await pool.query(
    `INSERT INTO prices
       (product_type, counterparty_id, counterparty_type, counterparty_role,
        basis, basis_id, nomenclature_id, price_values, date_from, date_to, volume_unit,
        price_unit, contract_limit_enabled)
     SELECT 'kerosene', s.id, 'wholesale', 'supplier', b.name, b.id, n.id,
            ARRAY['{"price":10000}'], '2026-10-01', '2026-10-05',
            'tonne', 'tonne', false
     FROM suppliers s, bases b, nomenclature n
     WHERE s.name = $1 AND b.name = $2 AND n.id = $3`,
    [fixtures.supplierName, fixtures.baseName, nomenclatureIds.kerosene],
  );
  await pool.query(
    `INSERT INTO prices
       (product_type, counterparty_id, counterparty_type, counterparty_role,
        basis, basis_id, nomenclature_id, price_values, date_from, date_to, volume_unit,
        price_unit, contract_limit_enabled)
     SELECT 'kerosene', s.id, 'wholesale', 'supplier', b.name, b.id, n.id,
            ARRAY['{"price":20000}'], '2026-10-06', '2026-10-31',
            'tonne', 'tonne', false
     FROM suppliers s, bases b, nomenclature n
     WHERE s.name = $1 AND b.name = $2 AND n.id = $3`,
    [fixtures.supplierName, fixtures.baseName, nomenclatureIds.kerosene],
  );
  await pool.query(
    `INSERT INTO prices
       (product_type, counterparty_id, counterparty_type, counterparty_role,
        basis, basis_id, nomenclature_id, price_values, date_from, date_to, volume_unit,
        price_unit, contract_limit_enabled)
     SELECT 'kerosene', s.id, 'refueling', 'supplier', b.name, b.id, n.id,
             ARRAY['{"price":15000}'], '2026-10-01', '2026-10-31',
            'tonne', 'tonne', false
     FROM suppliers s, bases b, nomenclature n
     WHERE s.name = $1 AND b.name = $2 AND n.id = $3`,
    [fixtures.supplierName, fixtures.baseName, nomenclatureIds.kerosene],
  );
  await pool.query(
    `INSERT INTO prices
       (product_type, counterparty_id, counterparty_type, counterparty_role,
        basis, basis_id, nomenclature_id, price_values, date_from, date_to, volume_unit,
        price_unit, contract_limit_enabled)
     SELECT 'kerosene', c.id, 'refueling', 'buyer', b.name, b.id, n.id,
            ARRAY['{"price":20000}'], '2026-10-01', '2026-10-31',
            'tonne', 'tonne', false
     FROM customers c, bases b, nomenclature n
     WHERE c.name = $1 AND b.name = $2 AND n.id = $3`,
    [fixtures.buyerName, fixtures.baseName, nomenclatureIds.kerosene],
  );
  await pool.query(
    `INSERT INTO prices
       (product_type, counterparty_id, counterparty_type, counterparty_role,
        basis, basis_id, nomenclature_id, price_values, date_from, date_to,
        volume_unit, price_unit, contract_limit_enabled)
     VALUES
       ('kerosene', $1, 'wholesale', 'supplier', $2, $3, $4,
        ARRAY['{"price":30000}'], '2026-10-01', '2026-10-31',
        'tonne', 'tonne', false),
       ('kerosene', $5, 'wholesale', 'buyer', $2, $3, $4,
        ARRAY['{"price":35000}'], '2026-10-01', '2026-10-31',
        'tonne', 'tonne', false)`,
    [
      mixedSupplier.rows[0].id,
      fixtures.wholesaleBaseName,
      basisIds[fixtures.wholesaleBaseName],
      nomenclatureIds.kerosene,
      wholesaleBuyer.rows[0].id,
    ],
  );
}

async function cleanUiFixtures() {
  const [refuelings, movements, equipmentMovements] = await Promise.all([
    pool.query(
      "SELECT id FROM aircraft_refueling WHERE notes = ANY($1::text[])",
      [[fixtures.refuelingNote, fixtures.finalRefuelingNote]],
    ),
    pool.query(
      "SELECT id FROM movement WHERE notes = ANY($1::text[])",
      [[fixtures.movementNote, fixtures.receiptNote, fixtures.secondReceiptNote, fixtures.warehouseTransferNote]],
    ),
    pool.query(
      "SELECT id FROM equipment_movement WHERE notes = $1",
      [fixtures.equipmentTransferNote],
    ),
  ]);
  const entityIds = [
    ...refuelings.rows.map((row) => row.id),
    ...movements.rows.map((row) => row.id),
    ...equipmentMovements.rows.map((row) => row.id),
  ];
  if (entityIds.length) {
    await pool.query(
      "DELETE FROM audit_log WHERE entity_id::text = ANY($1::text[])",
      [entityIds],
    );
  }
  const movementIds = movements.rows.map((row) => row.id);
  const equipmentMovementIds = equipmentMovements.rows.map((row) => row.id);
  if (refuelings.rows.length) {
    const ids = refuelings.rows.map((row) => row.id);
    await pool.query(
      `UPDATE aircraft_refueling
       SET transaction_id = NULL, equipment_transaction_id = NULL
       WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    await pool.query(
      "DELETE FROM warehouse_transactions WHERE source_type = 'refueling' AND source_id = ANY($1::uuid[])",
      [ids],
    );
    await pool.query(
      "DELETE FROM equipment_transactions WHERE source_type = 'refueling' AND source_id = ANY($1::uuid[])",
      [ids],
    );
  }
  if (equipmentMovementIds.length) {
    await pool.query(
      `UPDATE equipment_movement
       SET transaction_id = NULL, source_transaction_id = NULL,
           warehouse_transaction_id = NULL, source_warehouse_transaction_id = NULL
       WHERE id = ANY($1::uuid[])`,
      [equipmentMovementIds],
    );
    await pool.query(
      "DELETE FROM equipment_transactions WHERE source_type = 'movement' AND source_id = ANY($1::uuid[])",
      [equipmentMovementIds],
    );
    await pool.query(
      "DELETE FROM warehouse_transactions WHERE source_type = 'movement' AND source_id = ANY($1::uuid[])",
      [equipmentMovementIds],
    );
  }
  if (movementIds.length) {
    await pool.query(
      `UPDATE movement
       SET transaction_id = NULL, source_transaction_id = NULL
       WHERE id = ANY($1::uuid[])`,
      [movementIds],
    );
  }
  await pool.query(
    "DELETE FROM movement WHERE id = ANY($1::uuid[])",
    [movementIds],
  );
  if (movementIds.length) {
    await pool.query(
      "DELETE FROM warehouse_transactions WHERE source_type = 'movement' AND source_id = ANY($1::uuid[])",
      [movementIds],
    );
  }
  if (movements.rows.length) {
    await pool.query(
      "DELETE FROM recalculation_queue WHERE warehouse_id IN (SELECT id FROM warehouses WHERE name = ANY($1::text[]))",
      [[fixtures.operationalWarehouseName, fixtures.transferWarehouseName]],
    );
  }
  await pool.query(
    "DELETE FROM counterparty_contracts WHERE contract_name = ANY($1::text[])",
    [[
      fixtures.supplierContractName,
      fixtures.buyerContractName,
      fixtures.carrierContractName,
    ]],
  );
  await pool.query(
    `DELETE FROM supplier_basis_prices
     WHERE supplier_id IN (SELECT id FROM suppliers WHERE name = ANY($1::text[]))
        OR basis_id IN (SELECT id FROM bases WHERE name = ANY($2::text[]))`,
    [
      [
        fixtures.supplierName,
        fixtures.mixedSupplierName,
        fixtures.foreignSupplierName,
      ],
      [
        fixtures.baseName,
        fixtures.wholesaleBaseName,
        fixtures.abroadBaseName,
      ],
    ],
  );
  await pool.query(
    `DELETE FROM warehouse_bases
     WHERE warehouse_id IN (SELECT id FROM warehouses WHERE name = ANY($1::text[]))`,
    [[
      fixtures.warehouseName,
      fixtures.operationalWarehouseName,
      fixtures.transferWarehouseName,
    ]],
  );
  await pool.query(
    `DELETE FROM supplier_bases
     WHERE supplier_id IN (SELECT id FROM suppliers WHERE name = ANY($1::text[]))`,
    [[
      fixtures.supplierName,
      fixtures.mixedSupplierName,
      fixtures.foreignSupplierName,
    ]],
  );
  await pool.query(
    `DELETE FROM customer_bases
     WHERE customer_id IN (SELECT id FROM customers WHERE name = ANY($1::text[]))`,
    [[fixtures.buyerName, fixtures.wholesaleBuyerName, fixtures.foreignBuyerName]],
  );
  await pool.query("DELETE FROM aircraft_refueling WHERE id = ANY($1::uuid[])", [
    refuelings.rows.map((row) => row.id),
  ]);
  await pool.query("DELETE FROM equipment_movement WHERE id = ANY($1::uuid[])", [
    equipmentMovementIds,
  ]);
  await pool.query("DELETE FROM equipment_recalculation_queue WHERE equipment_id IN (SELECT id FROM equipments WHERE name = $1)", [
    fixtures.equipmentName,
  ]);
  await pool.query("DELETE FROM equipment_transactions WHERE equipment_id IN (SELECT id FROM equipments WHERE name = $1)", [
    fixtures.equipmentName,
  ]);
  await pool.query("DELETE FROM warehouses WHERE name = ANY($1::text[])", [
    [fixtures.warehouseName, fixtures.operationalWarehouseName, fixtures.transferWarehouseName],
  ]);
  await pool.query("DELETE FROM equipments WHERE name = $1", [
    fixtures.equipmentName,
  ]);
  await pool.query(
    `DELETE FROM prices
     WHERE counterparty_id IN (SELECT id FROM suppliers WHERE name = ANY($1::text[]))
        OR counterparty_id IN (SELECT id FROM customers WHERE name = ANY($2::text[]))`,
    [
      [
        fixtures.supplierName,
        fixtures.mixedSupplierName,
        fixtures.foreignSupplierName,
      ],
      [fixtures.buyerName, fixtures.wholesaleBuyerName, fixtures.foreignBuyerName],
    ],
  );
  await pool.query(
    "DELETE FROM delivery_cost WHERE carrier_id IN (SELECT id FROM logistics_carriers WHERE name = $1)",
    [fixtures.carrierName],
  );
  await pool.query("DELETE FROM logistics_carriers WHERE name = $1", [
    fixtures.carrierName,
  ]);
  await pool.query("DELETE FROM nomenclature WHERE name = ANY($1::text[])", [
    Object.values(fixtures.nomenclatureNames),
  ]);
  await pool.query("DELETE FROM units_of_measure WHERE short_name = $1", [
    fixtures.nomenclatureUnitShortName,
  ]);
  await pool.query("DELETE FROM warehouse_bases WHERE warehouse_id IN (SELECT id FROM warehouses WHERE name = ANY($1::text[]))", [
    [fixtures.operationalWarehouseName, fixtures.transferWarehouseName],
  ]);
  await pool.query("DELETE FROM suppliers WHERE name = ANY($1::text[])", [[
    fixtures.supplierName,
    fixtures.mixedSupplierName,
    fixtures.foreignSupplierName,
  ]]);
  await pool.query("DELETE FROM customers WHERE name = ANY($1::text[])", [[
    fixtures.buyerName,
    fixtures.wholesaleBuyerName,
    fixtures.foreignBuyerName,
  ]]);
  await pool.query(
    "DELETE FROM bases WHERE name = ANY($1::text[])",
    [[fixtures.baseName, fixtures.wholesaleBaseName, fixtures.abroadBaseName]],
  );
}

async function waitForExpression(cdp, expression, label, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    try {
      lastValue = await cdp.evaluate(expression);
      if (lastValue) return lastValue;
    } catch {
      // React may replace the active document while a route is changing.
    }
    await delay(150);
  }
  throw new Error(`Timed out waiting for ${label}; last value: ${lastValue}`);
}

async function clickTestId(cdp, testId) {
  const clicked = await cdp.evaluate(`(() => {
    const element = document.querySelector(
      ${JSON.stringify(`[data-testid="${testId}"]`)},
    );
    if (!element) {
      return {
        clicked: false,
        path: window.location.pathname,
        heading: document.querySelector("main h1, h1")?.innerText?.trim() || "",
        mainText: document.querySelector("main")?.innerText?.trim()?.slice(0, 500) || "",
        openDialogs: Array.from(document.querySelectorAll('[role="dialog"][data-state="open"]'))
          .map((dialog) => dialog.innerText.trim().slice(0, 200)),
      };
    }
    element.click();
    return { clicked: true };
  })()`);
  assert.equal(
    clicked?.clicked,
    true,
    `Expected [data-testid="${testId}"] to be clickable; page state: ${JSON.stringify(clicked)}`,
  );
}

async function fillInput(cdp, selector, value) {
  const filled = await cdp.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  assert.equal(filled, true, `Expected input ${selector} to exist`);
}

async function selectComboboxOption(cdp, testId, label) {
  await cdp.evaluate(`(() => {
    document
      .querySelectorAll('[role="combobox"][aria-expanded="true"]')
      .forEach((trigger) => trigger.click());
  })()`);
  await waitForExpression(
    cdp,
    `Array.from(document.querySelectorAll('[role="combobox"]'))
      .every((trigger) => trigger.getAttribute("aria-expanded") !== "true")`,
    "all previous comboboxes to close",
  );
  await clickTestId(cdp, testId);
  const labelJson = JSON.stringify(label);
  await waitForExpression(
    cdp,
    `Array.from(document.querySelectorAll('[role="option"]'))
      .some((option) => {
        const rect = option.getBoundingClientRect();
        const style = getComputedStyle(option);
        return rect.width > 0 && rect.height > 0 &&
          style.visibility !== "hidden" && Number(style.opacity) > 0 &&
          option.innerText.includes(${labelJson});
      })`,
    `combobox option ${label}`,
  );
  const selected = await cdp.evaluate(`(() => {
    const option = Array.from(document.querySelectorAll('[role="option"]'))
      .find((item) => {
        const rect = item.getBoundingClientRect();
        const style = getComputedStyle(item);
        return rect.width > 0 && rect.height > 0 &&
          style.visibility !== "hidden" && Number(style.opacity) > 0 &&
          item.innerText.includes(${labelJson});
      });
    if (!option) return false;
    option.click();
    return true;
  })()`);
  assert.equal(selected, true, `Expected to select option "${label}"`);
  const expanded = await cdp.evaluate(
    `document.querySelector('[data-testid="${testId}"]')
      ?.getAttribute("aria-expanded") === "true"`,
  );
  if (expanded) await clickTestId(cdp, testId);
  await waitForExpression(
    cdp,
    `document.querySelector('[data-testid="${testId}"]')
      ?.innerText.includes(${labelJson})`,
    `combobox ${testId} to show ${label} after selection`,
  );
  await waitForExpression(
    cdp,
    `Array.from(document.querySelectorAll('[role="combobox"]'))
      .every((trigger) => trigger.getAttribute("aria-expanded") !== "true")`,
    `combobox ${testId} to close after selection`,
  );
}

async function clickButtonWithText(cdp, text) {
  const textJson = JSON.stringify(text);
  const clicked = await cdp.evaluate(`(() => {
    const button = Array.from(document.querySelectorAll("button"))
      .find((item) => item.innerText.trim() === ${textJson});
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Expected button "${text}"`);
}

async function navigateToRoute(cdp, route) {
  await cdp.evaluate(`(() => {
    window.history.pushState({}, "", ${JSON.stringify(route)});
    window.dispatchEvent(new PopStateEvent("popstate"));
  })()`);
  await waitFor(
    cdp,
    (state) => state.path === route && state.mainText.length > 20,
    `the ${route} page`,
  );
}

async function closeActiveDialog(cdp, label) {
  for (let index = 0; index < 2; index += 1) {
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
    });
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
    });
  }
  await waitForExpression(
    cdp,
    `!document.querySelector('[role="dialog"][data-state="open"]')`,
    `${label} dialog to close`,
  );
}

async function getVisibleComboboxOptions(cdp, testId) {
  await clickTestId(cdp, testId);
  await waitForExpression(
    cdp,
    `Array.from(document.querySelectorAll('[role="option"]'))
      .some((option) => {
        const rect = option.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })`,
    `visible options for ${testId}`,
  );
  return cdp.evaluate(`Array.from(document.querySelectorAll('[role="option"]'))
    .filter((option) => {
      const rect = option.getBoundingClientRect();
      const style = getComputedStyle(option);
      return rect.width > 0 && rect.height > 0 &&
        style.visibility !== "hidden" && Number(style.opacity) > 0;
    })
    .map((option) => option.innerText.trim())`);
}

async function verifyDefaultNomenclatureForm(cdp, {
  route,
  addButtonTestId,
  nomenclatureTestId = "select-nomenclature",
  productTypeTestId,
  productChanges = [],
}) {
  await navigateToRoute(cdp, route);
  await clickTestId(cdp, addButtonTestId);
  await waitForExpression(
    cdp,
    `!!document.querySelector('[data-testid="${nomenclatureTestId}"]')`,
    `the nomenclature field on ${route}`,
  );
  const assertSelected = (name, label) =>
    waitForExpression(
      cdp,
      `document.querySelector('[data-testid="${nomenclatureTestId}"]')
        ?.innerText.includes(${JSON.stringify(name)})`,
      label,
    );

  await assertSelected(
    fixtures.nomenclatureNames.kerosene,
    `the default kerosene nomenclature on ${route}`,
  );
  for (const { productLabel, nomenclatureKey } of productChanges) {
    await selectComboboxOption(cdp, productTypeTestId, productLabel);
    await assertSelected(
      fixtures.nomenclatureNames[nomenclatureKey],
      `the ${nomenclatureKey} nomenclature on ${route}`,
    );
  }
  await closeActiveDialog(cdp, route);
}

async function clickMenuItemWithText(cdp, text) {
  const textJson = JSON.stringify(text);
  const clicked = await cdp.evaluate(`(() => {
    const item = Array.from(document.querySelectorAll('[role="menuitem"]'))
      .find((element) => element.innerText.trim() === ${textJson});
    if (!item) return false;
    item.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Expected menu item "${text}"`);
}

async function openEditMenuForRow(cdp, rowText) {
  const rowTextJson = JSON.stringify(rowText);
  await waitForExpression(
    cdp,
    `Array.from(document.querySelectorAll("tbody tr"))
      .some((row) => row.innerText.includes(${rowTextJson}))`,
    `table row containing ${rowText}`,
  );
  const opened = await cdp.evaluate(`(() => {
    const row = Array.from(document.querySelectorAll("tbody tr"))
      .find((item) => item.innerText.includes(${rowTextJson}));
    const button = row?.querySelector("td:last-child button");
    if (!button) return false;
    button.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        pointerType: "mouse",
        isPrimary: true,
      }),
    );
    button.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        pointerType: "mouse",
        isPrimary: true,
      }),
    );
    button.click();
    return true;
  })()`);
  assert.equal(opened, true, `Expected an action menu in row "${rowText}"`);
  await waitForExpression(
    cdp,
    `Array.from(document.querySelectorAll('[role="menuitem"]'))
      .some((item) => item.innerText.trim() === "Редактировать")`,
    "the edit action",
  );
  await clickMenuItemWithText(cdp, "Редактировать");
}

async function waitForDatabaseRow(
  query,
  params,
  label,
  predicate = () => true,
  timeoutMs = 12_000,
) {
  const deadline = Date.now() + timeoutMs;
  let row;
  while (Date.now() < deadline) {
    const result = await pool.query(query, params);
    row = result.rows[0];
    if (row && predicate(row)) return row;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}; last row: ${JSON.stringify(row)}`);
}

async function waitForAuditOperations(entityId, expectedOperations) {
  const deadline = Date.now() + 12_000;
  let operations = [];
  while (Date.now() < deadline) {
    const result = await pool.query(
      "SELECT operation FROM audit_log WHERE entity_id = $1",
      [entityId],
    );
    operations = result.rows.map((row) => row.operation);
    if (expectedOperations.every((operation) => operations.includes(operation))) {
      return;
    }
    await delay(100);
  }
  assert.fail(
    `Audit for ${entityId} did not contain ${expectedOperations.join(", ")}; ` +
      `found ${operations.join(", ")}`,
  );
}

async function waitForRecalculation(
  table,
  ownerColumn,
  ownerId,
  { requireTask = true } = {},
) {
  assert.ok(
    (table === "recalculation_queue" && ownerColumn === "warehouse_id") ||
      (table === "equipment_recalculation_queue" &&
        ownerColumn === "equipment_id"),
    "unsupported recalculation queue",
  );
  const deadline = Date.now() + 45_000;
  let statuses = [];
  while (Date.now() < deadline) {
    const result = await pool.query(
      `SELECT status FROM ${table}
       WHERE ${ownerColumn} = $1 AND product_type = 'kerosene'
       ORDER BY created_at, id`,
      [ownerId],
    );
    statuses = result.rows.map((row) => row.status);
    if (statuses.length === 0 && !requireTask) return;
    if (statuses.includes("failed")) {
      assert.fail(`${table} recalculation failed for ${ownerId}`);
    }
    if (statuses.length > 0 && statuses.every((status) => status === "completed")) {
      return;
    }
    await delay(250);
  }
  assert.fail(
    `Timed out waiting for ${table} recalculation; last statuses: ${JSON.stringify(statuses)}`,
  );
}

async function stopBrowser() {
  const child = browser;
  if (!child) return;
  browser = undefined;

  if (child.exitCode === null && child.signalCode === null) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }

    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      delay(5_000),
    ]);

    if (child.exitCode === null && child.signalCode === null) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        delay(2_000),
      ]);
    }
  }
  await delay(250);
}

async function removeProfile() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await rm(profileDir, { recursive: true, force: true });
      profileDir = undefined;
      return;
    } catch (error) {
      if (!["ENOTEMPTY", "EBUSY", "EPERM"].includes(error.code) || attempt === 5) {
        throw error;
      }
      await delay(250);
    }
  }
}

async function findChromium() {
  const names = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"];
  const candidates = [
    process.env.CHROMIUM_PATH,
    "/repl/tools/bin/chromium",
    ...process.env.PATH.split(path.delimiter).flatMap((directory) =>
      names.map((name) => path.join(directory, name)),
    ),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next standard browser path.
    }
  }
  throw new Error("Chromium is required for the UI smoke test; set CHROMIUM_PATH.");
}

async function waitForPageTarget(port, child, getBrowserLogs) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Chromium exited early: ${getBrowserLogs()}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find(
          (target) => target.type === "page" && target.url === "about:blank",
        );
        if (page) return page;
      }
    } catch {
      // The remote debugging endpoint is still starting.
    }
    await delay(100);
  }
  throw new Error(`Chromium did not expose an about:blank page target: ${getBrowserLogs()}`);
}

async function launchChromium() {
  const executable = await findChromium();
  profileDir = await mkdtemp(path.join(os.tmpdir(), "replit-ui-smoke-"));
  let logs = "";
  browser = spawn(
    executable,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"], detached: true },
  );
  browser.stderr.setEncoding("utf8");
  browser.stderr.on("data", (chunk) => {
    logs = (logs + chunk).slice(-4_000);
  });

  const activePortFile = path.join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 15_000;
  let port;
  while (Date.now() < deadline) {
    if (browser.exitCode !== null) {
      throw new Error(`Chromium exited before startup: ${logs}`);
    }
    try {
      port = Number((await readFile(activePortFile, "utf8")).split(/\r?\n/)[0]);
      if (Number.isInteger(port) && port > 0) break;
    } catch {
      // The browser has not written its debugging port yet.
    }
    await delay(100);
  }
  assert.ok(port, `Timed out waiting for Chromium DevToolsActivePort: ${logs}`);

  return {
    target: await waitForPageTarget(port, browser, () => logs),
    logs: () => logs,
  };
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const subscribers = new Set();
  let nextId = 0;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out connecting to Chromium DevTools.")), 10_000);
    socket.once("open", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) {
        request.reject(new Error(message.error.message));
      } else {
        request.resolve(message.result);
      }
      return;
    }
    if (message.method) {
      for (const subscriber of subscribers) subscriber(message.method, message.params);
    }
  });

  return {
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timed out waiting for Chromium command ${method}.`));
        }, 15_000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    onEvent(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    async evaluate(expression) {
      const response = await this.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (response.exceptionDetails) {
        throw new Error(
          response.exceptionDetails.exception?.description ||
            response.exceptionDetails.text,
        );
      }
      return response.result?.value;
    },
    close() {
      socket.close();
    },
  };
}

async function waitFor(cdp, predicate, label, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    try {
      lastValue = await cdp.evaluate(`(() => {
        const main = document.querySelector("main");
        return {
          path: window.location.pathname,
          readyState: document.readyState,
          title: document.title,
          heading: document.querySelector("main h1, h1")?.innerText?.trim() || "",
          mainText: main?.innerText?.trim() || "",
          bodyText: document.body?.innerText?.trim()?.slice(0, 160) || "",
          rootLength: document.querySelector("#root")?.innerHTML?.length || 0,
          authForm: !!document.querySelector('[data-testid="button-login"]'),
        };
      })()`);
      if (predicate(lastValue)) return lastValue;
    } catch {
      // Navigation can briefly destroy the previous execution context.
    }
    await delay(200);
  }
  throw new Error(
    `Timed out waiting for ${label}; last page state: ${JSON.stringify(lastValue)}`,
  );
}

test("authenticated browser can load the core business pages", async () => {
  assert.ok(baseUrl, "E2E_BASE_URL is required");
  assert.ok(process.env.E2E_ADMIN_EMAIL, "E2E_ADMIN_EMAIL is required");
  assert.ok(process.env.E2E_ADMIN_PASSWORD, "E2E_ADMIN_PASSWORD is required");

  await seedUiFixtures();
  const { target, logs } = await launchChromium();
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  const failures = [];
  const diagnostics = [];
  const stopListening = cdp.onEvent((method, params) => {
    if (
      method === "Network.requestWillBeSent" &&
      params.request?.url.includes("/api/prices/find-active")
    ) {
      diagnostics.push(`Price lookup request: ${params.request.url}`);
    }
    if (
      method === "Network.responseReceived" &&
      params.response?.url.includes("/api/prices/find-active")
    ) {
      diagnostics.push(
        `Price lookup response: ${params.response.status} ${params.response.url}`,
      );
    }
    if (
      method === "Network.responseReceived" &&
      params.response?.url.includes("/api/warehouses/") &&
      params.response.url.includes("/balance")
    ) {
      diagnostics.push(
        `Warehouse balance response: ${params.response.status} ${params.response.url}`,
      );
    }
    if (
      method === "Network.requestWillBeSent" &&
      params.request?.method === "POST" &&
      params.request.url.endsWith("/api/movement") &&
      params.request.postData
    ) {
      diagnostics.push(`Movement POST payload: ${params.request.postData}`);
    }
    if (
      method === "Network.responseReceived" &&
      params.response?.url.includes("/api/movement")
    ) {
      diagnostics.push(
        `Movement API response: ${params.response.status} ${params.response.url}`,
      );
    }
    if (
      method === "Network.requestWillBeSent" &&
      params.request?.method === "POST" &&
      params.request.url.endsWith("/api/refueling") &&
      params.request.postData
    ) {
      try {
        const payload = JSON.parse(params.request.postData);
        const uuidFields = [
          "nomenclatureId",
          "supplierId",
          "buyerId",
          "basisId",
          "customerBasisId",
          "equipmentId",
          "warehouseId",
        ];
        diagnostics.push(
          `Refueling POST UUID candidates: ${JSON.stringify(
            Object.fromEntries(
              uuidFields.map((field) => [field, payload[field] ?? null]),
            ),
          )}`,
        );
      } catch {
        diagnostics.push("Refueling POST payload could not be parsed");
      }
    }
    if (
      method === "Network.responseReceived" &&
      params.response?.url.includes("/api/") &&
      [401, 403, 500].includes(params.response.status)
    ) {
      failures.push(
        `${params.response.status} ${params.response.url}`,
      );
    }
    if (method === "Runtime.exceptionThrown") {
      const description =
        params.exceptionDetails?.exception?.description ||
        params.exceptionDetails?.text ||
        "Uncaught browser exception";
      failures.push(description);
      diagnostics.push(description);
    }
    if (
      method === "Runtime.consoleAPICalled" &&
      params.type === "error"
    ) {
      diagnostics.push(
        params.args?.map((arg) => arg.value || arg.description).join(" ") ||
          "Browser console error",
      );
    }
    if (method === "Network.loadingFailed") {
      diagnostics.push(
        `Resource failed: ${params.errorText || "unknown error"}`,
      );
    }
  });

  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Page.navigate", { url: new URL("/auth", baseUrl).toString() });
    await waitFor(
      cdp,
      (state) => state.authForm,
      "the visible login form",
      45_000,
    );

    const fillResult = await cdp.evaluate(`(() => {
      const email = document.querySelector('[data-testid="input-email"]');
      const password = document.querySelector('[data-testid="input-password"]');
      const submit = document.querySelector('[data-testid="button-login"]');
      if (!email || !password || !submit) return "login controls missing";
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set;
      setValue.call(email, ${JSON.stringify(process.env.E2E_ADMIN_EMAIL)});
      email.dispatchEvent(new Event("input", { bubbles: true }));
      setValue.call(password, ${JSON.stringify(process.env.E2E_ADMIN_PASSWORD)});
      password.dispatchEvent(new Event("input", { bubbles: true }));
      submit.click();
      return "submitted";
    })()`);
    assert.equal(fillResult, "submitted");

    await waitFor(
      cdp,
      (state) =>
        state.path === "/" &&
        !state.authForm &&
        state.mainText.length > 0,
      "successful login and the authenticated app shell",
      20_000,
    );
    failures.length = 0;

    const pages = [
      "/dashboard",
      "/opt",
      "/exchange",
      "/exchange-advances",
      "/exchange-directories",
      "/movement",
      "/warehouses",
      "/prices",
      "/delivery",
      "/counterparties",
      "/directories",
      "/abroad",
      "/refueling",
      "/storage-cards",
      "/finance/cashflow",
      "/finance/payment-calendar",
      "/finance/price-calculation",
      "/reports/current",
      "/reports/analytics",
      "/reports/registries",
      "/planning",
      "/reports/gov-contracts",
      "/reports/budget",
      "/admin/users",
      "/admin/roles",
      "/admin/widgets",
      "/admin/settings",
      "/rent",
      "/transportation",
      "/lik/refueling",
      "/lik/movement",
      "/lik/equipment",
      "/lik",
      "/exchange-deals",
      "/reports/management",
      "/logistics-plan",
    ];

    for (const [index, route] of pages.entries()) {
      const failureStart = failures.length;
      if (index === 0) {
        await cdp.send("Page.navigate", {
          url: new URL(route, baseUrl).toString(),
        });
      } else {
        await cdp.evaluate(`(() => {
          window.history.pushState({}, "", ${JSON.stringify(route)});
          window.dispatchEvent(new PopStateEvent("popstate"));
          return window.location.pathname;
        })()`);
      }
      const state = await waitFor(
        cdp,
        (page) =>
          page.path === route &&
          page.mainText.length > 20 &&
          !page.authForm,
        `authenticated content at ${route}`,
      );
      await delay(500);

      assert.notEqual(
        state.heading,
        "Страница не найдена",
        `${route} must resolve to an existing page`,
      );
      assert.deepEqual(
        failures.slice(failureStart),
        [],
        `${route} must not trigger authorization/server errors`,
      );
      console.log(`UI smoke passed: ${route} — ${state.heading || "content rendered"}`);
    }

    await verifyDefaultNomenclatureForm(cdp, {
      route: "/opt",
      addButtonTestId: "button-add-opt",
      productTypeTestId: "select-product-type",
      productChanges: [
        { productLabel: "ПВКЖ", nomenclatureKey: "pvkj" },
        { productLabel: "Керосин", nomenclatureKey: "kerosene" },
      ],
    });
    await verifyDefaultNomenclatureForm(cdp, {
      route: "/transportation",
      addButtonTestId: "button-add-transportation",
      productTypeTestId: "select-transportation-product",
      productChanges: [
        { productLabel: "ПВКЖ", nomenclatureKey: "pvkj" },
        { productLabel: "Услуга", nomenclatureKey: "service" },
        { productLabel: "Керосин", nomenclatureKey: "kerosene" },
      ],
    });
    await verifyDefaultNomenclatureForm(cdp, {
      route: "/abroad",
      addButtonTestId: "button-add-refueling-abroad",
      productTypeTestId: "select-product-type",
      productChanges: [
        { productLabel: "ПВКЖ", nomenclatureKey: "pvkj" },
        { productLabel: "Услуга заправки", nomenclatureKey: "service" },
        { productLabel: "Керосин", nomenclatureKey: "kerosene" },
      ],
    });
    await verifyDefaultNomenclatureForm(cdp, {
      route: "/prices",
      addButtonTestId: "button-add-price",
      nomenclatureTestId: "select-price-nomenclature",
      productTypeTestId: "select-product-type",
      productChanges: [
        { productLabel: "ПВКЖ", nomenclatureKey: "pvkj" },
        { productLabel: "Услуга", nomenclatureKey: "service" },
        { productLabel: "Керосин", nomenclatureKey: "kerosene" },
      ],
    });
    await verifyDefaultNomenclatureForm(cdp, {
      route: "/lik/movement",
      addButtonTestId: "button-add-equipment-movement",
      productTypeTestId: "select-equipment-product",
      productChanges: [
        { productLabel: "ПВКЖ", nomenclatureKey: "pvkj" },
        { productLabel: "Керосин", nomenclatureKey: "kerosene" },
      ],
    });

    await navigateToRoute(cdp, "/opt");
    await clickTestId(cdp, "button-add-opt");
    await selectComboboxOption(cdp, "select-supplier", fixtures.mixedSupplierName);
    const wholesaleBases = await getVisibleComboboxOptions(cdp, "select-basis");
    assert(wholesaleBases.some((text) => text.includes(fixtures.wholesaleBaseName)));
    assert(!wholesaleBases.some((text) => text.includes(fixtures.baseName)));
    assert(!wholesaleBases.some((text) => text.includes(fixtures.abroadBaseName)));

    await navigateToRoute(cdp, "/refueling");
    await clickTestId(cdp, "button-add-refueling");
    await selectComboboxOption(cdp, "select-supplier", fixtures.mixedSupplierName);
    const refuelingBases = await getVisibleComboboxOptions(cdp, "select-basis");
    assert(refuelingBases.some((text) => text.includes(fixtures.baseName)));
    assert(!refuelingBases.some((text) => text.includes(fixtures.wholesaleBaseName)));
    assert(!refuelingBases.some((text) => text.includes(fixtures.abroadBaseName)));

    await navigateToRoute(cdp, "/abroad");
    await clickTestId(cdp, "button-add-refueling-abroad");
    const foreignSuppliers = await getVisibleComboboxOptions(cdp, "select-supplier");
    assert(foreignSuppliers.some((text) => text.includes(fixtures.foreignSupplierName)));
    assert(!foreignSuppliers.some((text) => text.includes(fixtures.mixedSupplierName)));
    assert(!foreignSuppliers.some((text) => text.includes(fixtures.supplierName)));
    await selectComboboxOption(cdp, "select-supplier", fixtures.foreignSupplierName);
    const abroadBases = await getVisibleComboboxOptions(cdp, "select-basis");
    assert(abroadBases.some((text) => text.includes(fixtures.abroadBaseName)));
    assert(!abroadBases.some((text) => text.includes(fixtures.baseName)));
    assert(!abroadBases.some((text) => text.includes(fixtures.wholesaleBaseName)));
    const foreignBuyers = await getVisibleComboboxOptions(cdp, "select-buyer");
    assert(foreignBuyers.some((text) => text.includes(fixtures.foreignBuyerName)));
    assert(!foreignBuyers.some((text) => text.includes(fixtures.wholesaleBuyerName)));
    assert(!foreignBuyers.some((text) => text.includes(fixtures.buyerName)));

    await navigateToRoute(cdp, "/opt");
    await clickTestId(cdp, "button-add-opt");
    await selectComboboxOption(cdp, "select-supplier", fixtures.mixedSupplierName);
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-basis"]')
        ?.innerText.includes(${JSON.stringify(fixtures.wholesaleBaseName)})`,
      "the wholesale basis selected for the mixed supplier",
    );
    await selectComboboxOption(cdp, "select-buyer", fixtures.wholesaleBuyerName);
    await selectComboboxOption(
      cdp,
      "select-buyer-basis",
      fixtures.wholesaleBaseName,
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-purchase-price"]')
        ?.innerText.includes("30")`,
      "the default wholesale purchase price",
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-sale-price"]')
        ?.innerText.includes("35")`,
      "the default wholesale sale price",
    );

    await navigateToRoute(cdp, "/prices");
    await clickTestId(cdp, "button-add-price");
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-counterparty-type"]')
        ?.innerText.includes("ОПТ") &&
       document.querySelector('[data-testid="select-counterparty-role"]')
        ?.innerText.includes("Поставщик")`,
      "the default wholesale supplier price form",
    );
    const priceCounterparties = await getVisibleComboboxOptions(
      cdp,
      "select-counterparty",
    );
    assert(
      priceCounterparties.some((text) => text.includes(fixtures.supplierName)),
      `The supplier should be selectable for a wholesale price; options: ${JSON.stringify(priceCounterparties)}`,
    );
    await selectComboboxOption(cdp, "select-counterparty", fixtures.supplierName);
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-price-contract"]')
        ?.innerText.includes(${JSON.stringify(fixtures.supplierContractNumber)})`,
      "the contract automatically selected for the chosen supplier",
    );

    await cdp.evaluate(`(() => {
      window.history.pushState({}, "", "/refueling");
      window.dispatchEvent(new PopStateEvent("popstate"));
    })()`);
    await waitFor(
      cdp,
      (state) => state.path === "/refueling" && state.mainText.length > 20,
      "the refueling page before form interaction",
    );
    await clickTestId(cdp, "button-add-refueling");
    await waitForExpression(
      cdp,
      `!!document.querySelector('[data-testid="select-supplier"]') &&
       !!document.querySelector('[data-testid="select-buyer"]')`,
      "the new refueling form",
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-nomenclature"]')
        ?.innerText.includes(${JSON.stringify(fixtures.nomenclatureNames.kerosene)})`,
      "the default kerosene nomenclature in a new refueling",
    );
    await selectComboboxOption(cdp, "select-product-type", "ПВКЖ");
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-nomenclature"]')
        ?.innerText.includes(${JSON.stringify(fixtures.nomenclatureNames.pvkj)})`,
      "the default PVKJ nomenclature after changing product type",
    );
    await selectComboboxOption(cdp, "select-product-type", "Услуга");
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-nomenclature"]')
        ?.innerText.includes(${JSON.stringify(fixtures.nomenclatureNames.service)})`,
      "the default service nomenclature after changing product type",
    );
    await selectComboboxOption(cdp, "select-product-type", "Керосин");
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-nomenclature"]')
        ?.innerText.includes(${JSON.stringify(fixtures.nomenclatureNames.kerosene)})`,
      "the default kerosene nomenclature after restoring product type",
    );
    await selectComboboxOption(cdp, "select-supplier", fixtures.supplierName);
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-basis"]')
        ?.innerText.includes(${JSON.stringify(fixtures.baseName)})`,
      "automatic refueling basis selection",
    );
    await selectComboboxOption(cdp, "select-buyer", fixtures.buyerName);
    await clickTestId(cdp, "switch-input-mode");
    await waitForExpression(
      cdp,
      `!!document.querySelector('[data-testid="input-quantity-tonnes"]')`,
      "the refueling tonne input",
    );
    await fillInput(
      cdp,
      '[data-testid="input-quantity-tonnes"]',
      "0.12345",
    );
    await fillInput(
      cdp,
      '[data-testid="input-notes"]',
      fixtures.refuelingNote,
    );
    await clickButtonWithText(cdp, "Сохранить черновик");
    const createdRefueling = await waitForDatabaseRow(
      `SELECT id, quantity_tonnes, input_mode, is_draft, nomenclature_id
       FROM aircraft_refueling WHERE notes = $1`,
      [fixtures.refuelingNote],
      "the refueling draft created through the UI",
    );
    assert.equal(createdRefueling.input_mode, "tonnes");
    assert.equal(Number(createdRefueling.quantity_tonnes), 0.12345);
    assert.equal(createdRefueling.is_draft, true);
    assert.equal(createdRefueling.nomenclature_id, nomenclatureIds.kerosene);
    await waitForAuditOperations(createdRefueling.id, ["CREATE"]);
    await waitForExpression(
      cdp,
      `!document.querySelector('[role="dialog"][data-state="open"]')`,
      "the refueling form to close after saving",
    );

    await fillInput(
      cdp,
      '[data-testid="input-search-refueling"]',
      fixtures.supplierName,
    );
    await openEditMenuForRow(cdp, fixtures.supplierName);
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="input-quantity-tonnes"]')
        ?.value === "0.12345"`,
      "the saved tonne value in the refueling edit form",
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-nomenclature"]')
        ?.innerText.includes(${JSON.stringify(fixtures.nomenclatureNames.kerosene)})`,
      "the saved refueling nomenclature in the edit form",
    );
    await fillInput(
      cdp,
      '[data-testid="input-quantity-tonnes"]',
      "0.23456",
    );
    await fillInput(
      cdp,
      '[data-testid="input-notes"]',
      fixtures.refuelingNote,
    );
    await clickButtonWithText(cdp, "Сохранить черновик");
    const editedRefueling = await waitForDatabaseRow(
      `SELECT id, quantity_tonnes, input_mode, is_draft, nomenclature_id
       FROM aircraft_refueling WHERE notes = $1`,
      [fixtures.refuelingNote],
      "the refueling draft updated through the UI",
      (row) => Number(row.quantity_tonnes) === 0.23456,
    );
    assert.equal(editedRefueling.id, createdRefueling.id);
    assert.equal(editedRefueling.input_mode, "tonnes");
    assert.equal(editedRefueling.is_draft, true);
    assert.equal(editedRefueling.nomenclature_id, nomenclatureIds.kerosene);
    await waitForAuditOperations(editedRefueling.id, ["CREATE", "UPDATE"]);
    await waitForExpression(
      cdp,
      `!document.querySelector('[role="dialog"][data-state="open"]')`,
      "the refueling edit form to close after saving",
    );
    console.log("UI flow passed: refueling draft created and edited in tonnes");

    await cdp.evaluate(`(() => {
      window.history.pushState({}, "", "/movement");
      window.dispatchEvent(new PopStateEvent("popstate"));
    })()`);
    await waitFor(
      cdp,
      (state) => state.path === "/movement" && state.mainText.length > 20,
      "the movement page before form interaction",
    );
    await clickTestId(cdp, "button-add-movement");
    await waitForExpression(
      cdp,
      `!!document.querySelector('[data-testid="input-quantity-tonnes"]') &&
       !!document.querySelector('[data-testid="select-movement-to"]')`,
      "the new movement form",
    );
    const movementMode = await cdp.evaluate(
      `document.querySelector('[data-testid="switch-input-mode"]')
        ?.getAttribute("aria-checked")`,
    );
    assert.equal(movementMode, "true", "movement forms start in tonne mode");
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-nomenclature"]')
        ?.innerText.includes(${JSON.stringify(fixtures.nomenclatureNames.kerosene)})`,
      "the default kerosene nomenclature in a new movement",
    );
    await selectComboboxOption(cdp, "select-movement-product", "ПВКЖ");
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-nomenclature"]')
        ?.innerText.includes(${JSON.stringify(fixtures.nomenclatureNames.pvkj)})`,
      "the default PVKJ nomenclature after changing movement product",
    );
    await selectComboboxOption(cdp, "select-movement-product", "Керосин");
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-nomenclature"]')
        ?.innerText.includes(${JSON.stringify(fixtures.nomenclatureNames.kerosene)})`,
      "the default kerosene nomenclature after restoring movement product",
    );
    await selectComboboxOption(
      cdp,
      "select-movement-to",
      fixtures.warehouseName,
    );
    await fillInput(
      cdp,
      '[data-testid="input-quantity-tonnes"]',
      "0.12345",
    );
    await fillInput(
      cdp,
      '[data-testid="input-movement-notes"]',
      fixtures.movementNote,
    );
    await clickTestId(cdp, "button-save-draft");
    const createdMovement = await waitForDatabaseRow(
      `SELECT id, quantity_tonnes, input_mode, is_draft, to_warehouse_id,
              nomenclature_id
       FROM movement WHERE notes = $1`,
      [fixtures.movementNote],
      "the movement draft created through the UI",
    );
    assert.equal(Number(createdMovement.quantity_tonnes), 0.12345);
    assert.equal(createdMovement.input_mode, "tonnes");
    assert.equal(createdMovement.is_draft, true);
    assert.equal(createdMovement.nomenclature_id, nomenclatureIds.kerosene);
    await waitForAuditOperations(createdMovement.id, ["CREATE"]);
    await waitForExpression(
      cdp,
      `!document.querySelector('[role="dialog"][data-state="open"]')`,
      "the movement form to close after saving",
    );

    await fillInput(
      cdp,
      'input[placeholder="Поиск..."]',
      fixtures.warehouseName,
    );
    await openEditMenuForRow(cdp, fixtures.warehouseName);
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="input-quantity-tonnes"]')
        ?.value === "0.12345"`,
      "the saved tonne value in the movement edit form",
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-nomenclature"]')
        ?.innerText.includes(${JSON.stringify(fixtures.nomenclatureNames.kerosene)})`,
      "the saved movement nomenclature in the edit form",
    );
    await fillInput(
      cdp,
      '[data-testid="input-quantity-tonnes"]',
      "0.23456",
    );
    await fillInput(
      cdp,
      '[data-testid="input-movement-notes"]',
      fixtures.movementNote,
    );
    await clickTestId(cdp, "button-save-draft");
    const editedMovement = await waitForDatabaseRow(
      `SELECT id, quantity_tonnes, input_mode, is_draft, to_warehouse_id,
              nomenclature_id
       FROM movement WHERE notes = $1`,
      [fixtures.movementNote],
      "the movement draft updated through the UI",
      (row) => Number(row.quantity_tonnes) === 0.23456,
    );
    assert.equal(editedMovement.id, createdMovement.id);
    assert.equal(editedMovement.input_mode, "tonnes");
    assert.equal(editedMovement.is_draft, true);
    assert.equal(editedMovement.nomenclature_id, nomenclatureIds.kerosene);
    await waitForAuditOperations(editedMovement.id, ["CREATE", "UPDATE"]);
    const warehouseBalance = await pool.query(
      `SELECT current_balance_tonnes
       FROM warehouses WHERE name = $1`,
      [fixtures.warehouseName],
    );
    assert.equal(Number(warehouseBalance.rows[0]?.current_balance_tonnes), 0);
    await waitForExpression(
      cdp,
      `!document.querySelector('[role="dialog"][data-state="open"]')`,
      "the movement edit form to close after saving",
    );
    console.log("UI flow passed: movement draft created and edited in tonnes");

    await cdp.evaluate(`(() => {
      window.__uiOperationEvents = [];
      const observer = new EventSource(
        "/api/warehouses/sse/events?clientId=ui-operations-${runId}",
      );
      for (const name of [
        "warehouse_recalculated",
        "equipment_recalculated",
        "entity_changed",
      ]) {
        observer.addEventListener(name, (event) => {
          window.__uiOperationEvents.push({
            name,
            data: JSON.parse(event.data),
          });
        });
      }
      observer.addEventListener("message", (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "connected") {
          window.__uiOperationSseConnected = true;
        }
      });
      window.__uiOperationSse = observer;
      return true;
    })()`);
    await waitForExpression(
      cdp,
      "window.__uiOperationSseConnected === true",
      "the UI operations SSE observer",
    );

    const operationalWarehouse = await pool.query(
      "SELECT id FROM warehouses WHERE name = $1",
      [fixtures.operationalWarehouseName],
    );
    const operationalWarehouseId = operationalWarehouse.rows[0].id;
    const openMovementForm = async () => {
      await waitForExpression(
        cdp,
        `window.location.pathname === "/movement" &&
         !!document.querySelector('[data-testid="button-add-movement"]')`,
        "the movement page add button before creating a final operation",
      );
      await clickTestId(cdp, "button-add-movement");
      await waitForExpression(
        cdp,
        `!!document.querySelector('[data-testid="input-quantity-tonnes"]') &&
         !!document.querySelector('[data-testid="select-movement-to"]')`,
        "a new movement form for final operations",
      );
    };
    const createReceipt = async ({ date, quantity, note }) => {
      await openMovementForm();
      await fillInput(cdp, '[data-testid="input-movement-date"]', date);
      await selectComboboxOption(
        cdp,
        "select-movement-supplier",
        fixtures.supplierName,
      );
      await selectComboboxOption(
        cdp,
        "select-movement-basis",
        fixtures.baseName,
      );
      await selectComboboxOption(
        cdp,
        "select-movement-to",
        fixtures.operationalWarehouseName,
      );
      try {
        await waitForExpression(
          cdp,
          `document.querySelector('[role="dialog"]')
            ?.innerText.includes("₽/т")`,
          `an active purchase price for ${date}`,
          20_000,
        );
      } catch (error) {
        diagnostics.push(
          `Price selection dialog: ${JSON.stringify(
            await cdp.evaluate(`(() => ({
              supplier: document.querySelector('[data-testid="select-movement-supplier"]')?.innerText,
              basis: document.querySelector('[data-testid="select-movement-basis"]')?.innerText,
              destination: document.querySelector('[data-testid="select-movement-to"]')?.innerText,
              date: document.querySelector('[data-testid="input-movement-date"]')?.value,
              price: document.querySelector('[data-testid="select-purchase-price"]')?.innerText,
              recentLookups: performance.getEntriesByType("resource")
                .map((item) => item.name)
                .filter((name) => name.includes("/api/prices/find-active"))
                .slice(-5),
              dialog: document.querySelector('[role="dialog"]')?.innerText?.slice(-1200),
            }))()`),
          )}`,
        );
        throw error;
      }
      await fillInput(
        cdp,
        '[data-testid="input-quantity-tonnes"]',
        quantity,
      );
      await fillInput(
        cdp,
        '[data-testid="input-movement-notes"]',
        note,
      );
      await clickTestId(cdp, "button-create-movement");
      let receipt;
      try {
        receipt = await waitForDatabaseRow(
          `SELECT id, quantity_tonnes, input_mode, is_draft,
                  movement_date, purchase_price_per_tonne, total_cost
           FROM movement WHERE notes = $1`,
          [note],
          `final receipt ${note} created in the UI`,
        );
      } catch (error) {
        diagnostics.push(
          `Receipt dialog after submit: ${await cdp.evaluate(
            "document.body?.innerText?.trim()?.slice(-1800) || ''",
          )}`,
        );
        throw error;
      }
      assert.equal(receipt.is_draft, false);
      assert.equal(receipt.input_mode, "tonnes");
      return receipt;
    };

    const firstReceipt = await createReceipt({
      date: "01.10.2026",
      quantity: "1",
      note: fixtures.receiptNote,
    });
    assert.equal(Number(firstReceipt.quantity_tonnes), 1);
    assert.equal(Number(firstReceipt.purchase_price_per_tonne), 10_000);
    assert.equal(Number(firstReceipt.total_cost), 10_000);
    await waitForDatabaseRow(
      `SELECT current_balance_tonnes, average_cost_per_tonne
       FROM warehouses WHERE id = $1`,
      [operationalWarehouseId],
      "the first receipt's warehouse stock and cost",
      (row) =>
        Number(row.current_balance_tonnes) === 1 &&
        Number(row.average_cost_per_tonne) === 10_000,
      45_000,
    );

    const secondReceipt = await createReceipt({
      date: "10.10.2026",
      quantity: "1",
      note: fixtures.secondReceiptNote,
    });
    assert.equal(Number(secondReceipt.quantity_tonnes), 1);
    assert.equal(Number(secondReceipt.purchase_price_per_tonne), 20_000);
    assert.equal(Number(secondReceipt.total_cost), 20_000);
    await waitForDatabaseRow(
      `SELECT current_balance_tonnes, average_cost_per_tonne
       FROM warehouses WHERE id = $1`,
      [operationalWarehouseId],
      "the weighted-average stock cost after the second receipt",
      (row) =>
        Number(row.current_balance_tonnes) === 2 &&
        Number(row.average_cost_per_tonne) === 15_000,
      45_000,
    );

    await openMovementForm();
    await selectComboboxOption(
      cdp,
      "select-movement-type",
      "Внутреннее перемещение",
    );
    await selectComboboxOption(
      cdp,
      "select-movement-from",
      fixtures.operationalWarehouseName,
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-movement-from"]')
        ?.innerText.includes(${JSON.stringify(fixtures.operationalWarehouseName)})`,
      "the selected source warehouse",
    );
    await selectComboboxOption(
      cdp,
      "select-movement-to",
      fixtures.transferWarehouseName,
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-movement-to"]')
        ?.innerText.includes(${JSON.stringify(fixtures.transferWarehouseName)})`,
      "the selected destination warehouse",
    );
    await selectComboboxOption(
      cdp,
      "select-movement-carrier",
      fixtures.carrierName,
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-movement-carrier"]')
        ?.innerText.includes(${JSON.stringify(fixtures.carrierName)})`,
      "the selected internal-transfer carrier",
    );
    await fillInput(cdp, '[data-testid="input-movement-date"]', "20.10.2026");
    await fillInput(cdp, '[data-testid="input-quantity-tonnes"]', "1.5");
    await fillInput(
      cdp,
      '[data-testid="input-movement-notes"]',
      fixtures.warehouseTransferNote,
    );
    try {
      await waitForExpression(
        cdp,
        `!document.querySelector('[data-testid="button-create-movement"]')?.disabled`,
        "the final warehouse transfer to pass balance validation",
      );
    } catch (error) {
      diagnostics.push(
        `Warehouse transfer form: ${JSON.stringify(
          await cdp.evaluate(`(() => ({
            buttonDisabled: document.querySelector('[data-testid="button-create-movement"]')?.disabled,
            source: document.querySelector('[data-testid="select-movement-from"]')?.innerText,
            destination: document.querySelector('[data-testid="select-movement-to"]')?.innerText,
            date: document.querySelector('[data-testid="input-movement-date"]')?.value,
            quantity: document.querySelector('[data-testid="input-quantity-tonnes"]')?.value,
            dialog: document.querySelector('[role="dialog"]')?.innerText?.slice(-1200),
            recentBalances: performance.getEntriesByType("resource")
              .map((item) => item.name)
              .filter((name) => name.includes("/balance"))
              .slice(-5),
          }))()`),
        )}`,
      );
      throw error;
    }
    await clickTestId(cdp, "button-create-movement");
    const warehouseTransfer = await waitForDatabaseRow(
      `SELECT id, quantity_tonnes, input_mode, is_draft, total_cost
       FROM movement WHERE notes = $1`,
      [fixtures.warehouseTransferNote],
      "the final warehouse transfer created through the UI",
    );
    assert.equal(warehouseTransfer.is_draft, false);
    assert.equal(Number(warehouseTransfer.quantity_tonnes), 1.5);
    assert.equal(warehouseTransfer.input_mode, "tonnes");
    await waitForAuditOperations(warehouseTransfer.id, ["CREATE"]);
    await waitForDatabaseRow(
      `SELECT current_balance_tonnes, average_cost_per_tonne
       FROM warehouses WHERE id = $1`,
      [operationalWarehouseId],
      "the source warehouse balance after the UI transfer",
      (row) =>
        Number(row.current_balance_tonnes) === 0.5 &&
        Number(row.average_cost_per_tonne) === 15_000,
      45_000,
    );
    const transferWarehouse = await pool.query(
      "SELECT id FROM warehouses WHERE name = $1",
      [fixtures.transferWarehouseName],
    );
    const transferWarehouseId = transferWarehouse.rows[0].id;
    await waitForDatabaseRow(
      `SELECT current_balance_tonnes, average_cost_per_tonne
       FROM warehouses WHERE id = $1`,
      [transferWarehouseId],
      "the destination warehouse balance after the UI transfer",
      (row) =>
        Number(row.current_balance_tonnes) === 1.5 &&
        Number(row.average_cost_per_tonne) === 15_000,
      45_000,
    );

    await cdp.evaluate(`(() => {
      window.history.pushState({}, "", "/lik/movement");
      window.dispatchEvent(new PopStateEvent("popstate"));
    })()`);
    await waitFor(
      cdp,
      (state) => state.path === "/lik/movement" && state.mainText.length > 20,
      "the equipment movement page",
    );
    await clickTestId(cdp, "button-add-equipment-movement");
    await waitForExpression(
      cdp,
      `!!document.querySelector('[data-testid="input-quantity-tonnes"]') &&
       !!document.querySelector('[data-testid="button-create-equipment-movement"]')`,
      "the new equipment movement form",
    );
    await fillInput(
      cdp,
      '[data-testid="input-equipment-movement-date"]',
      "24.10.2026",
    );
    await selectComboboxOption(
      cdp,
      "select-equipment-movement-from-warehouse",
      fixtures.transferWarehouseName,
    );
    await selectComboboxOption(
      cdp,
      "select-equipment-movement-to-equipment",
      fixtures.equipmentName,
    );
    await fillInput(cdp, '[data-testid="input-quantity-tonnes"]', "1.5");
    await fillInput(
      cdp,
      'input[placeholder="Дополнительная информация..."]',
      fixtures.equipmentTransferNote,
    );
    await waitForExpression(
      cdp,
      `!document.querySelector('[data-testid="button-create-equipment-movement"]')?.disabled`,
      "the equipment transfer to pass stock validation",
    );
    await clickTestId(cdp, "button-create-equipment-movement");
    const equipmentTransfer = await waitForDatabaseRow(
      `SELECT id, quantity_tonnes, input_mode, is_draft, total_cost,
              cost_per_tonne, movement_date, nomenclature_id
       FROM equipment_movement WHERE notes = $1`,
      [fixtures.equipmentTransferNote],
      "the final warehouse-to-equipment transfer created in the UI",
    );
    assert.equal(equipmentTransfer.is_draft, false);
    assert.equal(Number(equipmentTransfer.quantity_tonnes), 1.5);
    assert.equal(equipmentTransfer.input_mode, "tonnes");
    assert.equal(equipmentTransfer.nomenclature_id, nomenclatureIds.kerosene);
    assert.equal(
      new Date(equipmentTransfer.movement_date).toISOString().slice(0, 10),
      "2026-10-24",
    );
    await waitForAuditOperations(equipmentTransfer.id, ["CREATE"]);
    const equipmentRow = await pool.query(
      "SELECT id FROM equipments WHERE name = $1",
      [fixtures.equipmentName],
    );
    const equipmentId = equipmentRow.rows[0].id;
    await waitForDatabaseRow(
      `SELECT current_balance_tonnes, average_cost_per_tonne
       FROM equipments WHERE id = $1`,
      [equipmentId],
      "the transferred equipment balance and average cost",
      (row) =>
        Number(row.current_balance_tonnes) === 1.5 &&
        Number(row.average_cost_per_tonne) === 15_000,
      45_000,
    );
    await waitForDatabaseRow(
      `SELECT current_balance_tonnes
       FROM warehouses WHERE id = $1`,
      [transferWarehouseId],
      "the empty source warehouse after the equipment transfer",
      (row) => Number(row.current_balance_tonnes) === 0,
      45_000,
    );

    await cdp.evaluate(`(() => {
      window.history.pushState({}, "", "/lik/refueling");
      window.dispatchEvent(new PopStateEvent("popstate"));
    })()`);
    await waitFor(
      cdp,
      (state) => state.path === "/lik/refueling" && state.mainText.length > 20,
      "the fuel-equipment refueling page",
    );
    await clickTestId(cdp, "button-add-refueling");
    await waitForExpression(
      cdp,
      `!!document.querySelector('[data-testid="select-supplier"]') &&
       !!document.querySelector('[data-testid="select-buyer"]') &&
       !!document.querySelector('[data-testid="select-equipment-tzk"]')`,
      "the new refueling deal form linked to equipment",
    );
    await selectComboboxOption(
      cdp,
      "select-supplier",
      fixtures.supplierName,
    );
    await selectComboboxOption(cdp, "select-buyer", fixtures.buyerName);
    await selectComboboxOption(
      cdp,
      "select-equipment-tzk",
      fixtures.equipmentName,
    );
    await clickTestId(cdp, "switch-input-mode");
    await waitForExpression(
      cdp,
      `!!document.querySelector('[data-testid="input-quantity-tonnes"]')`,
      "the final refueling tonne input",
    );
    await fillInput(
      cdp,
      '[data-testid="input-refueling-date"]',
      "30.10.2026",
    );
    await fillInput(cdp, '[data-testid="input-quantity-tonnes"]', "0.20001");
    await fillInput(
      cdp,
      '[data-testid="input-notes"]',
      fixtures.finalRefuelingNote,
    );
    await clickTestId(cdp, "button-submit-refueling");
    const finalDeal = await waitForDatabaseRow(
      `SELECT id, quantity_tonnes, input_mode, is_draft, equipment_id,
              refueling_date, purchase_price_per_tonne, purchase_amount,
              sale_amount, profit, nomenclature_id
       FROM aircraft_refueling WHERE notes = $1`,
      [fixtures.finalRefuelingNote],
      "the final equipment-linked refueling deal created in the UI",
    );
    assert.equal(finalDeal.is_draft, false);
    assert.equal(finalDeal.input_mode, "tonnes");
    assert.equal(Number(finalDeal.quantity_tonnes), 0.20001);
    assert.equal(finalDeal.nomenclature_id, nomenclatureIds.kerosene);
    assert.equal(finalDeal.equipment_id, equipmentId);
    assert.equal(
      new Date(finalDeal.refueling_date).toISOString().slice(0, 10),
      "2026-10-30",
    );
    await waitForAuditOperations(finalDeal.id, ["CREATE"]);
    await waitForDatabaseRow(
      `SELECT current_balance_tonnes, average_cost_per_tonne
       FROM equipments WHERE id = $1`,
      [equipmentId],
      "the equipment balance after the linked sale",
      (row) =>
        Number(row.current_balance_tonnes) === 1.29999 &&
        Number(row.average_cost_per_tonne) === 15_000,
      45_000,
    );

    await cdp.evaluate(`(() => {
      window.history.pushState({}, "", "/movement");
      window.dispatchEvent(new PopStateEvent("popstate"));
    })()`);
    await waitFor(
      cdp,
      (state) => state.path === "/movement" && state.mainText.length > 20,
      "the movement list before editing a completed receipt",
    );
    await fillInput(
      cdp,
      'input[placeholder="Поиск..."]',
      fixtures.supplierName,
    );
    await openEditMenuForRow(cdp, "10.10.2026");
    await waitForExpression(
      cdp,
      `Number(document.querySelector('[data-testid="input-quantity-tonnes"]')
        ?.value.replace(",", ".")) === 1`,
      "the original later completed receipt in the edit form",
    );
    await fillInput(
      cdp,
      '[data-testid="input-movement-date"]',
      "08.10.2026",
    );
    await fillInput(cdp, '[data-testid="input-quantity-tonnes"]', "0.8");
    await waitForRecalculation(
      "recalculation_queue",
      "warehouse_id",
      operationalWarehouseId,
      { requireTask: false },
    );
    await cdp.evaluate("window.__uiOperationEvents = []");
    const queueBeforeLaterReceiptEdit = await pool.query(
      `SELECT COUNT(*)::int AS count FROM recalculation_queue
       WHERE warehouse_id = $1 AND product_type = 'kerosene'`,
      [operationalWarehouseId],
    );
    await clickTestId(cdp, "button-create-movement");
    const updatedLaterReceipt = await waitForDatabaseRow(
      `SELECT id, quantity_tonnes, input_mode, is_draft, movement_date,
              purchase_price_per_tonne, total_cost
       FROM movement WHERE notes = $1`,
      [fixtures.secondReceiptNote],
      "the later backdated receipt update",
      (row) =>
        Number(row.quantity_tonnes) === 0.8 &&
        new Date(row.movement_date).toISOString().slice(0, 10) ===
          "2026-10-08",
    );
    assert.equal(updatedLaterReceipt.id, secondReceipt.id);
    assert.equal(updatedLaterReceipt.is_draft, false);
    assert.equal(updatedLaterReceipt.input_mode, "tonnes");
    assert.equal(Number(updatedLaterReceipt.purchase_price_per_tonne), 20_000);
    assert.equal(Number(updatedLaterReceipt.total_cost), 16_000);
    await waitForAuditOperations(updatedLaterReceipt.id, ["CREATE", "UPDATE"]);
    await waitForExpression(
      cdp,
      `window.__uiOperationEvents?.some((event) =>
        event.name === "warehouse_recalculated" &&
        event.data.warehouseId === ${JSON.stringify(operationalWarehouseId)} &&
        event.data.productType === "kerosene")`,
      "the SSE notification after the later receipt recalculation",
      45_000,
    );
    await waitForRecalculation(
      "recalculation_queue",
      "warehouse_id",
      operationalWarehouseId,
      { requireTask: false },
    );
    await delay(300);
    const laterReceiptEvents = await cdp.evaluate(`window.__uiOperationEvents
      .filter((event) =>
        event.name === "warehouse_recalculated" &&
        event.data.warehouseId === ${JSON.stringify(operationalWarehouseId)} &&
        event.data.productType === "kerosene").length`);
    assert.equal(
      laterReceiptEvents,
      1,
      "the later receipt edit produces exactly one completed warehouse recalculation event",
    );
    const queueAfterLaterReceiptEdit = await pool.query(
      `SELECT COUNT(*)::int AS count FROM recalculation_queue
       WHERE warehouse_id = $1 AND product_type = 'kerosene'`,
      [operationalWarehouseId],
    );
    assert.equal(
      queueAfterLaterReceiptEdit.rows[0].count,
      queueBeforeLaterReceiptEdit.rows[0].count + 1,
      "the later receipt edit queues exactly one warehouse recalculation",
    );

    const [intermediateWarehouse, intermediateEquipment, intermediateDeal] =
      await Promise.all([
        pool.query(
          `SELECT current_balance_tonnes, average_cost_per_tonne
           FROM warehouses WHERE id = $1`,
          [operationalWarehouseId],
        ),
        pool.query(
          `SELECT current_balance_tonnes, average_cost_per_tonne
           FROM equipments WHERE id = $1`,
          [equipmentId],
        ),
        pool.query(
          `SELECT purchase_price_per_tonne, purchase_amount, sale_amount, profit
           FROM aircraft_refueling WHERE id = $1`,
          [finalDeal.id],
        ),
      ]);
    const intermediateCostPerTonne = 26_000 / 1.8;
    assert.equal(
      Number(intermediateWarehouse.rows[0].current_balance_tonnes),
      0.3,
    );
    assert.ok(
      Math.abs(
        Number(intermediateWarehouse.rows[0].average_cost_per_tonne) -
          intermediateCostPerTonne,
      ) < 0.01,
      "the source warehouse cost reflects the later receipt edit",
    );
    assert.equal(
      Number(intermediateEquipment.rows[0].current_balance_tonnes),
      1.29999,
    );
    assert.ok(
      Math.abs(
        Number(intermediateEquipment.rows[0].average_cost_per_tonne) -
          intermediateCostPerTonne,
      ) < 0.01,
      "the equipment cost reflects the later receipt edit",
    );
    assert.ok(
      Math.abs(
        Number(intermediateDeal.rows[0].purchase_price_per_tonne) -
          intermediateCostPerTonne,
      ) < 0.01,
      "the linked deal cost reflects the later receipt edit",
    );
    assert.equal(Number(intermediateDeal.rows[0].purchase_amount), 2_889.03);
    assert.equal(Number(intermediateDeal.rows[0].sale_amount), 4_000.2);
    assert.equal(Number(intermediateDeal.rows[0].profit), 1_111.17);

    await fillInput(
      cdp,
      'input[placeholder="Поиск..."]',
      fixtures.supplierName,
    );
    await waitForExpression(
      cdp,
      `Array.from(document.querySelectorAll("tbody tr"))
        .some((row) => row.innerText.includes("01.10.2026"))`,
      "the filtered completed receipt row",
    );
    await openEditMenuForRow(cdp, "01.10.2026");
    await waitForExpression(
      cdp,
      `Number(document.querySelector('[data-testid="input-quantity-tonnes"]')
        ?.value.replace(",", ".")) === 1`,
      "the original completed receipt in the edit form",
    );
    await fillInput(
      cdp,
      '[data-testid="input-movement-date"]',
      "05.10.2026",
    );
    await fillInput(cdp, '[data-testid="input-quantity-tonnes"]', "0.7");
    await waitForRecalculation(
      "recalculation_queue",
      "warehouse_id",
      operationalWarehouseId,
    );
    await cdp.evaluate("window.__uiOperationEvents = []");
    const queueBeforeEarlierReceiptEdit = await pool.query(
      `SELECT COUNT(*)::int AS count FROM recalculation_queue
       WHERE warehouse_id = $1 AND product_type = 'kerosene'`,
      [operationalWarehouseId],
    );
    await clickTestId(cdp, "button-create-movement");
    const updatedReceipt = await waitForDatabaseRow(
      `SELECT id, quantity_tonnes, input_mode, is_draft, movement_date,
              purchase_price_per_tonne, total_cost
       FROM movement WHERE notes = $1`,
      [fixtures.receiptNote],
      "the backdated final receipt update",
      (row) =>
        Number(row.quantity_tonnes) === 0.7 &&
        new Date(row.movement_date).toISOString().slice(0, 10) ===
          "2026-10-05",
    );
    assert.equal(updatedReceipt.id, firstReceipt.id);
    assert.equal(updatedReceipt.is_draft, false);
    assert.equal(updatedReceipt.input_mode, "tonnes");
    assert.equal(Number(updatedReceipt.total_cost), 7_000);
    await waitForAuditOperations(updatedReceipt.id, ["CREATE", "UPDATE"]);

    await waitForExpression(
      cdp,
      `window.__uiOperationEvents?.some((event) =>
        event.name === "warehouse_recalculated" &&
        event.data.warehouseId === ${JSON.stringify(operationalWarehouseId)} &&
        event.data.productType === "kerosene")`,
      "the SSE notification after warehouse recalculation",
      45_000,
    );
    await waitForRecalculation(
      "recalculation_queue",
      "warehouse_id",
      operationalWarehouseId,
    );
    await delay(300);
    const earlierReceiptEvents = await cdp.evaluate(`window.__uiOperationEvents
      .filter((event) =>
        event.name === "warehouse_recalculated" &&
        event.data.warehouseId === ${JSON.stringify(operationalWarehouseId)} &&
        event.data.productType === "kerosene").length`);
    assert.equal(
      earlierReceiptEvents,
      1,
      "the earlier receipt edit produces exactly one completed warehouse recalculation event",
    );
    const queueAfterEarlierReceiptEdit = await pool.query(
      `SELECT COUNT(*)::int AS count FROM recalculation_queue
       WHERE warehouse_id = $1 AND product_type = 'kerosene'`,
      [operationalWarehouseId],
    );
    assert.equal(
      queueAfterEarlierReceiptEdit.rows[0].count,
      queueBeforeEarlierReceiptEdit.rows[0].count + 1,
      "the earlier receipt edit queues exactly one warehouse recalculation",
    );

    const [
      warehouseStock,
      transferStock,
      equipmentStock,
      updatedDeal,
      updatedWarehouseTransfer,
      updatedEquipmentTransfer,
    ] = await Promise.all([
      pool.query(
        `SELECT current_balance_tonnes, average_cost_per_tonne
         FROM warehouses WHERE id = $1`,
        [operationalWarehouseId],
      ),
      pool.query(
        `SELECT current_balance_tonnes, average_cost_per_tonne
         FROM warehouses WHERE id = $1`,
        [transferWarehouseId],
      ),
      pool.query(
        `SELECT current_balance_tonnes, average_cost_per_tonne
         FROM equipments WHERE id = $1`,
        [equipmentId],
      ),
      pool.query(
        `SELECT quantity_tonnes, purchase_price_per_tonne,
                purchase_amount, sale_amount, profit, is_draft
         FROM aircraft_refueling WHERE id = $1`,
        [finalDeal.id],
      ),
      pool.query(
        `SELECT quantity_tonnes, total_cost
         FROM movement WHERE id = $1`,
        [warehouseTransfer.id],
      ),
      pool.query(
        `SELECT quantity_tonnes, cost_per_tonne, total_cost
         FROM equipment_movement WHERE id = $1`,
        [equipmentTransfer.id],
      ),
    ]);
    const expectedAverageCost = 23_000 / 1.5;
    assert.equal(Number(warehouseStock.rows[0].current_balance_tonnes), 0);
    assert.equal(Number(transferStock.rows[0].current_balance_tonnes), 0);
    assert.equal(Number(equipmentStock.rows[0].current_balance_tonnes), 1.29999);
    assert.ok(
      Math.abs(
        Number(equipmentStock.rows[0].average_cost_per_tonne) -
          expectedAverageCost,
      ) < 0.01,
      "the linked equipment average cost follows the revised receipt",
    );
    assert.ok(
      Math.abs(
        Number(updatedDeal.rows[0].purchase_price_per_tonne) -
          expectedAverageCost,
      ) < 0.01,
      "the final deal purchase rate reflects the revised equipment cost",
    );
    assert.equal(Number(updatedDeal.rows[0].quantity_tonnes), 0.20001);
    assert.equal(Number(updatedDeal.rows[0].purchase_amount), 3_066.82);
    assert.equal(Number(updatedDeal.rows[0].sale_amount), 4_000.2);
    assert.equal(Number(updatedDeal.rows[0].profit), 933.38);
    assert.equal(updatedDeal.rows[0].is_draft, false);
    assert.equal(Number(updatedWarehouseTransfer.rows[0].quantity_tonnes), 1.5);
    assert.equal(Number(updatedWarehouseTransfer.rows[0].total_cost), 23_000);
    assert.equal(
      Number(updatedEquipmentTransfer.rows[0].quantity_tonnes),
      1.5,
    );
    assert.ok(
      Math.abs(
        Number(updatedEquipmentTransfer.rows[0].cost_per_tonne) -
          expectedAverageCost,
      ) < 0.01,
      "the equipment transfer per-tonne cost follows both backdated receipt edits",
    );
    assert.equal(Number(updatedEquipmentTransfer.rows[0].total_cost), 23_000);
    await waitForAuditOperations(finalDeal.id, ["CREATE"]);

    await cdp.evaluate("window.__uiOperationSse?.close()");
    console.log(
      "UI flow passed: final receipt, warehouse/equipment transfers, linked sale, and backdated stock/economics/SSE recalculation",
    );

    assert.deepEqual(failures, []);
  } finally {
    stopListening();
    cdp.close();
    await stopBrowser();
    if (failures.length || diagnostics.length) {
      console.log("Browser diagnostics:", JSON.stringify(diagnostics.slice(-20)));
    }
    if (logs()) console.log("Chromium diagnostics:", logs());
  }
});
