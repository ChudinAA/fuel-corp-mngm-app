import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { spawnSync } from "node:child_process";
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
  const [warehouse, equipment, warehouseMassConsistency] = await Promise.all([
    pool.query(
      `SELECT current_balance, current_balance_tonnes,
              pvkj_balance, pvkj_balance_tonnes
       FROM warehouses WHERE id = $1`,
      [warehouseId],
    ),
    pool.query(
      `SELECT current_balance, pvkj_balance FROM equipments WHERE id = $1`,
      [equipmentId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS mismatches
       FROM warehouse_transactions
       WHERE warehouse_id = $1
         AND (
           quantity_tonnes IS DISTINCT FROM CAST(quantity AS NUMERIC) / 1000
           OR balance_before_tonnes IS DISTINCT FROM CAST(balance_before AS NUMERIC) / 1000
           OR balance_after_tonnes IS DISTINCT FROM CAST(balance_after AS NUMERIC) / 1000
         )`,
      [warehouseId],
    ),
  ]);
  const warehouseRow = warehouse.rows[0];
  assert.equal(
    Number(warehouseRow?.current_balance_tonnes),
    Number((Number(warehouseRow?.current_balance) / 1000).toFixed(5)),
    "warehouse kerosene balance must be stored in tonnes",
  );
  assert.equal(
    Number(warehouseRow?.pvkj_balance_tonnes),
    Number((Number(warehouseRow?.pvkj_balance) / 1000).toFixed(5)),
    "warehouse PVKJ balance must be stored in tonnes",
  );
  assert.equal(
    Number(warehouseMassConsistency.rows[0]?.mismatches),
    0,
    "warehouse ledger tonne values must mirror their legacy kg values",
  );
  return {
    warehouseKerosene: Number(warehouseRow?.current_balance),
    warehousePvkj: Number(warehouseRow?.pvkj_balance),
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
    `SELECT current_balance, current_balance_tonnes, average_cost
     FROM ${table} WHERE id = $1`,
    [id],
  );
  assert.ok(result.rows[0], `${table} stock record exists`);
  return {
    quantity: Number(result.rows[0].current_balance),
    quantityTonnes:
      result.rows[0].current_balance_tonnes == null
        ? null
        : Number(result.rows[0].current_balance_tonnes),
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
  assert.notEqual(actual.quantityTonnes, null, `${label} tonne balance is stored`);
  assert.ok(
    Math.abs(actual.quantityTonnes - actual.quantity / 1000) < 0.000001,
    `${label} tonne balance matches its legacy kg mirror`,
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

function makeTonneRefuelingDeal(input) {
  const legacyDeal = makeRefuelingDeal(input);
  const {
    quantityKg,
    purchasePrice,
    salePrice,
    agentFeeRate,
    ...fields
  } = legacyDeal;
  return {
    ...fields,
    quantityTonnes: quantityKg / 1000,
    purchasePricePerTonne:
      purchasePrice === null || purchasePrice === undefined
        ? null
        : purchasePrice * 1000,
    salePricePerTonne:
      salePrice === null || salePrice === undefined ? null : salePrice * 1000,
    agentFeeRatePerTonne:
      agentFeeRate === null || agentFeeRate === undefined
        ? null
        : agentFeeRate * 1000,
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

  let deliveryCarrierId;
  let deliveryCostId;
  try {
    deliveryCarrierId = (
      await pool.query(
        `INSERT INTO logistics_carriers (name)
         VALUES ($1)
         RETURNING id`,
        [`Critical delivery carrier ${randomUUID()}`],
      )
    ).rows[0].id;

    const deliveryCost = await api("/api/delivery-costs", {
      method: "POST",
      expectedStatus: 201,
      body: {
        carrierId: deliveryCarrierId,
        fromEntityType: "base",
        fromEntityId: "00000000-0000-4000-8000-000000000001",
        fromLocation: "Critical source",
        toEntityType: "base",
        toEntityId: "00000000-0000-4000-8000-000000000002",
        toLocation: "Critical destination",
        costPerTonne: 12345.67,
      },
    });
    deliveryCostId = deliveryCost.id;
    assert.equal(Number(deliveryCost.costPerTonne), 12345.67);
    assert.equal(deliveryCost.costPerKg, undefined);

    let storedDeliveryCost = await pool.query(
      `SELECT cost_per_kg, cost_per_tonne
       FROM delivery_cost WHERE id = $1`,
      [deliveryCostId],
    );
    assert.equal(Number(storedDeliveryCost.rows[0].cost_per_kg), 12.34567);
    assert.equal(Number(storedDeliveryCost.rows[0].cost_per_tonne), 12345.67);

    const legacyEdit = await api(`/api/delivery-costs/${deliveryCostId}`, {
      method: "PATCH",
      body: { costPerKg: 0.2 },
    });
    assert.equal(Number(legacyEdit.costPerTonne), 200);

    const tonneEdit = await api(`/api/delivery-costs/${deliveryCostId}`, {
      method: "PATCH",
      body: { costPerTonne: 250, costPerKg: 0.2 },
    });
    assert.equal(Number(tonneEdit.costPerTonne), 250);
    assert.equal(tonneEdit.costPerKg, undefined);
    storedDeliveryCost = await pool.query(
      `SELECT cost_per_kg, cost_per_tonne
       FROM delivery_cost WHERE id = $1`,
      [deliveryCostId],
    );
    assert.equal(Number(storedDeliveryCost.rows[0].cost_per_kg), 0.25);
    assert.equal(Number(storedDeliveryCost.rows[0].cost_per_tonne), 250);

    const fetchedDeliveryCost = await api(
      `/api/delivery-costs/${deliveryCostId}`,
    );
    assert.equal(Number(fetchedDeliveryCost.costPerTonne), 250);
    assert.equal(fetchedDeliveryCost.costPerKg, undefined);
  } finally {
    if (deliveryCostId) {
      await pool.query("DELETE FROM delivery_cost WHERE id = $1", [
        deliveryCostId,
      ]);
    }
    if (deliveryCarrierId) {
      await pool.query("DELETE FROM logistics_carriers WHERE id = $1", [
        deliveryCarrierId,
      ]);
    }
  }

  const foreignDraft = await api("/api/refueling-abroad", {
    method: "POST",
    expectedStatus: 201,
    body: {
      isDraft: true,
      inputMode: "tonnes",
      quantityTonnes: 0.01234,
      density: 0.8,
      purchasePriceUsdPerTonne: 20000,
      purchasePriceRubPerTonne: 1600000,
      salePriceUsdPerTonne: 25000,
      salePriceRubPerTonne: 2000000,
      purchaseAmountUsd: 246.8,
      purchaseAmountRub: 19744,
      saleAmountUsd: 308.5,
      saleAmountRub: 24680,
    },
  });
  assert.equal(foreignDraft.quantityTonnes, 0.01234);
  assert.equal(foreignDraft.inputMode, "tonnes");
  assert.ok(Math.abs(foreignDraft.purchasePriceUsdPerTonne - 20000) < 0.001);
  assert.ok(Math.abs(foreignDraft.purchasePriceRubPerTonne - 1600000) < 0.001);
  assert.equal(foreignDraft.quantityKg, undefined);
  assert.equal(foreignDraft.purchasePriceUsd, undefined);
  const fetchedForeignDraft = await api(`/api/refueling-abroad/${foreignDraft.id}`);
  assert.equal(fetchedForeignDraft.quantityTonnes, 0.01234);
  assert.equal(fetchedForeignDraft.quantityKg, undefined);
  const storedForeignDraft = await pool.query(
    `SELECT quantity_kg, quantity_tonnes, input_mode,
            purchase_price_usd, purchase_price_usd_per_tonne,
            purchase_price_rub, purchase_price_rub_per_tonne
     FROM refueling_abroad WHERE id = $1`,
    [foreignDraft.id],
  );
  assert.equal(Number(storedForeignDraft.rows[0].quantity_kg), 12.34);
  assert.equal(Number(storedForeignDraft.rows[0].quantity_tonnes), 0.01234);
  assert.equal(storedForeignDraft.rows[0].input_mode, "tonnes");
  assert.equal(Number(storedForeignDraft.rows[0].purchase_price_usd), 20);
  assert.equal(
    Number(storedForeignDraft.rows[0].purchase_price_usd_per_tonne),
    20000,
  );
  assert.equal(Number(storedForeignDraft.rows[0].purchase_price_rub), 1600);
  assert.equal(
    Number(storedForeignDraft.rows[0].purchase_price_rub_per_tonne),
    1600000,
  );

  const supplier = (
    await pool.query(
      `INSERT INTO suppliers (name) VALUES ('critical-flow-supplier') RETURNING id`,
    )
  ).rows[0];
  const supplierBasis = (
    await pool.query(
      `INSERT INTO bases (name, base_type)
       VALUES ('critical-flow-supplier-basis', 'wholesale')
       RETURNING id`,
    )
  ).rows[0];
  const basisPriceInput = {
    basisId: supplierBasis.id,
    servicePricePerTonne: 12345.678901,
    pvkjPricePerTonne: 250.251234,
    agentFeePerTonne: 1234.567891,
    otherServiceType: "fixed",
    otherServiceValue: "25.50",
    otherServiceName: "Critical fixed service",
    otherServiceQuantity: "3",
  };
  await api(`/api/suppliers/${supplier.id}`, {
    method: "PATCH",
    body: { basisPrices: [basisPriceInput] },
  });
  let savedSupplier = await api(`/api/suppliers/${supplier.id}`);
  let savedBasisPrice = savedSupplier.basisPrices.find(
    (price) => price.basisId === supplierBasis.id,
  );
  assert.equal(Number(savedBasisPrice.servicePricePerTonne), 12345.678901);
  assert.equal(Number(savedBasisPrice.servicePrice), 12.345679);
  assert.equal(Number(savedBasisPrice.pvkjPricePerTonne), 250.251234);
  assert.equal(Number(savedBasisPrice.pvkjPrice), 0.250251);
  assert.equal(Number(savedBasisPrice.agentFeePerTonne), 1234.567891);
  assert.equal(Number(savedBasisPrice.agentFee), 1.234568);

  await api(`/api/suppliers/${supplier.id}`, {
    method: "PATCH",
    body: {
      basisPrices: [
        {
          ...basisPriceInput,
          servicePricePerTonne: "12345.68",
          servicePrice: "12.345679",
          pvkjPricePerTonne: "250.25",
          pvkjPrice: "0.250251",
          agentFeePerTonne: "1234.57",
          agentFee: "1.234568",
        },
      ],
    },
  });
  savedSupplier = await api(`/api/suppliers/${supplier.id}`);
  savedBasisPrice = savedSupplier.basisPrices.find(
    (price) => price.basisId === supplierBasis.id,
  );
  assert.equal(Number(savedBasisPrice.servicePricePerTonne), 12345.678901);
  assert.equal(Number(savedBasisPrice.pvkjPricePerTonne), 250.251234);
  assert.equal(Number(savedBasisPrice.agentFeePerTonne), 1234.567891);
  assert.equal(Number(savedBasisPrice.otherServiceValue), 25.5);
  assert.equal(Number(savedBasisPrice.otherServiceQuantity), 3);

  await api(`/api/suppliers/${supplier.id}`, {
    method: "PATCH",
    body: {
      basisPrices: [
        {
          ...basisPriceInput,
          servicePricePerTonne: undefined,
          servicePrice: "0.200000",
          pvkjPricePerTonne: "250.25",
          pvkjPrice: "0.250251",
          agentFeePerTonne: "1234.57",
          agentFee: "1.234568",
        },
      ],
    },
  });
  savedSupplier = await api(`/api/suppliers/${supplier.id}`);
  savedBasisPrice = savedSupplier.basisPrices.find(
    (price) => price.basisId === supplierBasis.id,
  );
  assert.equal(Number(savedBasisPrice.servicePricePerTonne), 200);
  assert.equal(Number(savedBasisPrice.servicePrice), 0.2);

  await api(`/api/suppliers/${supplier.id}`, {
    method: "PATCH",
    body: {
      basisPrices: [
        {
          ...basisPriceInput,
          servicePricePerTonne: 250,
          servicePrice: "0.200000",
          pvkjPricePerTonne: "250.25",
          pvkjPrice: "0.250251",
          agentFeePerTonne: "1234.57",
          agentFee: "1.234568",
        },
      ],
    },
  });
  const savedBasisRateColumns = await pool.query(
    `SELECT service_price, service_price_per_tonne,
            pvkj_price, pvkj_price_per_tonne,
            agent_fee, agent_fee_per_tonne,
            other_service_value, other_service_quantity
     FROM supplier_basis_prices
     WHERE supplier_id = $1 AND basis_id = $2`,
    [supplier.id, supplierBasis.id],
  );
  assert.equal(Number(savedBasisRateColumns.rows[0].service_price), 0.25);
  assert.equal(Number(savedBasisRateColumns.rows[0].service_price_per_tonne), 250);
  assert.equal(Number(savedBasisRateColumns.rows[0].pvkj_price_per_tonne), 250.251234);
  assert.equal(Number(savedBasisRateColumns.rows[0].agent_fee_per_tonne), 1234.567891);
  assert.equal(Number(savedBasisRateColumns.rows[0].other_service_value), 25.5);
  await pool.query("DELETE FROM supplier_basis_prices WHERE supplier_id = $1", [
    supplier.id,
  ]);
  await pool.query("DELETE FROM bases WHERE id = $1", [supplierBasis.id]);

  const tonnePrice = await api("/api/prices", {
    method: "POST",
    expectedStatus: 201,
    body: {
      productType: "critical-flow-price-unit",
      counterpartyId: supplier.id,
      counterpartyType: "abroad",
      counterpartyRole: "supplier",
      basis: "critical-flow-price-unit-basis",
      currency: "RUB",
      limitType: "volume",
      contractLimitEnabled: true,
      contractVolume: { limitUnit: "tonne", limit: 1.23456 },
      priceRate: { unit: "tonne", values: [1234.567] },
      dateFrom: "2026-11-01",
      dateTo: "2026-11-30",
    },
  });
  assert.equal(tonnePrice.priceUnit, "tonne");
  assert.equal(tonnePrice.volumeUnit, "tonne");
  assert.equal(tonnePrice.contractVolume.limit, 1.23456);

  await pool.query(
    `UPDATE prices
     SET price_unit = 'kg',
         price_values = ARRAY['{"price":1.234567}']::text[],
         volume_unit = 'kg',
         volume = 1234.56,
         sold_volume = 345.67
     WHERE id = $1`,
    [tonnePrice.id],
  );
  const updatedTonnePrice = await api(`/api/prices/${tonnePrice.id}`, {
    method: "PATCH",
    body: {
      productType: "critical-flow-price-unit",
      counterpartyId: supplier.id,
      counterpartyType: "abroad",
      counterpartyRole: "supplier",
      basis: "critical-flow-price-unit-basis",
      currency: "RUB",
      limitType: "volume",
      contractLimitEnabled: true,
      contractVolume: { limitUnit: "tonne", limit: 1.23456 },
      priceRate: { unit: "tonne", values: [1234.567] },
      dateFrom: "2026-11-01",
      dateTo: "2026-11-30",
    },
  });
  assert.equal(updatedTonnePrice.priceUnit, "tonne");
  assert.equal(updatedTonnePrice.volumeUnit, "tonne");
  assert.equal(updatedTonnePrice.contractVolume.used, 0.34567);
  const persistedTonnePrice = await pool.query(
    `SELECT price_unit, price_values, volume_unit, volume, sold_volume
     FROM prices WHERE id = $1`,
    [tonnePrice.id],
  );
  assert.equal(persistedTonnePrice.rows[0].price_unit, "tonne");
  assert.equal(
    JSON.parse(persistedTonnePrice.rows[0].price_values[0]).price,
    1234.567,
  );
  assert.equal(persistedTonnePrice.rows[0].volume_unit, "tonne");
  assert.equal(Number(persistedTonnePrice.rows[0].volume), 1.23456);
  assert.equal(Number(persistedTonnePrice.rows[0].sold_volume), 0.34567);

  const contractPrice = (
    await pool.query(
      `INSERT INTO prices (
         product_type, counterparty_id, counterparty_type, counterparty_role,
         basis, volume, date_from, date_to, price_unit
       )
       VALUES ('kerosene', $1, 'supplier', 'supplier', 'critical-flow-basis',
               1000, CURRENT_DATE, CURRENT_DATE, 'liter')
       RETURNING id`,
      [supplier.id],
    )
  ).rows[0];
  await pool.query(
    `UPDATE refueling_abroad
     SET is_draft = false, purchase_price_id = $2,
         quantity_liters = 15.5, density = 0.8
     WHERE id = $1`,
    [foreignDraft.id, contractPrice.id],
  );
  const foreignContractUsage = await api(
    `/api/refueling-abroad/contract-used/${contractPrice.id}`,
  );
  // Historical mass follows the saved kg/tonne value, even when litres ×
  // density differs; liters remain the compatibility value for liter tariffs.
  assert.ok(
    Math.abs(Number(foreignContractUsage.usedVolumeTonnes) - 0.01234) <
      0.000001,
  );
  assert.equal(Number(foreignContractUsage.usedVolume), 15.5);

  const domesticContractUsage = await api(
    `/api/refueling/contract-used/${contractPrice.id}`,
  );
  assert.equal(Number(domesticContractUsage.usedVolumeTonnes), 0);
  const optContractUsage = await api(
    `/api/opt/contract-used/${contractPrice.id}`,
  );
  assert.equal(Number(optContractUsage.usedVolumeTonnes), 0);

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
  const transportationDeal = await api("/api/transportation", {
    method: "POST",
    expectedStatus: 201,
    body: {
      buyerId: refuelingBuyer.id,
      dealDate: "2026-10-27",
      productType: "kerosene",
      inputMode: "tonnes",
      quantityTonnes: 0.01234,
      salePricePerTonne: 160_000,
      saleAmount: 1_974.4,
      deliveryTariffPerTonne: 2_500,
      deliveryCost: 30.85,
      profit: 1_943.55,
      isDraft: true,
    },
  });
  assert.equal(transportationDeal.quantityTonnes, 0.01234);
  assert.equal(transportationDeal.quantityKg, undefined);
  assert.equal(Number(transportationDeal.salePricePerTonne), 160_000);
  assert.equal(Number(transportationDeal.deliveryTariffPerTonne), 2_500);
  assert.equal(Number(transportationDeal.saleAmount), 1_974.4);
  const storedTransportationDeal = await pool.query(
    `SELECT quantity_kg, quantity_tonnes, sale_price, sale_price_per_tonne,
            delivery_tariff, delivery_tariff_per_tonne, sale_amount, delivery_cost
     FROM transportation WHERE id = $1`,
    [transportationDeal.id],
  );
  assert.equal(Number(storedTransportationDeal.rows[0].quantity_kg), 12.34);
  assert.equal(Number(storedTransportationDeal.rows[0].quantity_tonnes), 0.01234);
  assert.equal(Number(storedTransportationDeal.rows[0].sale_price), 160);
  assert.equal(
    Number(storedTransportationDeal.rows[0].sale_price_per_tonne),
    160_000,
  );
  assert.equal(Number(storedTransportationDeal.rows[0].delivery_tariff), 2.5);
  assert.equal(
    Number(storedTransportationDeal.rows[0].delivery_tariff_per_tonne),
    2_500,
  );
  assert.equal(Number(storedTransportationDeal.rows[0].sale_amount), 1_974.4);
  assert.equal(Number(storedTransportationDeal.rows[0].delivery_cost), 30.85);
  const fetchedTransportationDeal = await api(
    `/api/transportation/${transportationDeal.id}`,
  );
  assert.equal(fetchedTransportationDeal.quantityTonnes, 0.01234);
  assert.equal(fetchedTransportationDeal.quantityKg, undefined);

  const warehouse = (
    await pool.query(
      `INSERT INTO warehouses
         (name, current_balance, current_balance_tonnes, average_cost,
          pvkj_balance, pvkj_balance_tonnes, pvkj_average_cost)
       VALUES ('critical-flow-warehouse', 1000, 1.00000, 10, 1000, 1.00000, 12)
       RETURNING id`,
    )
  ).rows[0];
  const equipment = (
    await pool.query(
      `INSERT INTO equipments
         (name, current_balance, current_balance_tonnes, average_cost,
          pvkj_balance, pvkj_balance_tonnes, pvkj_average_cost)
       VALUES ('critical-flow-equipment', 1000, 1.00000, 10, 1000, 1.00000, 12)
       RETURNING id`,
    )
  ).rows[0];
  await pool.query(
    `INSERT INTO warehouse_transactions
       (warehouse_id, transaction_type, product_type, quantity, quantity_tonnes,
        source_type, balance_before, balance_before_tonnes,
        balance_after, balance_after_tonnes, average_cost_before,
        average_cost_after, sum, price, transaction_date)
     VALUES ($1, 'receipt', 'kerosene', 1000, 1.00000, 'critical_flow_seed',
             0, 0.00000, 1000, 1.00000, 0, 10, 10000, 10,
             '2026-10-01T00:00:00.000Z')`,
    [warehouse.id],
  );

  const planningWarehouse = (
    await pool.query(
      `INSERT INTO warehouses
         (name, current_balance, current_balance_tonnes, average_cost,
          pvkj_balance, pvkj_balance_tonnes, pvkj_average_cost)
       VALUES ('critical-flow-planning-warehouse', 0, 0, 0, 0, 0, 0)
       RETURNING id`,
    )
  ).rows[0];
  const planningEntry = await api("/api/planning/entries", {
    method: "POST",
    expectedStatus: 201,
    body: {
      warehouseId: planningWarehouse.id,
      date: "2030-01-15T12:00:00.000Z",
      type: "income",
      volume: "123.45",
    },
  });
  assert.equal(Number(planningEntry.volume), 123.45);
  assert.equal(Number(planningEntry.volumeTonnes), 0.12345);
  const kgOnlyPlanningEdit = await api(
    `/api/planning/entries/${planningEntry.id}`,
    {
      method: "PATCH",
      body: { volume: "234.56" },
    },
  );
  assert.equal(Number(kgOnlyPlanningEdit.volume), 234.56);
  assert.equal(Number(kgOnlyPlanningEdit.volumeTonnes), 0.23456);
  const tonnePlanningEdit = await api(
    `/api/planning/entries/${planningEntry.id}`,
    {
      method: "PATCH",
      body: { volumeTonnes: "0.34567" },
    },
  );
  assert.equal(Number(tonnePlanningEdit.volume), 345.67);
  assert.equal(Number(tonnePlanningEdit.volumeTonnes), 0.34567);
  const storedPlanningMass = await pool.query(
    `SELECT volume, volume_tonnes, balance_after, balance_after_tonnes
     FROM plan_entries WHERE id = $1`,
    [planningEntry.id],
  );
  assert.equal(Number(storedPlanningMass.rows[0].volume), 345.67);
  assert.equal(Number(storedPlanningMass.rows[0].volume_tonnes), 0.34567);
  assert.equal(Number(storedPlanningMass.rows[0].balance_after), 345.67);
  assert.equal(Number(storedPlanningMass.rows[0].balance_after_tonnes), 0.34567);

  await pool.query(
    `INSERT INTO equipment_transactions
       (equipment_id, transaction_type, product_type, quantity, quantity_tonnes,
        source_type, balance_before, balance_before_tonnes,
        balance_after, balance_after_tonnes, average_cost_before,
        average_cost_after, sum, price, transaction_date)
     VALUES ($1, 'receipt', 'pvkj', 1000, 1.00000, 'critical_flow_seed',
             0, 0.00000, 1000, 1.00000, 0, 12, 12000, 12,
             '2026-10-01T00:00:00.000Z')`,
    [equipment.id],
  );

  const initialDeals = [
    makeTonneRefuelingDeal({
      productType: "kerosene",
      date: "2026-10-20T12:00:00.000Z",
      supplierId: supplier.id,
      buyerId: refuelingBuyer.id,
      warehouseId: warehouse.id,
      quantityKg: 10,
      purchasePrice: 10,
      salePrice: 15,
    }),
    makeTonneRefuelingDeal({
      productType: "pvkj",
      date: "2026-10-20T12:00:00.000Z",
      supplierId: supplier.id,
      buyerId: refuelingBuyer.id,
      equipmentId: equipment.id,
      quantityKg: 7,
      purchasePrice: 12,
      salePrice: 18,
    }),
    makeTonneRefuelingDeal({
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
  assert.deepEqual(
    createdOrder.map((deal) => Number(deal.quantityTonnes)).sort((a, b) => a - b),
    [0.007, 0.01, 0.017],
  );
  assert.ok(createdOrder.every((deal) => deal.quantityKg === undefined));
  assert.equal(Number(createdOrder[0].purchasePricePerTonne), 10000);
  assert.equal(createdOrder[0].purchasePrice, undefined);
  assert.equal(new Set(createdOrder.map((deal) => deal.refuelingOrderId)).size, 1);
  assertDealEconomics(createdOrder);
  const storedRefuelingRate = await pool.query(
    "SELECT quantity_kg, quantity_tonnes, purchase_price, purchase_price_per_tonne, sale_price, sale_price_per_tonne FROM aircraft_refueling WHERE id = $1",
    [createdOrder.find((deal) => deal.productType === "kerosene").id],
  );
  assert.equal(Number(storedRefuelingRate.rows[0].quantity_kg), 10);
  assert.equal(Number(storedRefuelingRate.rows[0].quantity_tonnes), 0.01);
  assert.equal(Number(storedRefuelingRate.rows[0].purchase_price), 10);
  assert.equal(
    Number(storedRefuelingRate.rows[0].purchase_price_per_tonne),
    10000,
  );
  assert.equal(Number(storedRefuelingRate.rows[0].sale_price), 15);
  assert.equal(Number(storedRefuelingRate.rows[0].sale_price_per_tonne), 15000);
  const tonneReport = await api("/api/management-report/generate", {
    method: "POST",
    body: {
      periodStart: "2026-10-20T00:00:00.000Z",
      periodEnd: "2026-10-20T23:59:59.999Z",
    },
  });
  assert.equal(Number(tonneReport.salesMetrics.refuelingSales.totalVolumeTonnes), 0.034);
  assert.equal(Number(tonneReport.salesMetrics.optSales.totalVolumeTonnes), 0);
  assert.equal(Number(tonneReport.salesMetrics.combined.totalVolumeTonnes), 0.034);
  assert.equal(tonneReport.salesMetrics.refuelingSales.totalVolume, undefined);
  const analyticsSummary = await api(
    "/api/analytics/summary?startDate=2026-10-20T00:00:00.000Z&endDate=2026-10-20T23:59:59.999Z&module=refueling",
  );
  assert.equal(Number(analyticsSummary.totalVolumeTonnes), 0.034);
  assert.equal(
    analyticsSummary.productTypeDistribution.reduce(
      (sum, item) => sum + Number(item.volumeTonnes),
      0,
    ),
    0.034,
  );
  const comparativeAnalytics = await api("/api/analytics/comparative", {
    method: "POST",
    body: {
      periods: [{
        startDate: "2026-10-20T00:00:00.000Z",
        endDate: "2026-10-20T23:59:59.999Z",
        label: "tonne-check",
      }],
      metrics: ["sales"],
    },
  });
  assert.equal(
    Number(comparativeAnalytics["tonne-check"].sales.refuelingVolumeTonnes),
    0.034,
  );
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
  assert.ok(laterOrder.every((deal) => deal.quantityKg === undefined));
  assert.equal(Number(laterOrder[0].quantityTonnes), 0.002);

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
      quantityTonnes: 0.02,
      inputMode: "tonnes",
      purchasePricePerTonne: 10000.001,
      salePricePerTonne: 15000.004,
      deliveryTariffPerTonne: 500,
      purchaseAmount: 200,
      saleAmount: 300,
      profit: 100,
      isDraft: false,
      isNoDeliveryRequired: true,
    },
  });
  assert.equal(Number(optCreated.quantityTonnes), 0.02);
  assert.equal(optCreated.quantityKg, undefined);
  assert.equal(Number(optCreated.purchasePricePerTonne), 10000.001);
  assert.equal(Number(optCreated.salePricePerTonne), 15000.004);
  assert.equal(optCreated.purchasePrice, undefined);
  assert.equal(optCreated.salePrice, undefined);
  assert.equal(Number(optCreated.profit), 100);
  const storedOptMass = await pool.query(
    `SELECT quantity_tonnes, quantity_kg,
            purchase_price_per_tonne, purchase_price,
            sale_price_per_tonne, sale_price,
            delivery_tariff_per_tonne, delivery_tariff
     FROM opt WHERE id = $1`,
    [optCreated.id],
  );
  assert.equal(Number(storedOptMass.rows[0].quantity_tonnes), 0.02);
  assert.equal(Number(storedOptMass.rows[0].quantity_kg), 20);
  assert.equal(Number(storedOptMass.rows[0].purchase_price_per_tonne), 10000.001);
  assert.equal(Number(storedOptMass.rows[0].purchase_price), 10.000001);
  assert.equal(Number(storedOptMass.rows[0].sale_price_per_tonne), 15000.004);
  assert.equal(Number(storedOptMass.rows[0].sale_price), 15.000004);
  assert.equal(Number(storedOptMass.rows[0].delivery_tariff_per_tonne), 500);
  assert.equal(Number(storedOptMass.rows[0].delivery_tariff), 0.5);
  const roundedRateNoop = await api(`/api/opt/${optCreated.id}`, {
    method: "PATCH",
    body: {
      purchasePricePerTonne: 10000,
      salePricePerTonne: 15000,
    },
  });
  assert.equal(Number(roundedRateNoop.purchasePricePerTonne), 10000.001);
  assert.equal(Number(roundedRateNoop.salePricePerTonne), 15000.004);
  const storedOptRateNoop = await pool.query(
    "SELECT purchase_price_per_tonne, purchase_price, sale_price_per_tonne, sale_price FROM opt WHERE id = $1",
    [optCreated.id],
  );
  assert.equal(Number(storedOptRateNoop.rows[0].purchase_price_per_tonne), 10000.001);
  assert.equal(Number(storedOptRateNoop.rows[0].purchase_price), 10.000001);
  assert.equal(Number(storedOptRateNoop.rows[0].sale_price_per_tonne), 15000.004);
  assert.equal(Number(storedOptRateNoop.rows[0].sale_price), 15.000004);
  const optList = await api("/api/opt?pageSize=100");
  const listedOpt = optList.data.find((deal) => deal.id === optCreated.id);
  assert.equal(Number(listedOpt.quantityTonnes), 0.02);
  assert.equal(listedOpt.quantityKg, undefined);
  const dailyOptReport = await api("/api/reports/daily-opt?date=2026-10-26");
  const dailyOptDeal = dailyOptReport.find((deal) => deal.id === optCreated.id);
  assert.ok(dailyOptDeal, "daily OPT report includes the deal for the selected date");
  assert.equal(Number(dailyOptDeal.quantityTonnes), 0.02);
  assert.equal(dailyOptDeal.quantityKg, undefined);
  const customPeriodReport = await api("/api/reports/custom-period", {
    method: "POST",
    body: {
      startDate: "2026-10-26T00:00:00.000Z",
      endDate: "2026-10-26T23:59:59.999Z",
      reportTypes: ["opt", "refueling", "movement"],
    },
  });
  const customReportOptDeal = customPeriodReport.opt.find(
    (deal) => deal.id === optCreated.id,
  );
  assert.ok(customReportOptDeal, "custom-period report includes the selected OPT deal");
  assert.equal(Number(customReportOptDeal.quantityTonnes), 0.02);
  assert.equal(customReportOptDeal.quantityKg, undefined);
  for (const reportType of ["refueling", "movement"]) {
    for (const deal of customPeriodReport[reportType]) {
      assert.equal(deal.quantityKg, undefined);
      assert.ok(Number.isFinite(Number(deal.quantityTonnes)));
    }
  }

  const governmentContract = await api("/api/gov-contracts", {
    method: "POST",
    expectedStatus: 201,
    body: {
      contractNumber: "critical-flow-contract",
      contractName: "critical-flow-tonne-contract",
      customerId: wholesaleBuyer.id,
      contractDate: "2026-10-20T00:00:00.000Z",
      startDate: "2026-10-01T00:00:00.000Z",
      endDate: "2026-11-01T00:00:00.000Z",
      totalAmount: "1000.00",
      productType: "RT",
      plannedVolumeTonnes: 0.5,
      status: "active",
      notes: "",
    },
  });
  assert.equal(Number(governmentContract.plannedVolumeTonnes), 0.5);
  assert.equal(governmentContract.plannedVolume, undefined);
  const storedContractMass = await pool.query(
    "SELECT planned_volume FROM government_contracts WHERE id = $1",
    [governmentContract.id],
  );
  assert.equal(Number(storedContractMass.rows[0].planned_volume), 500);
  const listedContracts = await api("/api/gov-contracts");
  const listedContract = listedContracts.find((contract) => contract.id === governmentContract.id);
  assert.equal(Number(listedContract.plannedVolumeTonnes), 0.5);
  assert.equal(listedContract.plannedVolume, undefined);

  const contractSalesSync = await api(
    `/api/gov-contracts/${governmentContract.id}/update-from-sales`,
    { method: "POST" },
  );
  assert.equal(Number(contractSalesSync.plannedVolumeTonnes), 0.5);
  assert.ok(Number(contractSalesSync.actualVolumeTonnes) >= 0.02);
  assert.equal(contractSalesSync.actualVolume, undefined);

  const contractCompletion = await api(
    `/api/gov-contracts/${governmentContract.id}/completion-status`,
  );
  assert.equal(Number(contractCompletion.planned.volumeTonnes), 0.5);
  assert.equal(contractCompletion.planned.volume, undefined);
  const updatedGovernmentContract = await api(
    `/api/gov-contracts/${governmentContract.id}`,
    {
      method: "PATCH",
      body: { plannedVolumeTonnes: 0.75 },
    },
  );
  assert.equal(Number(updatedGovernmentContract.plannedVolumeTonnes), 0.75);
  const updatedStoredContractMass = await pool.query(
    "SELECT planned_volume FROM government_contracts WHERE id = $1",
    [governmentContract.id],
  );
  assert.equal(Number(updatedStoredContractMass.rows[0].planned_volume), 750);

  const budgetEntry = await api("/api/budget", {
    method: "POST",
    expectedStatus: 201,
    body: {
      budgetMonth: "2026-10-01T00:00:00.000Z",
      salesVolumeTonnes: 0.00001,
      salesRevenue: "777.00",
      marginality: "12.50",
      operatingExpenses: "10.00",
      personnelExpenses: "0.00",
      logisticsExpenses: "0.00",
      otherExpenses: "0.00",
      totalExpenses: "10.00",
      netProfit: "767.00",
      notes: "critical flow tonne API",
    },
  });
  assert.equal(Number(budgetEntry.salesVolumeTonnes), 0.00001);
  assert.equal(budgetEntry.salesVolume, undefined);
  const storedBudgetBeforeAutofill = await pool.query(
    "SELECT sales_volume, sales_volume_tonnes, sales_revenue FROM budget_income_expense WHERE id = $1",
    [budgetEntry.id],
  );
  assert.equal(Number(storedBudgetBeforeAutofill.rows[0].sales_volume), 0.01);
  assert.equal(Number(storedBudgetBeforeAutofill.rows[0].sales_volume_tonnes), 0.00001);
  assert.equal(Number(storedBudgetBeforeAutofill.rows[0].sales_revenue), 777);
  const listedBudgetEntries = await api("/api/budget");
  const listedBudgetEntry = listedBudgetEntries.find((entry) => entry.id === budgetEntry.id);
  assert.equal(Number(listedBudgetEntry.salesVolumeTonnes), 0.00001);
  assert.equal(listedBudgetEntry.salesVolume, undefined);
  const updatedFromLegacyKilograms = await api(`/api/budget/${budgetEntry.id}`, {
    method: "PATCH",
    body: { salesVolume: "0.03" },
  });
  assert.equal(Number(updatedFromLegacyKilograms.salesVolumeTonnes), 0.00003);
  const updatedBudgetEntry = await api(`/api/budget/${budgetEntry.id}`, {
    method: "PATCH",
    body: { salesVolumeTonnes: 0.00002 },
  });
  assert.equal(Number(updatedBudgetEntry.salesVolumeTonnes), 0.00002);
  assert.equal(updatedBudgetEntry.salesVolume, undefined);
  const storedBudgetAfterPatch = await pool.query(
    "SELECT sales_volume, sales_volume_tonnes FROM budget_income_expense WHERE id = $1",
    [budgetEntry.id],
  );
  assert.equal(Number(storedBudgetAfterPatch.rows[0].sales_volume), 0.02);
  assert.equal(Number(storedBudgetAfterPatch.rows[0].sales_volume_tonnes), 0.00002);

  const budgetSalesRows = await pool.query(
    `SELECT quantity_kg, quantity_tonnes, quantity_liters, density FROM opt
       WHERE deal_date >= '2026-10-01' AND deal_date < '2026-11-01'
         AND deleted_at IS NULL
     UNION ALL
     SELECT quantity_kg, quantity_tonnes, quantity_liters, density FROM aircraft_refueling
       WHERE refueling_date >= '2026-10-01' AND refueling_date < '2026-11-01'
         AND deleted_at IS NULL`,
  );
  const expectedBudgetVolumeTonnes = budgetSalesRows.rows.reduce((sum, deal) => {
    const litres = Number(deal.quantity_liters ?? 0);
    const density = Number(deal.density ?? 0);
    const massTonnes = litres > 0 && density > 0
      ? (litres * density) / 1000
      : deal.quantity_tonnes !== null
        ? Number(deal.quantity_tonnes)
        : Number(deal.quantity_kg ?? 0) / 1000;
    return sum + massTonnes;
  }, 0);

  const budgetAutofill = await api(
    `/api/budget/${budgetEntry.id}/auto-fill`,
    { method: "POST" },
  );
  assert.ok(
    Math.abs(Number(budgetAutofill.salesVolumeTonnes) - expectedBudgetVolumeTonnes) < 1e-9,
  );
  assert.equal(budgetAutofill.salesVolume, undefined);
  const storedBudgetAfterAutofill = await pool.query(
    "SELECT sales_volume, sales_volume_tonnes, sales_revenue FROM budget_income_expense WHERE id = $1",
    [budgetEntry.id],
  );
  assert.ok(
    Math.abs(Number(storedBudgetAfterAutofill.rows[0].sales_volume) / 1000 - expectedBudgetVolumeTonnes) < 1e-9,
  );
  assert.ok(
    Math.abs(Number(storedBudgetAfterAutofill.rows[0].sales_volume_tonnes) - expectedBudgetVolumeTonnes) < 1e-9,
  );
  assert.equal(Number(storedBudgetAfterAutofill.rows[0].sales_revenue), 777);

  const budgetBackfillRun = spawnSync(
    process.execPath,
    ["scripts/backfill-budget-sales-volume.mjs", "--target=development", "--apply"],
    { cwd: process.cwd(), env: process.env, encoding: "utf8" },
  );
  assert.equal(budgetBackfillRun.status, 0, budgetBackfillRun.stderr);
  const budgetBackfillReport = JSON.parse(budgetBackfillRun.stdout);
  assert.equal(budgetBackfillReport.activeBudgetRows, 1);
  assert.equal(budgetBackfillReport.rowsRecalculated, 1);
  const storedBudgetAfterBackfill = await pool.query(
    "SELECT sales_volume, sales_volume_tonnes, sales_revenue FROM budget_income_expense WHERE id = $1",
    [budgetEntry.id],
  );
  assert.ok(
    Math.abs(Number(storedBudgetAfterBackfill.rows[0].sales_volume_tonnes) - expectedBudgetVolumeTonnes) < 1e-9,
  );
  assert.ok(
    Math.abs(Number(storedBudgetAfterBackfill.rows[0].sales_volume) / 1000 - expectedBudgetVolumeTonnes) < 1e-9,
  );
  assert.equal(Number(storedBudgetAfterBackfill.rows[0].sales_revenue), 777);

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
  assert.equal(Number(optUpdated.quantityTonnes), 0.025);
  assert.equal(optUpdated.quantityKg, undefined);
  assert.equal(Number(optUpdated.purchasePricePerTonne), 10000);
  assert.equal(Number(optUpdated.salePricePerTonne), 15000);
  assert.equal(optUpdated.purchasePrice, undefined);
  assert.equal(optUpdated.salePrice, undefined);
  assert.equal(Number(optUpdated.profit), 125);
  const storedOptAfterUpdate = await pool.query(
    "SELECT quantity_tonnes, quantity_kg FROM opt WHERE id = $1",
    [optCreated.id],
  );
  assert.equal(Number(storedOptAfterUpdate.rows[0].quantity_tonnes), 0.025);
  assert.equal(Number(storedOptAfterUpdate.rows[0].quantity_kg), 25);
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
  assert.equal(Number(activeOpt.quantityTonnes), 0.025);
  assert.equal(activeOpt.quantityKg, undefined);
  assert.equal(Number(activeOpt.purchasePricePerTonne), 10000);
  assert.equal(Number(activeOpt.salePricePerTonne), 15000);
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
      quantityTonnes: 0.02,
      purchasePricePerTonne: 10_000,
      totalCost: 200,
      costPerTonne: 10_000,
      isDraft: false,
      notes: "critical flow warehouse transfer",
    },
  });
  const transferId = transferCreated.id;
  assert.ok(transferId, "warehouse transfer is created");
  assert.equal(transferCreated.quantityTonnes, 0.02);
  assert.equal(transferCreated.quantityKg, undefined);
  assert.equal(Number(transferCreated.purchasePricePerTonne), 10_000);
  assert.equal(Number(transferCreated.purchaseAmount), 200);
  const storedMovement = await pool.query(
    `SELECT quantity_kg, quantity_tonnes, purchase_price,
            purchase_price_per_tonne, total_cost, cost_per_kg, cost_per_tonne
     FROM movement WHERE id = $1`,
    [transferId],
  );
  assert.equal(Number(storedMovement.rows[0].quantity_kg), 20);
  assert.equal(Number(storedMovement.rows[0].quantity_tonnes), 0.02);
  assert.equal(Number(storedMovement.rows[0].purchase_price), 10);
  assert.equal(Number(storedMovement.rows[0].purchase_price_per_tonne), 10_000);
  assert.equal(Number(storedMovement.rows[0].total_cost), 200);
  assert.equal(Number(storedMovement.rows[0].cost_per_kg), 10);
  assert.equal(Number(storedMovement.rows[0].cost_per_tonne), 10_000);
  const listedMovements = await api("/api/movement?pageSize=500");
  const listedTransfer = listedMovements.data.find(
    (item) => item.id === transferId,
  );
  assert.equal(listedTransfer.quantityTonnes, 0.02);
  assert.equal(listedTransfer.quantityKg, undefined);
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
      quantityTonnes: 0.025,
      totalCost: 250,
      costPerTonne: 10_000,
      isDraft: false,
      notes: "critical flow warehouse transfer edited retroactively",
    },
  });
  assert.equal(transferUpdated.id, transferId);
  assert.equal(transferUpdated.quantityTonnes, 0.025);
  assert.equal(transferUpdated.quantityKg, undefined);
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
      `INSERT INTO equipments
         (name, current_balance, current_balance_tonnes, average_cost)
       VALUES ('critical-flow-transfer-equipment', 0, 0.00000, 0)
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
      quantityTonnes: 0.01,
      totalCost: 100,
      costPerTonne: 10_000,
      isDraft: false,
      notes: "critical flow warehouse to equipment",
    },
  });
  const equipmentTransferId = equipmentTransferCreated.id;
  assert.ok(equipmentTransferId, "warehouse-to-equipment transfer is created");
  assert.equal(equipmentTransferCreated.quantityTonnes, 0.01);
  assert.equal(equipmentTransferCreated.quantityKg, undefined);
  assert.equal(Number(equipmentTransferCreated.costPerTonne), 10_000);
  const storedEquipmentTransfer = await pool.query(
    `SELECT quantity_kg, quantity_tonnes, cost_per_kg, cost_per_tonne, total_cost
     FROM equipment_movement WHERE id = $1`,
    [equipmentTransferId],
  );
  assert.equal(Number(storedEquipmentTransfer.rows[0].quantity_kg), 10);
  assert.equal(Number(storedEquipmentTransfer.rows[0].quantity_tonnes), 0.01);
  assert.equal(Number(storedEquipmentTransfer.rows[0].cost_per_kg), 10);
  assert.equal(Number(storedEquipmentTransfer.rows[0].cost_per_tonne), 10_000);
  assert.equal(Number(storedEquipmentTransfer.rows[0].total_cost), 100);
  const listedEquipmentMovements = await api(
    "/api/equipment-movement?pageSize=500",
  );
  const listedEquipmentTransfer = listedEquipmentMovements.items.find(
    (item) => item.id === equipmentTransferId,
  );
  assert.equal(listedEquipmentTransfer.quantityTonnes, 0.01);
  assert.equal(listedEquipmentTransfer.quantityKg, undefined);
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

  const equipmentTransferUpdated = await api(`/api/equipment-movement/${equipmentTransferId}`, {
    method: "PATCH",
    body: {
      movementDate: "2026-10-06T09:00:00.000Z",
      movementType: "storage_to_tzk",
      productType: "kerosene",
      nomenclatureId: keroseneNomenclature.id,
      fromWarehouseId: warehouse.id,
      toEquipmentId: transferEquipment.id,
      quantityTonnes: 0.015,
      totalCost: 150,
      costPerTonne: 10_000,
      isDraft: false,
      notes: "critical flow warehouse to equipment edited retroactively",
    },
  });
  assert.equal(equipmentTransferUpdated.quantityTonnes, 0.015);
  assert.equal(equipmentTransferUpdated.quantityKg, undefined);
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
    `SELECT transaction_type, quantity, quantity_tonnes, sum, deleted_at
     FROM equipment_transactions WHERE id = $1`,
    [equipmentTransferRecord.transactionId],
  );
  assert.equal(equipmentTransferEquipmentRow.rows.length, 1);
  assert.equal(equipmentTransferEquipmentRow.rows[0].transaction_type, "transfer_in");
  assert.equal(Number(equipmentTransferEquipmentRow.rows[0].quantity), 15);
  assert.equal(Number(equipmentTransferEquipmentRow.rows[0].quantity_tonnes), 0.015);
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
    Math.abs(Number(equipmentReturnRecord.costPerTonne) - 10_000) < 0.011,
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

test("warehouse inventory endpoint accepts tonnes and preserves kg compatibility mirrors", async () => {
  const warehouseId = (
    await pool.query(
      `INSERT INTO warehouses
         (name, current_balance, current_balance_tonnes, average_cost,
          pvkj_balance, pvkj_balance_tonnes, pvkj_average_cost)
       VALUES ('warehouse-inventory-tonne-check', 1000, 1.00000, 10, 0, 0, 0)
       RETURNING id`,
    )
  ).rows[0].id;
  await pool.query(
    `INSERT INTO warehouse_transactions
       (warehouse_id, transaction_type, product_type, quantity, quantity_tonnes,
        source_type, balance_before, balance_before_tonnes, balance_after,
        balance_after_tonnes, average_cost_before, average_cost_after, sum, price,
        transaction_date)
     VALUES ($1, 'receipt', 'kerosene', 1000, 1.00000, 'inventory_test_seed',
             0, 0.00000, 1000, 1.00000, 0, 10, 10000, 10,
             '2026-10-01T00:00:00.000Z')`,
    [warehouseId],
  );

  await api(`/api/warehouses/${warehouseId}/inventory`, {
    method: "POST",
    body: {
      productType: "kerosene",
      targetDate: "2026-10-02",
      targetBalanceTonnes: 1.23456,
      targetAverageCostPerTonne: 12345.67,
    },
  });
  await waitForCompletedQueue(
    "recalculation_queue",
    "warehouse_id",
    warehouseId,
    "kerosene",
  );

  const persisted = await pool.query(
    `SELECT
       w.current_balance,
       w.current_balance_tonnes,
       tx.quantity,
       tx.quantity_tonnes,
       tx.balance_before,
       tx.balance_before_tonnes,
       tx.balance_after,
       tx.balance_after_tonnes,
       tx.sum,
       tx.price,
       tx.average_cost_after
     FROM warehouses AS w
     JOIN warehouse_transactions AS tx ON tx.warehouse_id = w.id
     WHERE w.id = $1 AND tx.source_type = 'inventory'
     ORDER BY tx.created_at DESC, tx.id DESC
     LIMIT 1`,
    [warehouseId],
  );
  const row = persisted.rows[0];
  assert.ok(row, "inventory movement is persisted");
  assert.equal(Number(row.current_balance_tonnes), 1.23456);
  assert.equal(Number(row.current_balance), 1234.56);
  assert.equal(Number(row.quantity_tonnes), 0.23456);
  assert.equal(Number(row.quantity), 234.56);
  assert.equal(Number(row.balance_before_tonnes), 1);
  assert.equal(Number(row.balance_before), 1000);
  assert.equal(Number(row.balance_after_tonnes), 1.23456);
  assert.equal(Number(row.balance_after), 1234.56);
  assert.equal(Number(row.average_cost_after), 12.34567);
  assert.ok(Number.isFinite(Number(row.sum)));
  assert.ok(Number.isFinite(Number(row.price)));
});
