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
  wholesaleDeliveryBaseName: `ui-wholesale-delivery-base-${runId}`,
  wholesaleLocationBaseName: `ui-wholesale-location-base-${runId}`,
  inactiveTariffSourceBaseName: `ui-inactive-tariff-source-base-${runId}`,
  inactiveTariffDestinationBaseName: `ui-inactive-tariff-destination-base-${runId}`,
  warehouseTariffSourceBaseName: `ui-warehouse-tariff-source-base-${runId}`,
  warehouseTariffDestinationBaseName: `ui-warehouse-tariff-destination-base-${runId}`,
  abroadBaseName: `ui-abroad-base-${runId}`,
  supplierName: `ui-smoke-supplier-${runId}`,
  mixedSupplierName: `ui-mixed-supplier-${runId}`,
  inactiveTariffSupplierName: `ui-inactive-tariff-supplier-${runId}`,
  warehouseSupplierName: `ui-warehouse-supplier-${runId}`,
  warehouseRefuelingSupplierName: `ui-warehouse-refueling-supplier-${runId}`,
  foreignSupplierName: `ui-foreign-supplier-${runId}`,
  foreignIntermediaryName: `ui-foreign-intermediary-${runId}`,
  buyerName: `ui-smoke-buyer-${runId}`,
  wholesaleBuyerName: `ui-wholesale-buyer-${runId}`,
  foreignBuyerName: `ui-foreign-buyer-${runId}`,
  supplierContractName: `ui-supplier-contract-${runId}`,
  supplierContractNumber: `S-${runId.slice(0, 8)}`,
  mixedSupplierContractName: `ui-mixed-supplier-contract-${runId}`,
  mixedSupplierContractNumber: `MS-${runId.slice(0, 8)}`,
  buyerContractName: `ui-buyer-contract-${runId}`,
  buyerContractNumber: `B-${runId.slice(0, 8)}`,
  carrierContractName: `ui-carrier-contract-${runId}`,
  carrierContractNumber: `C-${runId.slice(0, 8)}`,
  warehouseName: `ui-smoke-warehouse-${runId}`,
  refuelingNote: `ui-smoke-refueling-${runId}`,
  multiProductRefuelingNote: `ui-multi-product-refueling-${runId}`,
  optPriceDraftNote: `ui-opt-price-draft-${runId}`,
  optPriceDraftEditedNote: `ui-opt-price-draft-edited-${runId}`,
  movementNote: `ui-smoke-movement-${runId}`,
  legacyMovementNote: `ui-legacy-movement-${runId}`,
  operationalWarehouseName: `ui-operations-warehouse-${runId}`,
  transferWarehouseName: `ui-operations-transfer-warehouse-${runId}`,
  warehouseSupplierWarehouseName: `ui-wholesale-supplier-warehouse-${runId}`,
  warehouseRefuelingWarehouseName: `ui-refueling-supplier-warehouse-${runId}`,
  deliveryLocationName: `ui-wholesale-delivery-location-${runId}`,
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
  warehouseRefuelingFirstReceiptNote: `ui-refueling-first-receipt-${runId}`,
  warehouseRefuelingSecondReceiptNote: `ui-refueling-second-receipt-${runId}`,
  warehouseRefuelingPvkjReceiptNote: `ui-refueling-pvkj-receipt-${runId}`,
  warehousePriorRefuelingNote: `ui-warehouse-prior-refueling-${runId}`,
  warehouseMultiProductRefuelingNote: `ui-warehouse-multi-refueling-${runId}`,
  foreignRefuelingNote: `ui-foreign-refueling-${runId}`,
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
  await pool.query(
    `INSERT INTO currencies (code, name, symbol, is_active)
     VALUES ('RUB', 'Российский рубль', '₽', true),
            ('USD', 'Доллар США', '$', true),
            ('EUR', 'Евро', '€', true)
     ON CONFLICT (code) DO NOTHING`,
  );
  const bases = await pool.query(
    `INSERT INTO bases (name, base_type)
     VALUES ($1, 'refueling'),
            ($2, 'wholesale'),
            ($3, 'abroad'),
            ($4, 'wholesale'),
            ($5, 'wholesale'),
            ($6, 'wholesale'),
            ($7, 'wholesale'),
            ($8, 'wholesale'),
            ($9, 'wholesale')
     RETURNING id, name`,
    [
      fixtures.baseName,
      fixtures.wholesaleBaseName,
      fixtures.abroadBaseName,
      fixtures.wholesaleDeliveryBaseName,
      fixtures.wholesaleLocationBaseName,
      fixtures.inactiveTariffSourceBaseName,
      fixtures.inactiveTariffDestinationBaseName,
      fixtures.warehouseTariffSourceBaseName,
      fixtures.warehouseTariffDestinationBaseName,
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
  const inactiveTariffSupplier = await pool.query(
    "INSERT INTO suppliers (name) VALUES ($1) RETURNING id",
    [fixtures.inactiveTariffSupplierName],
  );
  const warehouseSupplier = await pool.query(
    "INSERT INTO suppliers (name, is_warehouse) VALUES ($1, true) RETURNING id",
    [fixtures.warehouseSupplierName],
  );
  const warehouseRefuelingSupplier = await pool.query(
    "INSERT INTO suppliers (name, is_warehouse) VALUES ($1, true) RETURNING id",
    [fixtures.warehouseRefuelingSupplierName],
  );
  const foreignSupplier = await pool.query(
    "INSERT INTO suppliers (name, is_foreign) VALUES ($1, true) RETURNING id",
    [fixtures.foreignSupplierName],
  );
  await pool.query(
    "INSERT INTO suppliers (name, is_intermediary) VALUES ($1, true)",
    [fixtures.foreignIntermediaryName],
  );
  await pool.query(
    `INSERT INTO supplier_bases (supplier_id, base_id)
     VALUES ($1, $2), ($3, $4), ($3, $5), ($6, $7), ($8, $9),
            ($10, $11), ($12, $13)`,
    [
      supplier.rows[0].id,
      basisIds[fixtures.baseName],
      mixedSupplier.rows[0].id,
      basisIds[fixtures.baseName],
      basisIds[fixtures.wholesaleBaseName],
      foreignSupplier.rows[0].id,
      basisIds[fixtures.abroadBaseName],
      inactiveTariffSupplier.rows[0].id,
      basisIds[fixtures.inactiveTariffSourceBaseName],
      warehouseSupplier.rows[0].id,
      basisIds[fixtures.warehouseTariffSourceBaseName],
      warehouseRefuelingSupplier.rows[0].id,
      basisIds[fixtures.baseName],
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
     VALUES ($1, $2), ($3, $4), ($5, $6),
            ($3, $7), ($3, $8), ($3, $9)`,
    [
      buyer.rows[0].id,
      basisIds[fixtures.baseName],
      wholesaleBuyer.rows[0].id,
      basisIds[fixtures.wholesaleDeliveryBaseName],
      foreignBuyer.rows[0].id,
      basisIds[fixtures.abroadBaseName],
      basisIds[fixtures.wholesaleLocationBaseName],
      basisIds[fixtures.inactiveTariffDestinationBaseName],
      basisIds[fixtures.warehouseTariffDestinationBaseName],
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
  const warehouseSupplierWarehouse = await pool.query(
    `INSERT INTO warehouses
       (name, current_balance_tonnes, average_cost_per_tonne,
        pvkj_balance_tonnes, pvkj_average_cost_per_tonne, equipment_type,
        supplier_id)
     VALUES ($1, 100, 20000, 0, 0, 'lik', $2)
     RETURNING id`,
    [fixtures.warehouseSupplierWarehouseName, warehouseSupplier.rows[0].id],
  );
  const warehouseRefuelingWarehouse = await pool.query(
    `INSERT INTO warehouses
       (name, current_balance_tonnes, average_cost_per_tonne,
        pvkj_balance_tonnes, pvkj_average_cost_per_tonne, equipment_type,
        supplier_id)
     VALUES ($1, 0, 0, 0, 0, 'common', $2)
     RETURNING id`,
    [
      fixtures.warehouseRefuelingWarehouseName,
      warehouseRefuelingSupplier.rows[0].id,
    ],
  );
  await pool.query(
    "INSERT INTO warehouse_bases (warehouse_id, base_id) VALUES ($1, $2)",
    [
      warehouseSupplierWarehouse.rows[0].id,
      basisIds[fixtures.warehouseTariffSourceBaseName],
    ],
  );
  await pool.query(
    "INSERT INTO warehouse_bases (warehouse_id, base_id) VALUES ($1, $2)",
    [warehouseRefuelingWarehouse.rows[0].id, basisIds[fixtures.baseName]],
  );
  await pool.query(
    "UPDATE warehouses SET supplier_id = $1 WHERE id = $2",
    [supplier.rows[0].id, operationalWarehouses[0].rows[0].id],
  );
  const carrier = await pool.query(
    "INSERT INTO logistics_carriers (name) VALUES ($1) RETURNING id",
    [fixtures.carrierName],
  );
  const deliveryLocation = await pool.query(
    `INSERT INTO logistics_delivery_locations (name, base_id)
     VALUES ($1, $2)
     RETURNING id`,
    [
      fixtures.deliveryLocationName,
      basisIds[fixtures.wholesaleLocationBaseName],
    ],
  );
  await pool.query(
    `INSERT INTO delivery_cost
       (carrier_id, from_entity_type, from_entity_id, from_location,
        to_entity_type, to_entity_id, to_location, cost_per_tonne)
     VALUES ($1, 'base', $2, $3, 'warehouse', $4, $5, 0),
            ($1, 'base', $6, $7, 'warehouse', $4, $5, 250),
            ($1, 'base', $6, $7, 'base', $8, $9, 475)`,
    [
      carrier.rows[0].id,
      basisIds[fixtures.baseName],
      fixtures.baseName,
      operationalWarehouses[1].rows[0].id,
      fixtures.transferWarehouseName,
      basisIds[fixtures.wholesaleBaseName],
      fixtures.wholesaleBaseName,
      basisIds[fixtures.wholesaleDeliveryBaseName],
      fixtures.wholesaleDeliveryBaseName,
    ],
  );
  await pool.query(
    `INSERT INTO delivery_cost
       (carrier_id, from_entity_type, from_entity_id, from_location,
        to_entity_type, to_entity_id, to_location, cost_per_tonne, is_active)
     VALUES
       ($1, 'base', $2, $3, 'delivery_location', $4, $5, 625, true),
       ($1, 'warehouse', $6, $7, 'base', $8, $9, 525, true),
       ($1, 'base', $10, $11, 'base', $12, $13, 875, false)`,
    [
      carrier.rows[0].id,
      basisIds[fixtures.wholesaleBaseName],
      fixtures.wholesaleBaseName,
      deliveryLocation.rows[0].id,
      fixtures.deliveryLocationName,
      warehouseSupplierWarehouse.rows[0].id,
      fixtures.warehouseSupplierWarehouseName,
      basisIds[fixtures.warehouseTariffDestinationBaseName],
      fixtures.warehouseTariffDestinationBaseName,
      basisIds[fixtures.inactiveTariffSourceBaseName],
      fixtures.inactiveTariffSourceBaseName,
      basisIds[fixtures.inactiveTariffDestinationBaseName],
      fixtures.inactiveTariffDestinationBaseName,
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
       (contract_name, contract_number, contract_date, supplier_id)
     VALUES ($1, $2, '2026-01-01', $3)`,
    [
      fixtures.mixedSupplierContractName,
      fixtures.mixedSupplierContractNumber,
      mixedSupplier.rows[0].id,
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
    `INSERT INTO movement
       (movement_date, movement_type, product_type, nomenclature_id,
        supplier_id, basis, basis_id, to_warehouse_id, quantity_tonnes,
        input_mode, is_draft, notes)
     SELECT '2026-10-29', 'supply', 'kerosene', NULL,
            s.id, b.name, b.id, w.id, 0.25, 'tonnes', true, $1
     FROM suppliers s, bases b, warehouses w
     WHERE s.name = $2 AND b.name = $3 AND w.name = $4`,
    [
      fixtures.legacyMovementNote,
      fixtures.supplierName,
      fixtures.baseName,
      fixtures.operationalWarehouseName,
    ],
  );
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
       ('pvkj', $1, 'wholesale', 'supplier', $2, $3, $4,
        ARRAY['{"price":12000}'], '2026-10-01', '2026-10-31',
        'tonne', 'tonne', false),
       ('pvkj', $5, 'refueling', 'buyer', $2, $3, $6,
        ARRAY['{"price":18000}'], '2026-10-01', '2026-10-31',
        'tonne', 'tonne', false),
       ('service', $7, 'refueling', 'supplier', $2, $3, $8,
        ARRAY['{"price":1500}'], '2026-10-01', '2026-10-31',
        'tonne', 'tonne', false),
       ('service', $5, 'refueling', 'buyer', $2, $3, $8,
        ARRAY['{"price":2500}'], '2026-10-01', '2026-10-31',
        'tonne', 'tonne', false)`,
    [
      supplier.rows[0].id,
      fixtures.baseName,
      basisIds[fixtures.baseName],
      nomenclatureIds.pvkj,
      buyer.rows[0].id,
      nomenclatureIds.pvkj,
      warehouseRefuelingSupplier.rows[0].id,
      nomenclatureIds.service,
    ],
  );
  await pool.query(
    `INSERT INTO prices
       (product_type, counterparty_id, counterparty_type, counterparty_role,
        basis, basis_id, nomenclature_id, price_values, date_from, date_to,
        volume_unit, price_unit, contract_limit_enabled)
     VALUES
       ('kerosene', $1, 'wholesale', 'supplier', $2, $3, $4,
        ARRAY['{"price":30000}', '{"price":31000}'], '2026-10-01', '2026-10-31',
        'tonne', 'tonne', false),
       ('kerosene', $5, 'wholesale', 'buyer', $6, $7, $4,
        ARRAY['{"price":35000}', '{"price":36000}'], '2026-10-01', '2026-10-31',
        'tonne', 'tonne', false)`,
    [
      mixedSupplier.rows[0].id,
      fixtures.wholesaleBaseName,
      basisIds[fixtures.wholesaleBaseName],
      nomenclatureIds.kerosene,
      wholesaleBuyer.rows[0].id,
      fixtures.wholesaleDeliveryBaseName,
      basisIds[fixtures.wholesaleDeliveryBaseName],
    ],
  );
  await pool.query(
    `INSERT INTO prices
       (product_type, counterparty_id, counterparty_type, counterparty_role,
        basis, basis_id, nomenclature_id, price_values, date_from, date_to,
        volume_unit, price_unit, contract_limit_enabled)
     SELECT 'kerosene', s.id, 'abroad', 'supplier', b.name, b.id, n.id,
             ARRAY['{"price":42000}', '{"price":43000}'],
             '2026-10-01', '2026-10-31',
            'tonne', 'tonne', false
     FROM suppliers s, bases b, nomenclature n
     WHERE s.name = $1 AND b.name = $2 AND n.id = $3`,
    [
      fixtures.foreignSupplierName,
      fixtures.abroadBaseName,
      nomenclatureIds.kerosene,
    ],
  );
  await pool.query(
    `INSERT INTO prices
       (product_type, counterparty_id, counterparty_type, counterparty_role,
        basis, basis_id, nomenclature_id, price_values, date_from, date_to,
        volume_unit, price_unit, contract_limit_enabled)
     SELECT 'kerosene', c.id, 'abroad', 'buyer', b.name, b.id, n.id,
             ARRAY['{"price":44000}', '{"price":45000}'],
             '2026-10-01', '2026-10-31',
            'tonne', 'tonne', false
     FROM customers c, bases b, nomenclature n
     WHERE c.name = $1 AND b.name = $2 AND n.id = $3`,
    [
      fixtures.foreignBuyerName,
      fixtures.abroadBaseName,
      nomenclatureIds.kerosene,
    ],
  );
  await pool.query(
    `INSERT INTO prices
       (product_type, counterparty_id, counterparty_type, counterparty_role,
        basis, basis_id, loading_basis_id, nomenclature_id, price_values,
        date_from, date_to, volume_unit, price_unit, contract_limit_enabled)
     SELECT 'kerosene', c.id, 'transportation', 'buyer', delivery.name,
            delivery.id, loading.id, n.id,
             ARRAY['{"price":46000}', '{"price":47000}'],
             '2026-10-01', '2026-10-31',
            'tonne', 'tonne', false
     FROM customers c, bases delivery, bases loading, nomenclature n
     WHERE c.name = $1 AND delivery.name = $2 AND loading.name = $3
       AND n.id = $4`,
    [
      fixtures.wholesaleBuyerName,
      fixtures.wholesaleDeliveryBaseName,
      fixtures.wholesaleBaseName,
      nomenclatureIds.kerosene,
    ],
  );
}

async function cleanUiFixtures() {
  const [
    refuelings,
    abroadRefuelings,
    movements,
    equipmentMovements,
    optDeals,
  ] = await Promise.all([
    pool.query(
      "SELECT id FROM aircraft_refueling WHERE notes = ANY($1::text[])",
      [[
        fixtures.refuelingNote,
        fixtures.multiProductRefuelingNote,
        fixtures.warehousePriorRefuelingNote,
        fixtures.warehouseMultiProductRefuelingNote,
        fixtures.finalRefuelingNote,
      ]],
    ),
    pool.query(
      "SELECT id FROM refueling_abroad WHERE notes = $1",
      [fixtures.foreignRefuelingNote],
    ),
    pool.query(
      "SELECT id FROM movement WHERE notes = ANY($1::text[])",
      [[
        fixtures.movementNote,
        fixtures.legacyMovementNote,
        fixtures.receiptNote,
        fixtures.secondReceiptNote,
        fixtures.warehouseRefuelingFirstReceiptNote,
        fixtures.warehouseRefuelingSecondReceiptNote,
        fixtures.warehouseRefuelingPvkjReceiptNote,
        fixtures.warehouseTransferNote,
      ]],
    ),
    pool.query(
      "SELECT id FROM equipment_movement WHERE notes = $1",
      [fixtures.equipmentTransferNote],
    ),
    pool.query(
      "SELECT id FROM opt WHERE notes = ANY($1::text[])",
      [[fixtures.optPriceDraftNote, fixtures.optPriceDraftEditedNote]],
    ),
  ]);
  const entityIds = [
    ...refuelings.rows.map((row) => row.id),
    ...abroadRefuelings.rows.map((row) => row.id),
    ...movements.rows.map((row) => row.id),
    ...equipmentMovements.rows.map((row) => row.id),
    ...optDeals.rows.map((row) => row.id),
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
  await pool.query("DELETE FROM opt WHERE id = ANY($1::uuid[])", [
    optDeals.rows.map((row) => row.id),
  ]);
  await pool.query("DELETE FROM refueling_abroad WHERE id = ANY($1::uuid[])", [
    abroadRefuelings.rows.map((row) => row.id),
  ]);
  if (movementIds.length) {
    await pool.query(
      "DELETE FROM warehouse_transactions WHERE source_type = 'movement' AND source_id = ANY($1::uuid[])",
      [movementIds],
    );
  }
  if (movements.rows.length) {
    await pool.query(
      "DELETE FROM recalculation_queue WHERE warehouse_id IN (SELECT id FROM warehouses WHERE name = ANY($1::text[]))",
      [[
        fixtures.operationalWarehouseName,
        fixtures.transferWarehouseName,
        fixtures.warehouseRefuelingWarehouseName,
      ]],
    );
  }
  await pool.query(
    "DELETE FROM counterparty_contracts WHERE contract_name = ANY($1::text[])",
    [[
      fixtures.supplierContractName,
      fixtures.mixedSupplierContractName,
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
        fixtures.inactiveTariffSupplierName,
        fixtures.warehouseSupplierName,
        fixtures.warehouseRefuelingSupplierName,
        fixtures.foreignSupplierName,
      ],
      [
        fixtures.baseName,
        fixtures.wholesaleBaseName,
        fixtures.wholesaleDeliveryBaseName,
        fixtures.wholesaleLocationBaseName,
        fixtures.inactiveTariffSourceBaseName,
        fixtures.inactiveTariffDestinationBaseName,
        fixtures.warehouseTariffSourceBaseName,
        fixtures.warehouseTariffDestinationBaseName,
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
      fixtures.warehouseSupplierWarehouseName,
      fixtures.warehouseRefuelingWarehouseName,
    ]],
  );
  await pool.query(
    `DELETE FROM supplier_bases
     WHERE supplier_id IN (SELECT id FROM suppliers WHERE name = ANY($1::text[]))`,
    [[
      fixtures.supplierName,
      fixtures.mixedSupplierName,
      fixtures.inactiveTariffSupplierName,
      fixtures.warehouseSupplierName,
      fixtures.warehouseRefuelingSupplierName,
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
    [
      fixtures.warehouseName,
      fixtures.operationalWarehouseName,
      fixtures.transferWarehouseName,
      fixtures.warehouseSupplierWarehouseName,
      fixtures.warehouseRefuelingWarehouseName,
    ],
  ]);
  await pool.query("DELETE FROM equipments WHERE name = $1", [
    fixtures.equipmentName,
  ]);
  await pool.query(
    `DELETE FROM transportation
     WHERE buyer_id IN (
       SELECT id FROM customers WHERE name = ANY($1::text[])
     )`,
    [[fixtures.wholesaleBuyerName]],
  );
  await pool.query(
    `DELETE FROM prices
     WHERE counterparty_id IN (SELECT id FROM suppliers WHERE name = ANY($1::text[]))
        OR counterparty_id IN (SELECT id FROM customers WHERE name = ANY($2::text[]))`,
    [
      [
        fixtures.supplierName,
        fixtures.mixedSupplierName,
        fixtures.inactiveTariffSupplierName,
        fixtures.warehouseSupplierName,
        fixtures.warehouseRefuelingSupplierName,
        fixtures.foreignSupplierName,
      ],
      [fixtures.buyerName, fixtures.wholesaleBuyerName, fixtures.foreignBuyerName],
    ],
  );
  await pool.query(
    "DELETE FROM delivery_cost WHERE carrier_id IN (SELECT id FROM logistics_carriers WHERE name = $1)",
    [fixtures.carrierName],
  );
  await pool.query(
    "DELETE FROM logistics_delivery_locations WHERE name = $1",
    [fixtures.deliveryLocationName],
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
    [
      fixtures.operationalWarehouseName,
      fixtures.transferWarehouseName,
      fixtures.warehouseSupplierWarehouseName,
      fixtures.warehouseRefuelingWarehouseName,
    ],
  ]);
  await pool.query("DELETE FROM suppliers WHERE name = ANY($1::text[])", [[
    fixtures.supplierName,
    fixtures.mixedSupplierName,
    fixtures.inactiveTariffSupplierName,
    fixtures.warehouseSupplierName,
    fixtures.warehouseRefuelingSupplierName,
    fixtures.foreignSupplierName,
  ]]);
  await pool.query("DELETE FROM customers WHERE name = ANY($1::text[])", [[
    fixtures.buyerName,
    fixtures.wholesaleBuyerName,
    fixtures.foreignBuyerName,
  ]]);
  await pool.query(
    "DELETE FROM bases WHERE name = ANY($1::text[])",
    [[
      fixtures.baseName,
      fixtures.wholesaleBaseName,
      fixtures.wholesaleDeliveryBaseName,
      fixtures.wholesaleLocationBaseName,
      fixtures.inactiveTariffSourceBaseName,
      fixtures.inactiveTariffDestinationBaseName,
      fixtures.warehouseTariffSourceBaseName,
      fixtures.warehouseTariffDestinationBaseName,
      fixtures.abroadBaseName,
    ]],
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
  let pageSnapshot = "";
  try {
    pageSnapshot = await cdp.evaluate(
      "document.body?.innerText?.slice(-2500) || ''",
    );
  } catch {
    // Keep the original timeout if the page is navigating or has closed.
  }
  throw new Error(
    `Timed out waiting for ${label}; last value: ${lastValue}; visible page text: ${JSON.stringify(pageSnapshot)}`,
  );
}

async function waitForStableExpression(
  cdp,
  expression,
  label,
  timeoutMs = 12_000,
  stableForMs = 450,
) {
  const deadline = Date.now() + timeoutMs;
  let stableSince = null;
  let lastValue;
  while (Date.now() < deadline) {
    try {
      lastValue = await cdp.evaluate(expression);
      if (lastValue) {
        stableSince ??= Date.now();
        if (Date.now() - stableSince >= stableForMs) return lastValue;
      } else {
        stableSince = null;
      }
    } catch {
      stableSince = null;
    }
    await delay(150);
  }
  throw new Error(
    `Timed out waiting for stable ${label}; last value: ${lastValue}`,
  );
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

function productMassInputExpression(productLabel) {
  const heading = JSON.stringify(`Объем топлива · ${productLabel}`);
  const fieldLabel = JSON.stringify("Масса (т)");
  return `(() => {
    const title = Array.from(document.querySelectorAll("*"))
      .find((node) => node.childElementCount === 0 &&
        node.textContent.trim() === ${heading});
    for (let container = title; container; container = container.parentElement) {
      const label = Array.from(container.querySelectorAll("label"))
        .find((node) => node.textContent.trim() === ${fieldLabel});
      const input = label?.parentElement?.querySelector('input[type="number"]');
      if (input) return input;
    }
    return null;
  })()`;
}

async function fillProductMassTonnes(cdp, productLabel, value) {
  const inputExpression = productMassInputExpression(productLabel);
  const expected = String(value);
  const heading = JSON.stringify(`Объем топлива · ${productLabel}`);
  await cdp.evaluate(`(() => {
    const title = Array.from(document.querySelectorAll("*"))
      .find((node) => node.childElementCount === 0 &&
        node.textContent.trim() === ${heading});
    let container = title;
    while (container && !container.querySelector('[role="switch"]')) {
      container = container.parentElement;
    }
    const toggle = container?.querySelector('[role="switch"]');
    if (toggle?.getAttribute("aria-checked") !== "true") toggle?.click();
  })()`);
  await waitForExpression(
    cdp,
    `(${inputExpression}) instanceof HTMLInputElement`,
    `${productLabel} tonnes input to be available`,
  );
  const filled = await cdp.evaluate(`(() => {
    const input = ${inputExpression};
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(input, ${JSON.stringify(expected)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return input.value;
  })()`);
  assert.equal(
    filled,
    expected,
    `Expected a tonne input for ${productLabel}`,
  );
  await waitForExpression(
    cdp,
    `(${inputExpression})?.value === ${JSON.stringify(expected)}`,
    `${productLabel} mass to update to ${expected} tonnes`,
  );
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

async function addRefuelingProduct(cdp, productLabel) {
  await clickTestId(cdp, "button-add-product");
  await waitForExpression(
    cdp,
    `Array.from(document.querySelectorAll("button")).some((button) => {
      const rect = button.getBoundingClientRect();
      return button.innerText.trim() === ${JSON.stringify(productLabel)} &&
        rect.width > 0 && rect.height > 0;
    })`,
    `the ${productLabel} option in the add-product menu`,
  );
  await clickButtonWithText(cdp, productLabel);
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
  await waitForStableExpression(
    cdp,
    `(() => {
      const button = document.querySelector('[data-testid="${addButtonTestId}"]');
      if (!button) return false;
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    })()`,
    `the visible create button on ${route}`,
  );
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

async function openRowActionForRow(cdp, rowText, actionText) {
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
      .some((item) => item.innerText.trim() === ${JSON.stringify(actionText)})`,
    `the ${actionText} action`,
  );
  await clickMenuItemWithText(cdp, actionText);
}

async function openEditMenuForRow(cdp, rowText) {
  await openRowActionForRow(cdp, rowText, "Редактировать");
}

async function openDeleteMenuForRow(cdp, rowText) {
  await openRowActionForRow(cdp, rowText, "Удалить");
}

async function openRowActionByTestId(cdp, markerTestId, actionText) {
  const selector = `[data-testid="${markerTestId}"]`;
  await waitForExpression(
    cdp,
    `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
    `table row marker ${markerTestId}`,
  );
  const opened = await cdp.evaluate(`(() => {
    const marker = document.querySelector(${JSON.stringify(selector)});
    const row = marker?.closest("tr");
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
  assert.equal(
    opened,
    true,
    `Expected an action menu for ${markerTestId}`,
  );
  await waitForExpression(
    cdp,
    `Array.from(document.querySelectorAll('[role="menuitem"]'))
      .some((item) => item.innerText.trim() === ${JSON.stringify(actionText)})`,
    `the ${actionText} action for ${markerTestId}`,
  );
  await clickMenuItemWithText(cdp, actionText);
}

async function openRowActionFromTestIds(cdp, markerTestIds, actionText) {
  const markerTestIdsJson = JSON.stringify(markerTestIds);
  await waitForExpression(
    cdp,
    `(() => {
      const markerTestIds = ${markerTestIdsJson};
      return markerTestIds.some((markerTestId) => {
        const marker = document.querySelector(
          '[data-testid="' + markerTestId + '"]',
        );
        const row = marker?.closest("tr");
        const rect = row?.getBoundingClientRect();
        return Boolean(row && rect && rect.width > 0 && rect.height > 0);
      });
    })()`,
    "a visible row from the final refueling order",
  );
  await waitForExpression(
    cdp,
    `(() => {
      const markerTestIds = ${markerTestIdsJson};
      return markerTestIds.some((markerTestId) => {
        const marker = document.querySelector(
          '[data-testid="' + markerTestId + '"]',
        );
        return Boolean(marker?.closest("tr")?.querySelector("td:last-child button"));
      });
    })()`,
    "the group action button for the final refueling order",
  );
  const openedId = await cdp.evaluate(`(() => {
    const markerTestIds = ${markerTestIdsJson};
    for (const markerTestId of markerTestIds) {
      const marker = document.querySelector(
        '[data-testid="' + markerTestId + '"]',
      );
      const row = marker?.closest("tr");
      const button = row?.querySelector("td:last-child button");
      if (!button) continue;
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
      return markerTestId.slice("refueling-row-".length);
    }
    return null;
  })()`);
  assert.ok(openedId, "Expected an actionable row in the final refueling order");
  await waitForExpression(
    cdp,
    `Array.from(document.querySelectorAll('[role="menuitem"]'))
      .some((item) => item.innerText.trim() === ${JSON.stringify(actionText)})`,
    `the ${actionText} action for the final refueling order`,
  );
  await clickMenuItemWithText(cdp, actionText);
  return openedId;
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
  { requireTask = true, productType = "kerosene", createdAfter } = {},
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
       WHERE ${ownerColumn} = $1 AND product_type = $2
         AND ($3::timestamptz IS NULL OR created_at >= $3)
       ORDER BY created_at, id`,
      [ownerId, productType, createdAfter ?? null],
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
  const operationWritePayloads = [];
  const completedOperationWriteResponses = new Map();
  const stopListening = cdp.onEvent((method, params) => {
    if (
      method === "Network.responseReceived" &&
      params.requestId &&
      params.response?.url
    ) {
      const responsePath = new URL(params.response.url).pathname;
      if (
        responsePath === "/api/refueling" ||
        responsePath.startsWith("/api/refueling/") ||
        responsePath === "/api/refueling-abroad" ||
        responsePath.startsWith("/api/refueling-abroad/") ||
        responsePath === "/api/transportation" ||
        responsePath.startsWith("/api/transportation/") ||
        /^\/api\/movement(?:\/[^/]+)?$/.test(responsePath)
      ) {
        completedOperationWriteResponses.set(params.requestId, {
          path: responsePath,
          status: params.response.status,
        });
      }
    }
    if (
      method === "Network.requestWillBeSent" &&
      ["POST", "PATCH", "PUT"].includes(params.request?.method) &&
      params.request?.postData
    ) {
      const path = new URL(params.request.url).pathname;
      if (
        path === "/api/refueling" ||
        path.startsWith("/api/refueling/") ||
        path === "/api/refueling-abroad" ||
        path.startsWith("/api/refueling-abroad/") ||
        path === "/api/transportation" ||
        path.startsWith("/api/transportation/") ||
        /^\/api\/movement(?:\/[^/]+)?$/.test(path)
      ) {
        try {
          operationWritePayloads.push({
            requestId: params.requestId,
            path,
            method: params.request.method,
            payload: JSON.parse(params.request.postData),
          });
        } catch {
          diagnostics.push(`Could not parse operation write payload for ${path}`);
        }
      }
    }
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
    await waitForExpression(
      cdp,
      `Boolean(document.querySelector('[data-testid="button-add-opt"]'))`,
      "the OPT create button after opening the page",
    );
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
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-basis"]')
        ?.innerText.includes(${JSON.stringify(fixtures.abroadBaseName)})`,
      "the first linked abroad basis automatically selected for the supplier",
    );
    const abroadBases = await getVisibleComboboxOptions(cdp, "select-basis");
    assert(abroadBases.some((text) => text.includes(fixtures.abroadBaseName)));
    assert(!abroadBases.some((text) => text.includes(fixtures.baseName)));
    assert(!abroadBases.some((text) => text.includes(fixtures.wholesaleBaseName)));
    const foreignBuyers = await getVisibleComboboxOptions(cdp, "select-buyer");
    assert(foreignBuyers.some((text) => text.includes(fixtures.foreignBuyerName)));
    assert(!foreignBuyers.some((text) => text.includes(fixtures.wholesaleBuyerName)));
    assert(!foreignBuyers.some((text) => text.includes(fixtures.buyerName)));
    await selectComboboxOption(cdp, "select-buyer", fixtures.foreignBuyerName);
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-purchase-price"]')
         ?.innerText.includes("42") &&
       document.querySelector('[data-testid="select-sale-price"]')
         ?.innerText.includes("44")`,
      "the foreign purchase and sale prices for the automatically selected basis",
    );
    const expectedForeignPriceIdRows = await pool.query(
      `SELECT
         (SELECT p.id
          FROM prices p
          JOIN suppliers s ON s.id = p.counterparty_id
          JOIN bases b ON b.id = p.basis_id
          WHERE s.name = $1 AND b.name = $2
            AND p.counterparty_type = 'abroad'
            AND p.counterparty_role = 'supplier'
            AND p.product_type = 'kerosene'
            AND p.nomenclature_id = $3
          ORDER BY p.date_from DESC LIMIT 1) AS purchase_price_id,
         (SELECT p.id
          FROM prices p
          JOIN customers c ON c.id = p.counterparty_id
          JOIN bases b ON b.id = p.basis_id
          WHERE c.name = $4 AND b.name = $2
            AND p.counterparty_type = 'abroad'
            AND p.counterparty_role = 'buyer'
            AND p.product_type = 'kerosene'
            AND p.nomenclature_id = $3
          ORDER BY p.date_from DESC LIMIT 1) AS sale_price_id`,
      [
        fixtures.foreignSupplierName,
        fixtures.abroadBaseName,
        nomenclatureIds.kerosene,
        fixtures.foreignBuyerName,
      ],
    );
    const expectedForeignPriceIds = expectedForeignPriceIdRows.rows[0];
    assert.ok(expectedForeignPriceIds?.purchase_price_id);
    assert.ok(expectedForeignPriceIds?.sale_price_id);
    await selectComboboxOption(cdp, "select-purchase-price", "43");
    await selectComboboxOption(cdp, "select-sale-price", "45");
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-purchase-price"]')
         ?.innerText.includes("43") &&
       document.querySelector('[data-testid="select-sale-price"]')
         ?.innerText.includes("45")`,
      "the second foreign purchase and sale price tiers to be selected",
    );

    await fillInput(
      cdp,
      '[data-testid="input-quantity-tonnes"]',
      "1",
    );
    await fillInput(
      cdp,
      '[data-testid="input-manual-purchase-exchange-rate"]',
      "100",
    );
    await fillInput(
      cdp,
      '[data-testid="input-manual-sale-exchange-rate"]',
      "100",
    );
    await fillInput(
      cdp,
      '[data-testid="input-notes"]',
      fixtures.foreignRefuelingNote,
    );

    await clickTestId(cdp, "button-add-chain-item");
    await clickTestId(cdp, "menu-add-intermediary");
    await selectComboboxOption(
      cdp,
      "select-intermediary-dialog",
      fixtures.foreignIntermediaryName,
    );
    await fillInput(
      cdp,
      '[data-testid="input-intermediary-rate"]',
      "2.5",
    );
    await clickTestId(cdp, "button-save-intermediary");

    await clickTestId(cdp, "button-add-chain-item");
    await clickTestId(cdp, "menu-add-bank-commission");
    await fillInput(
      cdp,
      '[data-testid="input-bank-name"]',
      `ui-bank-${runId}`,
    );
    await fillInput(
      cdp,
      '[data-testid="input-bank-commission-percent"]',
      "1.5",
    );
    await clickTestId(cdp, "button-save-bank-commission");

    await clickTestId(cdp, "button-add-chain-item");
    await clickTestId(cdp, "menu-add-exchange-rate");
    await waitForExpression(
      cdp,
      `Boolean(document.querySelector('[data-testid="select-chain-to-currency"]'))`,
      "the chain currency conversion form",
    );
    const chainFromCurrencySelectExists = await cdp.evaluate(
      `Boolean(document.querySelector('[data-testid="select-chain-from-currency"]'))`,
    );
    if (chainFromCurrencySelectExists) {
      await selectComboboxOption(
        cdp,
        "select-chain-from-currency",
        "USD",
      );
    }
    await selectComboboxOption(
      cdp,
      "select-chain-to-currency",
      "EUR",
    );
    await fillInput(
      cdp,
      '[data-testid="input-chain-exchange-rate"]',
      "0.92",
    );
    await waitForExpression(
      cdp,
      `Number(document.querySelector('[data-testid="input-chain-exchange-rate"]')?.value) === 0.92`,
      "the chain exchange rate to show 0.92 before saving",
    );
    await clickTestId(cdp, "button-save-chain-exchange-rate");

    await clickTestId(cdp, "button-submit-refueling");
    const createdForeignRefueling = await waitForDatabaseRow(
      `SELECT * FROM refueling_abroad WHERE notes = $1`,
      [fixtures.foreignRefuelingNote],
      "the final foreign refueling with intermediary, bank, and chain rate",
      (row) =>
        !row.deleted_at &&
        row.is_draft === false &&
        Number(row.quantity_tonnes) === 1 &&
        Number(row.purchase_amount_usd) === 43_000 &&
        Number(row.sale_amount_usd) === 45_000 &&
        Number(row.intermediary_commission_usd) === 1_125 &&
        Number(row.bank_commission_usd) === 645 &&
        Number(row.profit_usd) === 230 &&
        Number(row.profit_rub) === 23_000,
      45_000,
    );
    assert.equal(
      createdForeignRefueling.purchase_price_id,
      expectedForeignPriceIds.purchase_price_id,
    );
    assert.equal(Number(createdForeignRefueling.purchase_price_index), 1);
    assert.equal(
      createdForeignRefueling.sale_price_id,
      expectedForeignPriceIds.sale_price_id,
    );
    assert.equal(Number(createdForeignRefueling.sale_price_index), 1);
    const foreignCreatePayload = operationWritePayloads
      .filter(
        (entry) =>
          entry.path === "/api/refueling-abroad" && entry.method === "POST",
      )
      .at(-1)?.payload;
    assert.ok(
      foreignCreatePayload,
      "capture the foreign refueling create payload",
    );
    assert.equal(
      foreignCreatePayload.purchasePriceId,
      expectedForeignPriceIds.purchase_price_id,
    );
    assert.equal(foreignCreatePayload.purchasePriceIndex, 1);
    assert.equal(
      foreignCreatePayload.salePriceId,
      expectedForeignPriceIds.sale_price_id,
    );
    assert.equal(foreignCreatePayload.salePriceIndex, 1);
    assert.equal("selectedPurchasePriceId" in foreignCreatePayload, false);
    assert.equal("selectedSalePriceId" in foreignCreatePayload, false);
    const foreignChainRows = await waitForDatabaseRow(
      `SELECT
         (SELECT COUNT(*)::int FROM refueling_abroad_intermediaries
          WHERE refueling_abroad_id = $1) AS intermediary_count,
         (SELECT COUNT(*)::int FROM refueling_abroad_bank_commissions
          WHERE refueling_abroad_id = $1) AS bank_count,
         (SELECT COUNT(*)::int FROM refueling_abroad_exchange_rates
          WHERE refueling_abroad_id = $1) AS exchange_rate_count`,
      [createdForeignRefueling.id],
      "all three foreign-refueling chain records to be saved",
      (row) =>
        row.intermediary_count === 1 &&
        row.bank_count === 1 &&
        row.exchange_rate_count === 1,
      30_000,
    );
    assert.deepEqual(foreignChainRows, {
      intermediary_count: 1,
      bank_count: 1,
      exchange_rate_count: 1,
    });
    const persistedForeignIntermediary = await pool.query(
      `SELECT intermediary_id, commission_formula, manual_commission_usd,
              commission_usd, commission_rub
       FROM refueling_abroad_intermediaries
       WHERE refueling_abroad_id = $1`,
      [createdForeignRefueling.id],
    );
    assert.equal(
      persistedForeignIntermediary.rows[0]?.commission_formula,
      "percent_sale",
    );
    assert.equal(
      persistedForeignIntermediary.rows[0]?.intermediary_id,
      (
        await pool.query("SELECT id FROM suppliers WHERE name = $1", [
          fixtures.foreignIntermediaryName,
        ])
      ).rows[0]?.id,
    );
    assert.equal(
      Number(persistedForeignIntermediary.rows[0]?.manual_commission_usd),
      2.5,
    );
    assert.equal(
      Number(persistedForeignIntermediary.rows[0]?.commission_usd),
      1_125,
    );
    assert.equal(
      Number(persistedForeignIntermediary.rows[0]?.commission_rub),
      112_500,
    );
    const persistedForeignBank = await pool.query(
      `SELECT commission_type, percent, bank_name
       FROM refueling_abroad_bank_commissions
       WHERE refueling_abroad_id = $1`,
      [createdForeignRefueling.id],
    );
    assert.deepEqual(persistedForeignBank.rows[0], {
      commission_type: "percent",
      percent: "1.5000",
      bank_name: `ui-bank-${runId}`,
    });
    const persistedForeignChainRate = await pool.query(
      `SELECT from_currency_code, to_currency_code, rate,
              from_currency_id, to_currency_id
       FROM refueling_abroad_exchange_rates
       WHERE refueling_abroad_id = $1`,
      [createdForeignRefueling.id],
    );
    assert.equal(persistedForeignChainRate.rows[0]?.from_currency_code, "RUB");
    assert.equal(persistedForeignChainRate.rows[0]?.to_currency_code, "EUR");
    assert.ok(
      Number.isFinite(Number(persistedForeignChainRate.rows[0]?.rate)),
      `Expected a persisted numeric chain rate; got ${JSON.stringify(persistedForeignChainRate.rows[0])}`,
    );
    assert.equal(Number(persistedForeignChainRate.rows[0]?.rate), 0.92);

    await fillInput(
      cdp,
      '[data-testid="input-search-refueling-abroad"]',
      fixtures.foreignSupplierName,
    );
    await openEditMenuForRow(cdp, fixtures.foreignSupplierName);
    await waitForExpression(
      cdp,
      `(() => {
        const dialog = Array.from(document.querySelectorAll('[role="dialog"]'))
          .find((item) => item.innerText.includes("Редактировать заправку"));
        return Boolean(dialog) &&
          Number(dialog.querySelector('[data-testid="input-quantity-tonnes"]')?.value) === 1 &&
          dialog.querySelector('[data-testid="select-purchase-price"]')
            ?.innerText.includes("43") &&
          dialog.querySelector('[data-testid="select-sale-price"]')
            ?.innerText.includes("45") &&
          dialog.innerText.includes(${JSON.stringify(fixtures.foreignIntermediaryName)}) &&
          dialog.innerText.includes(${JSON.stringify(`ui-bank-${runId}`)}) &&
          dialog.innerText.includes("RUB → EUR") &&
          dialog.innerText.includes("0.92");
      })()`,
    "the foreign refueling, intermediary, bank, and exchange rate to be prefilled for editing",
    );
    await fillInput(
      cdp,
      '[data-testid="input-quantity-tonnes"]',
      "1.2",
    );
    await waitForExpression(
      cdp,
      `Number(document.querySelector('[data-testid="input-quantity-tonnes"]')?.value) === 1.2`,
      "the edited foreign-refueling quantity to show 1.2 tonnes before saving",
    );
    const foreignChainUpdatePaths = [
      `/api/refueling-abroad/${createdForeignRefueling.id}/intermediaries`,
      `/api/refueling-abroad/${createdForeignRefueling.id}/chain-exchange-rates`,
      `/api/refueling-abroad/${createdForeignRefueling.id}/chain-bank-commissions`,
    ];
    const foreignChainWriteCountsBeforeEdit = new Map(
      foreignChainUpdatePaths.map((path) => [
        path,
        operationWritePayloads.filter(
          (entry) => entry.path === path && entry.method === "PUT",
        ).length,
      ]),
    );
    await clickTestId(cdp, "button-submit-refueling");
    const foreignChainWriteDeadline = Date.now() + 15_000;
    const completedForeignChainWrites = new Map();
    while (
      Date.now() < foreignChainWriteDeadline &&
      completedForeignChainWrites.size < foreignChainUpdatePaths.length
    ) {
      for (const path of foreignChainUpdatePaths) {
        const previousCount = foreignChainWriteCountsBeforeEdit.get(path);
        const newWrites = operationWritePayloads
          .filter(
            (entry) => entry.path === path && entry.method === "PUT",
          )
          .slice(previousCount);
        const completedWrite = newWrites.find(
          (entry) =>
            completedOperationWriteResponses.get(entry.requestId)?.status >=
              200 &&
            completedOperationWriteResponses.get(entry.requestId)?.status < 300,
        );
        if (completedWrite) completedForeignChainWrites.set(path, completedWrite);
      }
      if (completedForeignChainWrites.size < foreignChainUpdatePaths.length) {
        await delay(100);
      }
    }
    assert.equal(
      completedForeignChainWrites.size,
      foreignChainUpdatePaths.length,
      "all three foreign-refueling child updates must finish before checking persisted values",
    );
    for (const path of foreignChainUpdatePaths) {
      const newWrites = operationWritePayloads
        .filter((entry) => entry.path === path && entry.method === "PUT")
        .slice(foreignChainWriteCountsBeforeEdit.get(path));
      assert.equal(
        newWrites.length,
        1,
        `editing must send one update to ${path}; captured ${JSON.stringify(newWrites.map((entry) => entry.payload))}`,
      );
    }
    const foreignEditExchangeRateWrite = completedForeignChainWrites.get(
      `/api/refueling-abroad/${createdForeignRefueling.id}/chain-exchange-rates`,
    );
    assert.ok(foreignEditExchangeRateWrite);
    assert.equal(
      Number(foreignEditExchangeRateWrite.payload[0]?.rate),
      0.92,
      `the foreign exchange rate must remain in the edit request: ${JSON.stringify(foreignEditExchangeRateWrite.payload)}`,
    );
    const editedForeignRefueling = await waitForDatabaseRow(
      `SELECT * FROM refueling_abroad WHERE id = $1`,
      [createdForeignRefueling.id],
      "the edited foreign-refueling totals",
      (row) =>
        !row.deleted_at &&
        Number(row.quantity_tonnes) === 1.2 &&
        Number(row.purchase_amount_usd) === 51_600 &&
        Number(row.sale_amount_usd) === 54_000 &&
        Number(row.intermediary_commission_usd) === 1_350 &&
        Number(row.bank_commission_usd) === 774 &&
        Number(row.profit_usd) === 276 &&
        Number(row.profit_rub) === 27_600 &&
        row.purchase_price_id === expectedForeignPriceIds.purchase_price_id &&
        Number(row.purchase_price_index) === 1 &&
        row.sale_price_id === expectedForeignPriceIds.sale_price_id &&
        Number(row.sale_price_index) === 1,
      45_000,
    );
    assert.equal(editedForeignRefueling.id, createdForeignRefueling.id);
    const foreignEditPayload = operationWritePayloads
      .filter(
        (entry) =>
          entry.path === `/api/refueling-abroad/${createdForeignRefueling.id}` &&
          entry.method === "PATCH",
      )
      .at(-1)?.payload;
    assert.ok(foreignEditPayload, "capture the foreign refueling edit payload");
    assert.equal(
      foreignEditPayload.purchasePriceId,
      expectedForeignPriceIds.purchase_price_id,
    );
    assert.equal(foreignEditPayload.purchasePriceIndex, 1);
    assert.equal(
      foreignEditPayload.salePriceId,
      expectedForeignPriceIds.sale_price_id,
    );
    assert.equal(foreignEditPayload.salePriceIndex, 1);
    assert.equal("selectedPurchasePriceId" in foreignEditPayload, false);
    assert.equal("selectedSalePriceId" in foreignEditPayload, false);
    await waitForAuditOperations(createdForeignRefueling.id, ["CREATE", "UPDATE"]);
    assert.ok(
      Array.isArray(foreignEditExchangeRateWrite.payload),
      "capture the foreign exchange-rate chain edit payload",
    );
    const persistedEditedForeignChainRate = await waitForDatabaseRow(
      `SELECT rate FROM refueling_abroad_exchange_rates
       WHERE refueling_abroad_id = $1`,
      [createdForeignRefueling.id],
      "the edited foreign exchange rate to finish persisting",
      (row) => Number(row.rate) === 0.92,
    );
    assert.equal(Number(persistedEditedForeignChainRate.rate), 0.92);
    await waitForDatabaseRow(
      `SELECT commission_usd FROM refueling_abroad_intermediaries
       WHERE refueling_abroad_id = $1`,
      [createdForeignRefueling.id],
      "the edited intermediary commission to finish persisting",
      (row) => Number(row.commission_usd) === 1_350,
    );
    await waitForDatabaseRow(
      `SELECT commission_type, percent, bank_name
       FROM refueling_abroad_bank_commissions
       WHERE refueling_abroad_id = $1`,
      [createdForeignRefueling.id],
      "the edited bank commission to finish persisting",
      (row) =>
        row.commission_type === "percent" &&
        Number(row.percent) === 1.5 &&
        row.bank_name === `ui-bank-${runId}`,
    );
    const editedForeignChainCounts = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM refueling_abroad_intermediaries
          WHERE refueling_abroad_id = $1) AS intermediary_count,
         (SELECT COUNT(*)::int FROM refueling_abroad_bank_commissions
          WHERE refueling_abroad_id = $1) AS bank_count,
         (SELECT COUNT(*)::int FROM refueling_abroad_exchange_rates
          WHERE refueling_abroad_id = $1) AS exchange_rate_count`,
      [createdForeignRefueling.id],
    );
    assert.deepEqual(editedForeignChainCounts.rows[0], {
      intermediary_count: 1,
      bank_count: 1,
      exchange_rate_count: 1,
    });
    await openDeleteMenuForRow(cdp, fixtures.foreignSupplierName);
    await waitForExpression(
      cdp,
      `document.querySelector('[role="alertdialog"]')
        ?.innerText.includes("Удалить запись?")`,
      "the foreign refueling deletion confirmation",
    );
    await clickButtonWithText(cdp, "Удалить");
    await waitForDatabaseRow(
      `SELECT deleted_at FROM refueling_abroad WHERE id = $1`,
      [createdForeignRefueling.id],
      "the foreign refueling soft-deleted through the UI",
      (row) => Boolean(row.deleted_at),
    );
    await waitForAuditOperations(createdForeignRefueling.id, [
      "CREATE",
      "UPDATE",
      "DELETE",
    ]);
    const foreignDeleteAudit = await pool.query(
      `SELECT id FROM audit_log
       WHERE entity_id = $1 AND operation = 'DELETE'
       ORDER BY created_at DESC LIMIT 1`,
      [createdForeignRefueling.id],
    );
    assert.ok(foreignDeleteAudit.rows[0]?.id);
    await clickButtonWithText(cdp, "История изменений");
    const foreignAuditEntrySelector = JSON.stringify(
      `[data-testid="audit-entry-${foreignDeleteAudit.rows[0].id}"]`,
    );
    await waitForExpression(
      cdp,
      `(() => {
        const panel = Array.from(document.querySelectorAll('[role="dialog"]'))
          .find((dialog) =>
            dialog.innerText.includes("Все заправки ВС Зарубеж"));
        const entry = document.querySelector(${foreignAuditEntrySelector});
        return Boolean(
          panel &&
          document.body.innerText.includes("Откат доступен") &&
          entry &&
          Array.from(entry.querySelectorAll("button"))
          .some((button) => button.innerText.trim() === "Откатить"));
      })()`,
      "the exact foreign delete audit entry with its rollback action and restore permission",
    );
    const openedForeignRollback = await cdp.evaluate(`(() => {
      const entry = document.querySelector(${foreignAuditEntrySelector});
      const button = Array.from(entry?.querySelectorAll("button") ?? [])
        .find((item) => item.innerText.trim() === "Откатить");
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert.equal(openedForeignRollback, true);
    await waitForExpression(
      cdp,
      `document.querySelector('[role="alertdialog"]')
        ?.innerText.includes("Удалённая запись будет восстановлена со всеми данными.")`,
      "confirmation that the foreign refueling is restored with its chain",
    );
    const confirmedForeignRollback = await cdp.evaluate(`(() => {
      const dialog = document.querySelector('[role="alertdialog"]');
      const button = Array.from(dialog?.querySelectorAll("button") ?? [])
        .find((item) => item.innerText.trim() === "Откатить");
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert.equal(confirmedForeignRollback, true);
    const restoredForeignRefueling = await waitForDatabaseRow(
      `SELECT deleted_at, quantity_tonnes, purchase_amount_usd,
              sale_amount_usd, profit_usd, profit_rub,
              purchase_price_id, purchase_price_index,
              sale_price_id, sale_price_index
       FROM refueling_abroad WHERE id = $1`,
      [createdForeignRefueling.id],
      "the restored foreign refueling and its economics",
      (row) =>
        row.deleted_at === null &&
        Number(row.quantity_tonnes) === 1.2 &&
        Number(row.purchase_amount_usd) === 51_600 &&
        Number(row.sale_amount_usd) === 54_000 &&
        Number(row.profit_usd) === 276 &&
        Number(row.profit_rub) === 27_600 &&
        row.purchase_price_id === expectedForeignPriceIds.purchase_price_id &&
        Number(row.purchase_price_index) === 1 &&
        row.sale_price_id === expectedForeignPriceIds.sale_price_id &&
        Number(row.sale_price_index) === 1,
    );
    assert.equal(Number(restoredForeignRefueling.profit_usd), 276);
    await waitForAuditOperations(createdForeignRefueling.id, [
      "CREATE",
      "UPDATE",
      "DELETE",
      "RESTORE",
    ]);
    const restoredForeignChainCounts = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM refueling_abroad_intermediaries
          WHERE refueling_abroad_id = $1) AS intermediary_count,
         (SELECT COUNT(*)::int FROM refueling_abroad_bank_commissions
          WHERE refueling_abroad_id = $1) AS bank_count,
         (SELECT COUNT(*)::int FROM refueling_abroad_exchange_rates
          WHERE refueling_abroad_id = $1) AS exchange_rate_count`,
      [createdForeignRefueling.id],
    );
    assert.deepEqual(restoredForeignChainCounts.rows[0], {
      intermediary_count: 1,
      bank_count: 1,
      exchange_rate_count: 1,
    });
    const rolledBackForeignDelete = await pool.query(
      "SELECT rolled_back_at FROM audit_log WHERE id = $1",
      [foreignDeleteAudit.rows[0].id],
    );
    assert.ok(rolledBackForeignDelete.rows[0]?.rolled_back_at);
    await waitForExpression(
      cdp,
      `Array.from(document.querySelectorAll("tbody tr"))
        .some((row) => row.innerText.includes(${JSON.stringify(fixtures.foreignSupplierName)}))`,
      "the restored foreign refueling to return to the active table",
    );
    console.log(
      "UI flow passed: foreign refueling intermediary, bank, exchange-rate chain, edit, delete, and restore",
    );

    await navigateToRoute(cdp, "/transportation");
    await clickTestId(cdp, "button-add-transportation");
    await selectComboboxOption(
      cdp,
      "select-buyer",
      fixtures.wholesaleBuyerName,
    );
    await selectComboboxOption(
      cdp,
      "select-basis",
      fixtures.wholesaleBaseName,
    );
    await selectComboboxOption(
      cdp,
      "select-customer-basis",
      fixtures.wholesaleDeliveryBaseName,
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-sale-price"]')
        ?.innerText.includes("46")`,
      "the transportation service price for the selected delivery basis",
    );
    const transportationPriceRows = await pool.query(
      `SELECT p.id
       FROM prices p
       JOIN customers c ON c.id = p.counterparty_id
       JOIN bases delivery ON delivery.id = p.basis_id
       JOIN bases loading ON loading.id = p.loading_basis_id
       WHERE c.name = $1
         AND p.counterparty_type = 'transportation'
         AND p.counterparty_role = 'buyer'
         AND p.product_type = 'kerosene'
         AND p.nomenclature_id = $4
         AND delivery.name = $2
         AND loading.name = $3
       ORDER BY p.date_from DESC
       LIMIT 1`,
      [
        fixtures.wholesaleBuyerName,
        fixtures.wholesaleDeliveryBaseName,
        fixtures.wholesaleBaseName,
        nomenclatureIds.kerosene,
      ],
    );
    const expectedTransportationPriceId = transportationPriceRows.rows[0]?.id;
    assert.ok(expectedTransportationPriceId);
    await selectComboboxOption(cdp, "select-sale-price", "47");
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-sale-price"]')
        ?.innerText.includes("47")`,
      "the second transportation service price tier to be selected",
    );
    await clickTestId(cdp, "button-save-draft");
    const createdTransportationDraft = await waitForDatabaseRow(
      `SELECT id, sale_price_id, sale_price_index,
              purchase_price_id, purchase_price_index, quantity_tonnes, is_draft
       FROM transportation
       WHERE buyer_id = (SELECT id FROM customers WHERE name = $1)
         AND sale_price_id = $2 AND sale_price_index = 1
       ORDER BY created_at DESC LIMIT 1`,
      [fixtures.wholesaleBuyerName, expectedTransportationPriceId],
      "the transportation draft created with the second price tier",
      (row) =>
        row.is_draft === true &&
        row.quantity_tonnes === null &&
        row.sale_price_id === expectedTransportationPriceId &&
        Number(row.sale_price_index) === 1,
    );
    assert.equal(createdTransportationDraft.purchase_price_id, null);
    const transportationCreatePayload = operationWritePayloads
      .filter(
        (entry) =>
          entry.path === "/api/transportation" && entry.method === "POST",
      )
      .at(-1)?.payload;
    assert.ok(
      transportationCreatePayload,
      "capture the transportation create payload",
    );
    assert.equal(
      transportationCreatePayload.salePriceId,
      expectedTransportationPriceId,
    );
    assert.equal(transportationCreatePayload.salePriceIndex, 1);
    assert.equal(transportationCreatePayload.purchasePriceId, null);
    assert.equal("selectedSalePriceId" in transportationCreatePayload, false);
    assert.equal(
      "selectedPurchasePriceId" in transportationCreatePayload,
      false,
    );
    assert.equal("contractNumber" in transportationCreatePayload, false);

    await waitForExpression(
      cdp,
      `Boolean(document.querySelector(
        '[data-testid="row-transportation-${createdTransportationDraft.id}"]'
      ))`,
      "the saved transportation draft to appear in the table",
    );
    await clickTestId(
      cdp,
      `row-transportation-${createdTransportationDraft.id}`,
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-sale-price"]')
        ?.innerText.includes("47")`,
      "the saved second transportation price tier to be prefilled for editing",
    );
    await clickTestId(cdp, "button-save-draft");
    const editedTransportationDraft = await waitForDatabaseRow(
      `SELECT id, sale_price_id, sale_price_index,
              purchase_price_id, quantity_tonnes, is_draft
       FROM transportation WHERE id = $1`,
      [createdTransportationDraft.id],
      "the edited transportation draft retaining its price tier",
      (row) =>
        row.id === createdTransportationDraft.id &&
        row.is_draft === true &&
        row.quantity_tonnes === null &&
        row.sale_price_id === expectedTransportationPriceId &&
        Number(row.sale_price_index) === 1,
    );
    assert.equal(
      editedTransportationDraft.purchase_price_id,
      null,
    );
    const transportationEditPayload = operationWritePayloads
      .filter(
        (entry) =>
          entry.path === `/api/transportation/${createdTransportationDraft.id}` &&
          entry.method === "PATCH",
      )
      .at(-1)?.payload;
    assert.ok(
      transportationEditPayload,
      "capture the transportation edit payload",
    );
    assert.equal(
      transportationEditPayload.salePriceId,
      expectedTransportationPriceId,
    );
    assert.equal(transportationEditPayload.salePriceIndex, 1);
    assert.equal(transportationEditPayload.purchasePriceId, null);
    assert.equal("selectedSalePriceId" in transportationEditPayload, false);
    assert.equal(
      "selectedPurchasePriceId" in transportationEditPayload,
      false,
    );
    assert.equal("contractNumber" in transportationEditPayload, false);
    console.log(
      "UI flow passed: transportation service price ID/index saved and prefilled on edit",
    );

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
      fixtures.wholesaleDeliveryBaseName,
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
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-carrier"]')
        ?.innerText.includes(${JSON.stringify(fixtures.carrierName)}) &&
       document.body.innerText.includes("Тариф найден по маршруту базис → базис")`,
      "the base-to-base tariff and carrier automatically selected",
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-delivery-location"]')
        ?.innerText.includes("Выберите место")`,
      "no delivery location left selected for the base-to-base tariff",
    );
    await fillInput(cdp, '[data-testid="input-tonnes"]', "1");
    await waitForExpression(
      cdp,
      `document.body.innerText.includes("475")`,
      "the calculated delivery cost from the matched base-to-base tariff",
    );
    await selectComboboxOption(cdp, "select-purchase-price", "31");
    await selectComboboxOption(cdp, "select-sale-price", "36");
    await fillInput(
      cdp,
      '[data-testid="input-notes"]',
      fixtures.optPriceDraftNote,
    );
    await clickButtonWithText(cdp, "Сохранить черновик");
    const createdOptDraft = await waitForDatabaseRow(
      `SELECT id, purchase_price_id, purchase_price_index,
              sale_price_id, sale_price_index, delivery_cost,
              delivery_tariff_per_tonne, is_draft, nomenclature_id
       FROM opt WHERE notes = $1`,
      [fixtures.optPriceDraftNote],
      "the OPT draft with explicitly selected price tiers",
    );
    const optFixturePrices = await pool.query(
      `SELECT id, counterparty_role
       FROM prices
       WHERE product_type = 'kerosene'
         AND counterparty_type = 'wholesale'
         AND date_from = '2026-10-01'
         AND (
           (counterparty_role = 'supplier'
             AND basis_id = $1
             AND counterparty_id = (SELECT id FROM suppliers WHERE name = $3))
           OR
           (counterparty_role = 'buyer'
             AND basis_id = $2
             AND counterparty_id = (SELECT id FROM customers WHERE name = $4))
         )`,
      [
        basisIds[fixtures.wholesaleBaseName],
        basisIds[fixtures.wholesaleDeliveryBaseName],
        fixtures.mixedSupplierName,
        fixtures.wholesaleBuyerName,
      ],
    );
    const expectedPurchasePriceId = optFixturePrices.rows.find(
      (price) => price.counterparty_role === "supplier",
    )?.id;
    const expectedSalePriceId = optFixturePrices.rows.find(
      (price) => price.counterparty_role === "buyer",
    )?.id;
    assert.ok(expectedPurchasePriceId, "fixture purchase price should exist");
    assert.ok(expectedSalePriceId, "fixture sale price should exist");
    assert.equal(createdOptDraft.purchase_price_id, expectedPurchasePriceId);
    assert.equal(Number(createdOptDraft.purchase_price_index), 1);
    assert.equal(createdOptDraft.sale_price_id, expectedSalePriceId);
    assert.equal(Number(createdOptDraft.sale_price_index), 1);
    assert.equal(Number(createdOptDraft.delivery_cost), 475);
    assert.equal(Number(createdOptDraft.delivery_tariff_per_tonne), 475);
    assert.equal(createdOptDraft.is_draft, true);
    assert.equal(createdOptDraft.nomenclature_id, nomenclatureIds.kerosene);
    await waitForAuditOperations(createdOptDraft.id, ["CREATE"]);
    await waitForExpression(
      cdp,
      `!document.querySelector('[role="dialog"][data-state="open"]')`,
      "the OPT draft form to close after creation",
    );

    await fillInput(
      cdp,
      '[data-testid="input-search-opt"]',
      fixtures.mixedSupplierName,
    );
    await openEditMenuForRow(cdp, fixtures.mixedSupplierName);
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-purchase-price"]')
        ?.innerText.includes("31")`,
      "the selected purchase price tier in the OPT edit form",
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-sale-price"]')
        ?.innerText.includes("36")`,
      "the selected sale price tier in the OPT edit form",
    );
    await fillInput(
      cdp,
      '[data-testid="input-notes"]',
      fixtures.optPriceDraftEditedNote,
    );
    await clickButtonWithText(cdp, "Сохранить черновик");
    const editedOptDraft = await waitForDatabaseRow(
      `SELECT id, purchase_price_id, purchase_price_index,
              sale_price_id, sale_price_index, delivery_cost,
              delivery_tariff_per_tonne, is_draft, nomenclature_id
       FROM opt WHERE notes = $1`,
      [fixtures.optPriceDraftEditedNote],
      "the edited OPT draft retaining its selected price tiers",
      (row) =>
        row.id === createdOptDraft.id &&
        row.purchase_price_id === expectedPurchasePriceId &&
        Number(row.purchase_price_index) === 1 &&
        row.sale_price_id === expectedSalePriceId &&
        Number(row.sale_price_index) === 1 &&
        Number(row.delivery_cost) === 475 &&
        Number(row.delivery_tariff_per_tonne) === 475,
    );
    assert.equal(editedOptDraft.is_draft, true);
    assert.equal(editedOptDraft.nomenclature_id, nomenclatureIds.kerosene);
    await waitForAuditOperations(editedOptDraft.id, ["CREATE", "UPDATE"]);
    await waitForExpression(
      cdp,
      `!document.querySelector('[role="dialog"][data-state="open"]')`,
      "the OPT edit form to close after saving",
    );

    await waitForStableExpression(
      cdp,
      `Boolean(document.querySelector('[data-testid="button-add-opt"]'))`,
      "the OPT create button after closing the edit form",
    );
    await clickTestId(cdp, "button-add-opt");
    await selectComboboxOption(cdp, "select-supplier", fixtures.mixedSupplierName);
    await selectComboboxOption(cdp, "select-buyer", fixtures.wholesaleBuyerName);
    await selectComboboxOption(
      cdp,
      "select-buyer-basis",
      fixtures.wholesaleLocationBaseName,
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-carrier"]')
        ?.innerText.includes(${JSON.stringify(fixtures.carrierName)}) &&
       document.querySelector('[data-testid="select-delivery-location"]')
        ?.innerText.includes(${JSON.stringify(fixtures.deliveryLocationName)})`,
      "the carrier and delivery location automatically selected for a via-location tariff",
    );
    await fillInput(cdp, '[data-testid="input-tonnes"]', "1");
    await waitForExpression(
      cdp,
      `document.body.innerText.includes("625")`,
      "the calculated cost from the via-location tariff",
    );

    await navigateToRoute(cdp, "/prices");
    await navigateToRoute(cdp, "/opt");
    await waitForExpression(
      cdp,
      `Boolean(document.querySelector('[data-testid="button-add-opt"]'))`,
      "the OPT create button after navigating from prices",
    );
    await clickTestId(cdp, "button-add-opt");
    await selectComboboxOption(
      cdp,
      "select-supplier",
      fixtures.warehouseSupplierName,
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-basis"]')
        ?.innerText.includes(${JSON.stringify(fixtures.warehouseTariffSourceBaseName)})`,
      "the wholesale source basis of the warehouse supplier",
    );
    await selectComboboxOption(cdp, "select-buyer", fixtures.wholesaleBuyerName);
    await selectComboboxOption(
      cdp,
      "select-buyer-basis",
      fixtures.warehouseTariffDestinationBaseName,
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-carrier"]')
        ?.innerText.includes(${JSON.stringify(fixtures.carrierName)})`,
      "the carrier automatically selected for a warehouse-to-base tariff",
    );
    await fillInput(cdp, '[data-testid="input-tonnes"]', "1");
    await waitForExpression(
      cdp,
      `document.body.innerText.includes("525")`,
      "the calculated cost from the warehouse-to-base tariff",
    );

    await navigateToRoute(cdp, "/prices");
    await navigateToRoute(cdp, "/opt");
    await waitForExpression(
      cdp,
      `Boolean(document.querySelector('[data-testid="button-add-opt"]'))`,
      "the OPT create button before testing inactive tariffs",
    );
    await clickTestId(cdp, "button-add-opt");
    await selectComboboxOption(
      cdp,
      "select-supplier",
      fixtures.inactiveTariffSupplierName,
    );
    await selectComboboxOption(cdp, "select-buyer", fixtures.wholesaleBuyerName);
    await selectComboboxOption(
      cdp,
      "select-buyer-basis",
      fixtures.inactiveTariffDestinationBaseName,
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-carrier"]')
        ?.innerText.includes("Выберите перевозчика")`,
      "no carrier auto-selected when only an inactive tariff matches",
    );
    await fillInput(cdp, '[data-testid="input-tonnes"]', "1");
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="input-tonnes"]')?.value === "1" &&
       document.body.innerText.includes("Доставка\\n—")`,
      "no delivery cost calculated when only an inactive tariff matches",
    );

    await navigateToRoute(cdp, "/prices");
    await navigateToRoute(cdp, "/opt");
    await waitForStableExpression(
      cdp,
      `Boolean(document.querySelector('[data-testid="button-add-opt"]'))`,
      "the OPT create button before the manual-location scenario",
    );
    await clickTestId(cdp, "button-add-opt");
    await selectComboboxOption(cdp, "select-supplier", fixtures.mixedSupplierName);
    await selectComboboxOption(cdp, "select-buyer", fixtures.wholesaleBuyerName);
    await selectComboboxOption(
      cdp,
      "select-buyer-basis",
      fixtures.wholesaleDeliveryBaseName,
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-delivery-location"]')
         ?.innerText.includes("Выберите место") &&
       document.body.innerText.includes("Тариф найден по маршруту базис → базис")`,
      "the base-to-base form to start without an auto-selected location",
    );
    await selectComboboxOption(
      cdp,
      "select-delivery-location",
      fixtures.deliveryLocationName,
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-delivery-location"]')
        ?.innerText.includes(${JSON.stringify(fixtures.deliveryLocationName)}) &&
       document.body.innerText.includes("Тариф найден по маршруту базис → базис")`,
      "the manually selected delivery location to remain selected",
    );
    await fillInput(cdp, '[data-testid="input-tonnes"]', "1");
    await waitForExpression(
      cdp,
      `document.body.innerText.includes("625") &&
       document.body.innerText.includes("Тариф найден по маршруту базис → базис")`,
      "the manual delivery location to override the base-to-base tariff",
    );

    await navigateToRoute(cdp, "/prices");
    await navigateToRoute(cdp, "/opt");
    await fillInput(
      cdp,
      '[data-testid="input-search-opt"]',
      fixtures.mixedSupplierName,
    );
    await openDeleteMenuForRow(cdp, fixtures.mixedSupplierName);
    await waitForExpression(
      cdp,
      `document.querySelector('[role="alertdialog"]')
        ?.innerText.includes("Удалить сделку?")`,
      "the OPT deal deletion confirmation",
    );
    await clickButtonWithText(cdp, "Удалить");
    await waitForDatabaseRow(
      "SELECT deleted_at FROM opt WHERE id = $1",
      [editedOptDraft.id],
      "the OPT draft soft-deleted through the UI",
      (row) => Boolean(row.deleted_at),
    );
    await waitForAuditOperations(editedOptDraft.id, [
      "CREATE",
      "UPDATE",
      "DELETE",
    ]);
    await waitForExpression(
      cdp,
      `!Array.from(document.querySelectorAll("tbody tr"))
        .some((row) => row.innerText.includes(${JSON.stringify(fixtures.mixedSupplierName)}))`,
      "the deleted OPT draft to disappear from the active table",
    );
    const optDeleteAudit = await pool.query(
      `SELECT id FROM audit_log
       WHERE entity_id = $1 AND operation = 'DELETE'
       ORDER BY created_at DESC LIMIT 1`,
      [editedOptDraft.id],
    );
    assert.ok(optDeleteAudit.rows[0]?.id, "the UI deletion should have an audit entry");

    await clickButtonWithText(cdp, "История");
    const deleteAuditEntrySelector =
      `[data-testid="audit-entry-${optDeleteAudit.rows[0].id}"]`;
    const deleteAuditRollbackReady = `(() => {
      const panel = Array.from(document.querySelectorAll('[role="dialog"]'))
        .find((dialog) => dialog.innerText.includes("Все сделки ОПТ"));
      const row = panel?.querySelector(${JSON.stringify(deleteAuditEntrySelector)});
      return Boolean(row && Array.from(row.querySelectorAll("button"))
        .some((item) => item.innerText.trim() === "Откатить"));
    })()`;
    await waitForExpression(
      cdp,
      `Array.from(document.querySelectorAll('[role="dialog"]'))
        .some((dialog) => dialog.innerText.includes("Все сделки ОПТ")) &&
       document.body.innerText.includes("Откат доступен")`,
      "the all-OPT audit panel with restore permission",
    );
    await waitForExpression(
      cdp,
      deleteAuditRollbackReady,
      "the deleted OPT audit row and its rollback action to finish loading",
    );
    const openedDeleteRollback = await cdp.evaluate(`(() => {
      const panel = Array.from(document.querySelectorAll('[role="dialog"]'))
        .find((dialog) => dialog.innerText.includes("Все сделки ОПТ"));
      const row = panel?.querySelector(${JSON.stringify(deleteAuditEntrySelector)});
      const button = Array.from(row?.querySelectorAll("button") ?? [])
        .find((item) => item.innerText.trim() === "Откатить");
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert.equal(
      openedDeleteRollback,
      true,
      "the deleted OPT audit entry should offer rollback",
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[role="alertdialog"]')
        ?.innerText.includes("Удалённая запись будет восстановлена со всеми данными.")`,
      "confirmation that the audit rollback restores the deleted OPT draft",
    );
    const confirmedDeleteRollback = await cdp.evaluate(`(() => {
      const dialog = document.querySelector('[role="alertdialog"]');
      const button = Array.from(dialog?.querySelectorAll("button") ?? [])
        .find((item) => item.innerText.trim() === "Откатить");
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert.equal(confirmedDeleteRollback, true);
    await waitForDatabaseRow(
      "SELECT deleted_at FROM opt WHERE id = $1",
      [editedOptDraft.id],
      "the OPT draft restored through the audit UI",
      (row) => row.deleted_at === null,
    );
    await waitForAuditOperations(editedOptDraft.id, [
      "CREATE",
      "UPDATE",
      "DELETE",
      "RESTORE",
    ]);
    const rolledBackDelete = await pool.query(
      "SELECT rolled_back_at FROM audit_log WHERE id = $1",
      [optDeleteAudit.rows[0].id],
    );
    assert.ok(
      rolledBackDelete.rows[0]?.rolled_back_at,
      "the delete audit entry should be marked as rolled back",
    );
    const activeDraftCount = await pool.query(
      `SELECT COUNT(*)::int AS count FROM opt
       WHERE notes = $1 AND deleted_at IS NULL`,
      [fixtures.optPriceDraftEditedNote],
    );
    assert.equal(activeDraftCount.rows[0].count, 1);
    await waitForExpression(
      cdp,
      `Array.from(document.querySelectorAll("tbody tr"))
        .some((row) => row.innerText.includes(${JSON.stringify(fixtures.mixedSupplierName)}))`,
      "the restored OPT draft to return to the active table",
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
      priceCounterparties.some((text) => text.includes(fixtures.mixedSupplierName)),
      `A supplier with linked bases should be selectable for a wholesale price; options: ${JSON.stringify(priceCounterparties)}`,
    );
    await selectComboboxOption(
      cdp,
      "select-counterparty",
      fixtures.mixedSupplierName,
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-price-contract"]')
        ?.innerText.includes(${JSON.stringify(fixtures.mixedSupplierContractNumber)})`,
      "the contract automatically selected for the chosen supplier",
    );

    const refuelingPriceRows = await pool.query(
      `SELECT p.id, p.counterparty_role
       FROM prices p
       LEFT JOIN suppliers supplier
         ON p.counterparty_role = 'supplier'
        AND p.counterparty_id = supplier.id
       LEFT JOIN customers buyer
         ON p.counterparty_role = 'buyer'
        AND p.counterparty_id = buyer.id
       WHERE p.product_type = 'kerosene'
         AND p.counterparty_type = 'refueling'
         AND p.basis_id = (SELECT id FROM bases WHERE name = $3)
         AND CURRENT_DATE BETWEEN p.date_from AND p.date_to
         AND (
           (p.counterparty_role = 'supplier' AND supplier.name = $1)
           OR (p.counterparty_role = 'buyer' AND buyer.name = $2)
         )`,
      [fixtures.supplierName, fixtures.buyerName, fixtures.baseName],
    );
    const expectedRefuelingPriceIds = Object.fromEntries(
      refuelingPriceRows.rows.map((row) => [row.counterparty_role, row.id]),
    );
    assert.deepEqual(
      Object.keys(expectedRefuelingPriceIds).sort(),
      ["buyer", "supplier"],
      "the UI fixture must provide active refueling purchase and sale prices",
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
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-purchase-price"]')
         ?.innerText.trim() &&
       document.querySelector('[data-testid="select-sale-price"]')
         ?.innerText.trim()`,
      "active purchase and sale prices in the refueling form",
    );
    const createdRefuelingPriceLabels = await cdp.evaluate(`(() => ({
      purchase: document.querySelector('[data-testid="select-purchase-price"]')
        ?.innerText.trim() || "",
      sale: document.querySelector('[data-testid="select-sale-price"]')
        ?.innerText.trim() || "",
    }))()`);
    assert.ok(createdRefuelingPriceLabels.purchase);
    assert.ok(createdRefuelingPriceLabels.sale);
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
      `SELECT id, quantity_tonnes, input_mode, is_draft, nomenclature_id,
              purchase_price_id, purchase_price_index,
              sale_price_id, sale_price_index
       FROM aircraft_refueling WHERE notes = $1`,
      [fixtures.refuelingNote],
      "the refueling draft created through the UI",
    );
    assert.equal(createdRefueling.input_mode, "tonnes");
    assert.equal(Number(createdRefueling.quantity_tonnes), 0.12345);
    assert.equal(createdRefueling.is_draft, true);
    assert.equal(createdRefueling.nomenclature_id, nomenclatureIds.kerosene);
    assert.equal(
      createdRefueling.purchase_price_id,
      expectedRefuelingPriceIds.supplier,
    );
    assert.equal(Number(createdRefueling.purchase_price_index), 0);
    assert.equal(createdRefueling.sale_price_id, expectedRefuelingPriceIds.buyer);
    assert.equal(Number(createdRefueling.sale_price_index), 0);
    const refuelingCreatePayload = operationWritePayloads
      .filter((entry) => entry.path === "/api/refueling" && entry.method === "POST")
      .at(-1)?.payload;
    assert.ok(refuelingCreatePayload, "capture the refueling create payload");
    assert.equal(
      refuelingCreatePayload.purchasePriceId,
      expectedRefuelingPriceIds.supplier,
    );
    assert.equal(refuelingCreatePayload.purchasePriceIndex, 0);
    assert.equal(
      refuelingCreatePayload.salePriceId,
      expectedRefuelingPriceIds.buyer,
    );
    assert.equal(refuelingCreatePayload.salePriceIndex, 0);
    assert.equal("selectedPurchasePriceId" in refuelingCreatePayload, false);
    assert.equal("selectedSalePriceId" in refuelingCreatePayload, false);
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
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-purchase-price"]')
         ?.innerText.trim() &&
       document.querySelector('[data-testid="select-sale-price"]')
         ?.innerText.trim()`,
      "the saved purchase and sale prices in the refueling edit form",
    );
    const editedRefuelingPriceLabels = await cdp.evaluate(`(() => ({
      purchase: document.querySelector('[data-testid="select-purchase-price"]')
        ?.innerText.trim() || "",
      sale: document.querySelector('[data-testid="select-sale-price"]')
        ?.innerText.trim() || "",
    }))()`);
    assert.deepEqual(editedRefuelingPriceLabels, createdRefuelingPriceLabels);
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
      `SELECT id, quantity_tonnes, input_mode, is_draft, nomenclature_id,
              purchase_price_id, purchase_price_index,
              sale_price_id, sale_price_index
       FROM aircraft_refueling WHERE notes = $1`,
      [fixtures.refuelingNote],
      "the refueling draft updated through the UI",
      (row) => Number(row.quantity_tonnes) === 0.23456,
    );
    assert.equal(editedRefueling.id, createdRefueling.id);
    assert.equal(editedRefueling.input_mode, "tonnes");
    assert.equal(editedRefueling.is_draft, true);
    assert.equal(editedRefueling.nomenclature_id, nomenclatureIds.kerosene);
    assert.equal(editedRefueling.purchase_price_id, expectedRefuelingPriceIds.supplier);
    assert.equal(Number(editedRefueling.purchase_price_index), 0);
    assert.equal(editedRefueling.sale_price_id, expectedRefuelingPriceIds.buyer);
    assert.equal(Number(editedRefueling.sale_price_index), 0);
    const refuelingEditPayload = operationWritePayloads
      .filter((entry) => entry.path.startsWith("/api/refueling/"))
      .at(-1)?.payload;
    assert.ok(
      refuelingEditPayload,
      `capture the refueling edit payload; observed writes: ${JSON.stringify(
        operationWritePayloads.map(({ path, method }) => ({ path, method })),
      )}`,
    );
    const refuelingEditDealPayload =
      refuelingEditPayload.deals?.find(
        (deal) => deal.notes === fixtures.refuelingNote,
      ) ?? refuelingEditPayload;
    assert.equal(
      refuelingEditDealPayload.purchasePriceId,
      expectedRefuelingPriceIds.supplier,
      `refueling edit request should preserve the canonical price ID: ${JSON.stringify(
        refuelingEditDealPayload,
      )}`,
    );
    assert.equal(refuelingEditDealPayload.purchasePriceIndex, 0);
    assert.equal(refuelingEditDealPayload.salePriceId, expectedRefuelingPriceIds.buyer);
    assert.equal(refuelingEditDealPayload.salePriceIndex, 0);
    assert.equal("selectedPurchasePriceId" in refuelingEditDealPayload, false);
    assert.equal("selectedSalePriceId" in refuelingEditDealPayload, false);
    await waitForAuditOperations(editedRefueling.id, ["CREATE", "UPDATE"]);
    await waitForExpression(
      cdp,
      `!document.querySelector('[role="dialog"][data-state="open"]')`,
      "the refueling edit form to close after saving",
    );
    console.log("UI flow passed: refueling draft created and edited in tonnes");

    await waitForStableExpression(
      cdp,
      `Boolean(
        document.querySelector(${JSON.stringify(`[data-testid="text-basis-${editedRefueling.id}"]`)}) &&
        document.querySelector('[data-testid="button-add-refueling"]')
      )`,
      "the saved refueling row and list controls to settle before starting a multi-product order",
    );
    await clickTestId(cdp, "button-add-refueling");
    await selectComboboxOption(cdp, "select-supplier", fixtures.supplierName);
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-basis"]')
        ?.innerText.includes(${JSON.stringify(fixtures.baseName)})`,
      "the default basis for the multi-product refueling order",
    );
    await selectComboboxOption(cdp, "select-buyer", fixtures.buyerName);
    await addRefuelingProduct(cdp, "ПВКЖ");
    await addRefuelingProduct(cdp, "Услуга заправки");
    await fillProductMassTonnes(cdp, "Керосин", "0.10001");
    await fillProductMassTonnes(cdp, "ПВКЖ", "0.05002");
    await fillProductMassTonnes(cdp, "Услуга заправки", "0.007");
    await fillInput(
      cdp,
      '[data-testid="input-notes"]',
      fixtures.multiProductRefuelingNote,
    );
    await clickButtonWithText(cdp, "Сохранить черновик");
    await waitForDatabaseRow(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active
       FROM aircraft_refueling WHERE notes = $1`,
      [fixtures.multiProductRefuelingNote],
      "all three UI-created refueling product rows",
      (row) => Number(row.total) === 3 && Number(row.active) === 3,
    );
    const initialMultiProductRows = await pool.query(
      `SELECT id, refueling_order_id, product_type, quantity_tonnes,
              is_draft, deleted_at
       FROM aircraft_refueling
       WHERE notes = $1 AND deleted_at IS NULL
       ORDER BY product_type`,
      [fixtures.multiProductRefuelingNote],
    );
    assert.deepEqual(
      initialMultiProductRows.rows.map((row) => row.product_type),
      ["kerosene", "pvkj", "service"],
    );
    const initialMultiProductByType = new Map(
      initialMultiProductRows.rows.map((row) => [row.product_type, row]),
    );
    assert.equal(
      new Set(
        initialMultiProductRows.rows.map((row) => row.refueling_order_id),
      ).size,
      1,
    );
    for (const [productType, expectedQuantity] of [
      ["kerosene", 0.10001],
      ["pvkj", 0.05002],
      ["service", 0.007],
    ]) {
      const row = initialMultiProductByType.get(productType);
      assert.ok(row, `the order contains ${productType}`);
      assert.equal(Number(row.quantity_tonnes), expectedQuantity);
      assert.equal(row.is_draft, true);
    }
    await waitForAuditOperations(initialMultiProductByType.get("kerosene").id, [
      "CREATE",
    ]);
    await waitForExpression(
      cdp,
      `!document.querySelector('[role="dialog"][data-state="open"]')`,
      "the multi-product order create form to close",
    );

    await openRowActionByTestId(
      cdp,
      `text-basis-${initialMultiProductByType.get("kerosene").id}`,
      "Редактировать",
    );
    await fillProductMassTonnes(cdp, "Керосин", "0.11111");
    await fillProductMassTonnes(cdp, "ПВКЖ", "0.05555");
    const removedPvkjSection = await cdp.evaluate(`(() => {
      const button = document.querySelector(
        '[aria-label="Убрать ПВКЖ из заказа"]',
      );
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert.equal(removedPvkjSection, true);
    await clickButtonWithText(cdp, "Сохранить черновик");
    await waitForDatabaseRow(
      `SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active
       FROM aircraft_refueling WHERE notes = $1`,
      [fixtures.multiProductRefuelingNote],
      "the UI order after removing PVKJ",
      (row) => Number(row.active) === 2,
    );
    const removedMultiProduct = await pool.query(
      `SELECT id, deleted_at FROM aircraft_refueling
       WHERE id = $1`,
      [initialMultiProductByType.get("pvkj").id],
    );
    assert.ok(
      removedMultiProduct.rows[0]?.deleted_at,
      "editing the order soft-deletes the removed PVKJ row",
    );
    const editedKeroseneRow = await pool.query(
      `SELECT id, quantity_tonnes FROM aircraft_refueling
       WHERE id = $1 AND deleted_at IS NULL`,
      [initialMultiProductByType.get("kerosene").id],
    );
    assert.equal(editedKeroseneRow.rows[0]?.id, initialMultiProductByType.get("kerosene").id);
    assert.equal(Number(editedKeroseneRow.rows[0]?.quantity_tonnes), 0.11111);
    await waitForExpression(
      cdp,
      `!document.querySelector('[role="dialog"][data-state="open"]')`,
      "the edited order form to close",
    );

    await openRowActionByTestId(
      cdp,
      `text-basis-${initialMultiProductByType.get("kerosene").id}`,
      "Редактировать",
    );
    await addRefuelingProduct(cdp, "ПВКЖ");
    await fillProductMassTonnes(cdp, "ПВКЖ", "0.06666");
    await clickButtonWithText(cdp, "Сохранить черновик");
    await waitForDatabaseRow(
      `SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active
       FROM aircraft_refueling WHERE notes = $1`,
      [fixtures.multiProductRefuelingNote],
      "the UI order after adding PVKJ back",
      (row) => Number(row.active) === 3,
    );
    const activeMultiProductRows = await pool.query(
      `SELECT id, product_type, quantity_tonnes
       FROM aircraft_refueling
       WHERE notes = $1 AND deleted_at IS NULL
       ORDER BY product_type`,
      [fixtures.multiProductRefuelingNote],
    );
    const activeMultiProductByType = new Map(
      activeMultiProductRows.rows.map((row) => [row.product_type, row]),
    );
    assert.equal(activeMultiProductRows.rows.length, 3);
    assert.notEqual(
      activeMultiProductByType.get("pvkj")?.id,
      initialMultiProductByType.get("pvkj").id,
      "re-adding PVKJ creates a new row instead of reviving the earlier deletion",
    );
    assert.equal(
      Number(activeMultiProductByType.get("pvkj")?.quantity_tonnes),
      0.06666,
    );
    const previouslyRemovedPvkj = await pool.query(
      `SELECT deleted_at FROM aircraft_refueling WHERE id = $1`,
      [initialMultiProductByType.get("pvkj").id],
    );
    assert.ok(previouslyRemovedPvkj.rows[0]?.deleted_at);
    await waitForExpression(
      cdp,
      `!document.querySelector('[role="dialog"][data-state="open"]')`,
      "the re-added order form to close",
    );

    await openRowActionByTestId(
      cdp,
      `text-basis-${activeMultiProductByType.get("kerosene").id}`,
      "Удалить",
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[role="alertdialog"]')
        ?.innerText.includes("Удалить заказ заправки?")`,
      "the multi-product order deletion confirmation",
    );
    await clickButtonWithText(cdp, "Удалить");
    await waitForDatabaseRow(
      `SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active
       FROM aircraft_refueling WHERE notes = $1`,
      [fixtures.multiProductRefuelingNote],
      "the whole multi-product order to be deleted",
      (row) => Number(row.active) === 0,
    );
    const multiProductDeleteAudit = await pool.query(
      `SELECT id FROM audit_log
       WHERE entity_type = 'aircraft_refueling'
         AND entity_id = $1 AND operation = 'DELETE'
       ORDER BY created_at DESC LIMIT 1`,
      [activeMultiProductByType.get("kerosene").id],
    );
    assert.ok(multiProductDeleteAudit.rows[0]?.id);
    await clickButtonWithText(cdp, "История");
    await waitForExpression(
      cdp,
      `document.body.innerText.includes("Откат доступен")`,
      "the deleted multi-product order in the refueling audit panel",
    );
    const multiProductAuditSelector = JSON.stringify(
      `[data-testid="audit-entry-${multiProductDeleteAudit.rows[0].id}"]`,
    );
    await waitForExpression(
      cdp,
      `Array.from(document.querySelector(${multiProductAuditSelector})
        ?.querySelectorAll("button") ?? [])
        .some((item) => item.innerText.trim() === "Откатить")`,
      "the rollback action for the multi-product order deletion",
    );
    const openedMultiProductRollback = await cdp.evaluate(`(() => {
      const entry = document.querySelector(
        ${multiProductAuditSelector},
      );
      const button = Array.from(entry?.querySelectorAll("button") ?? [])
        .find((item) => item.innerText.trim() === "Откатить");
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert.equal(openedMultiProductRollback, true);
    await waitForExpression(
      cdp,
      `document.querySelector('[role="alertdialog"]')
        ?.innerText.includes("Удалённая запись будет восстановлена со всеми данными.")`,
      "the multi-product order restore confirmation",
    );
    const confirmedMultiProductRollback = await cdp.evaluate(`(() => {
      const dialog = document.querySelector('[role="alertdialog"]');
      const button = Array.from(dialog?.querySelectorAll("button") ?? [])
        .find((item) => item.innerText.trim() === "Откатить");
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert.equal(confirmedMultiProductRollback, true);
    await waitForDatabaseRow(
      `SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active
       FROM aircraft_refueling WHERE notes = $1`,
      [fixtures.multiProductRefuelingNote],
      "the deleted multi-product order to be restored",
      (row) => Number(row.active) === 3,
    );
    const restoredMultiProductRows = await pool.query(
      `SELECT id, product_type, quantity_tonnes
       FROM aircraft_refueling
       WHERE notes = $1 AND deleted_at IS NULL
       ORDER BY product_type`,
      [fixtures.multiProductRefuelingNote],
    );
    assert.deepEqual(
      restoredMultiProductRows.rows.map((row) => row.product_type),
      ["kerosene", "pvkj", "service"],
    );
    assert.deepEqual(
      new Set(restoredMultiProductRows.rows.map((row) => row.id)),
      new Set(activeMultiProductRows.rows.map((row) => row.id)),
    );
    assert.ok(previouslyRemovedPvkj.rows[0]?.deleted_at);
    const multiProductRollbackAudit = await pool.query(
      "SELECT rolled_back_at FROM audit_log WHERE id = $1",
      [multiProductDeleteAudit.rows[0].id],
    );
    assert.ok(multiProductRollbackAudit.rows[0]?.rolled_back_at);
    await waitForAuditOperations(
      activeMultiProductByType.get("kerosene").id,
      ["CREATE", "UPDATE", "DELETE"],
    );
    console.log(
      "UI flow passed: multi-product refueling create/edit/remove/re-add/delete/restore",
    );

    const movementPriceRows = await pool.query(
      `SELECT p.id
       FROM prices p
       JOIN suppliers supplier
         ON p.counterparty_id = supplier.id
       WHERE p.product_type = 'kerosene'
         AND p.counterparty_type = 'wholesale'
         AND p.counterparty_role = 'supplier'
         AND p.basis_id = (SELECT id FROM bases WHERE name = $2)
         AND supplier.name = $1
         AND CURRENT_DATE BETWEEN p.date_from AND p.date_to`,
      [fixtures.supplierName, fixtures.baseName],
    );
    assert.equal(
      movementPriceRows.rows.length,
      1,
      "the movement fixture must provide one active supplier purchase price",
    );
    const expectedMovementPriceId = movementPriceRows.rows[0].id;

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
    await selectComboboxOption(cdp, "select-movement-type", "Покупка");
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
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-movement-basis"]')
         ?.innerText.includes(${JSON.stringify(fixtures.baseName)}) &&
       document.querySelector('[data-testid="select-purchase-price"]')
         ?.innerText.trim() &&
       !document.querySelector('[data-testid="select-purchase-price"]')
         ?.innerText.includes("нет цены")`,
      "the supplier basis and active purchase price in the movement form",
    );
    const createdMovementPriceLabel = await cdp.evaluate(
      `document.querySelector('[data-testid="select-purchase-price"]')
        ?.innerText.trim() || ""`,
    );
    assert.ok(createdMovementPriceLabel);
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
              nomenclature_id, purchase_price_id, purchase_price_index
       FROM movement WHERE notes = $1`,
      [fixtures.movementNote],
      "the movement draft created through the UI",
    );
    assert.equal(Number(createdMovement.quantity_tonnes), 0.12345);
    assert.equal(createdMovement.input_mode, "tonnes");
    assert.equal(createdMovement.is_draft, true);
    assert.equal(createdMovement.nomenclature_id, nomenclatureIds.kerosene);
    assert.equal(createdMovement.purchase_price_id, expectedMovementPriceId);
    assert.equal(Number(createdMovement.purchase_price_index), 0);
    const movementCreatePayload = operationWritePayloads
      .filter((entry) => entry.path === "/api/movement" && entry.method === "POST")
      .at(-1)?.payload;
    assert.ok(movementCreatePayload, "capture the movement create payload");
    assert.equal(movementCreatePayload.purchasePriceId, expectedMovementPriceId);
    assert.equal(movementCreatePayload.purchasePriceIndex, 0);
    assert.equal("selectedPurchasePriceId" in movementCreatePayload, false);
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
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-purchase-price"]')
         ?.innerText.trim()`,
      "the saved purchase price in the movement edit form",
    );
    const editedMovementPriceLabel = await cdp.evaluate(
      `document.querySelector('[data-testid="select-purchase-price"]')
        ?.innerText.trim() || ""`,
    );
    assert.equal(editedMovementPriceLabel, createdMovementPriceLabel);
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
              nomenclature_id, purchase_price_id, purchase_price_index
       FROM movement WHERE notes = $1`,
      [fixtures.movementNote],
      "the movement draft updated through the UI",
      (row) => Number(row.quantity_tonnes) === 0.23456,
    );
    assert.equal(editedMovement.id, createdMovement.id);
    assert.equal(editedMovement.input_mode, "tonnes");
    assert.equal(editedMovement.is_draft, true);
    assert.equal(editedMovement.nomenclature_id, nomenclatureIds.kerosene);
    assert.equal(editedMovement.purchase_price_id, expectedMovementPriceId);
    assert.equal(Number(editedMovement.purchase_price_index), 0);
    const movementEditPayload = operationWritePayloads
      .filter((entry) => entry.path.startsWith("/api/movement/"))
      .at(-1)?.payload;
    assert.ok(movementEditPayload, "capture the movement edit payload");
    assert.equal(movementEditPayload.purchasePriceId, expectedMovementPriceId);
    assert.equal(movementEditPayload.purchasePriceIndex, 0);
    assert.equal("selectedPurchasePriceId" in movementEditPayload, false);
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
    const createReceipt = async ({
      date,
      quantity,
      note,
      warehouseName = fixtures.operationalWarehouseName,
      productType = "Керосин",
      nomenclatureName = fixtures.nomenclatureNames.kerosene,
    }) => {
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
      if (productType !== "Керосин") {
        await selectComboboxOption(
          cdp,
          "select-movement-product",
          productType,
        );
      }
      await waitForExpression(
        cdp,
        `document.querySelector('[data-testid="select-nomenclature"]')
          ?.innerText.includes(${JSON.stringify(nomenclatureName)})`,
        `the ${productType} receipt's default nomenclature`,
      );
      await selectComboboxOption(
        cdp,
        "select-movement-to",
        warehouseName,
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
                  movement_date, purchase_price_per_tonne, total_cost,
                  nomenclature_id, product_type, to_warehouse_id
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
      assert.equal(
        receipt.to_warehouse_id,
        (
          await pool.query("SELECT id FROM warehouses WHERE name = $1", [
            warehouseName,
          ])
        ).rows[0]?.id,
      );
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

    const warehouseRefuelingWarehouse = await pool.query(
      `SELECT id FROM warehouses WHERE name = $1`,
      [fixtures.warehouseRefuelingWarehouseName],
    );
    const warehouseRefuelingWarehouseId =
      warehouseRefuelingWarehouse.rows[0]?.id;
    assert.ok(
      warehouseRefuelingWarehouseId,
      "the warehouse-linked refueling supplier has a dedicated warehouse",
    );
    const warehouseRefuelingFirstReceipt = await createReceipt({
      date: "01.10.2026",
      quantity: "1",
      note: fixtures.warehouseRefuelingFirstReceiptNote,
      warehouseName: fixtures.warehouseRefuelingWarehouseName,
    });
    assert.equal(
      Number(warehouseRefuelingFirstReceipt.purchase_price_per_tonne),
      10_000,
    );
    const warehouseRefuelingSecondReceipt = await createReceipt({
      date: "06.10.2026",
      quantity: "1",
      note: fixtures.warehouseRefuelingSecondReceiptNote,
      warehouseName: fixtures.warehouseRefuelingWarehouseName,
    });
    assert.equal(
      Number(warehouseRefuelingSecondReceipt.purchase_price_per_tonne),
      20_000,
    );
    const warehousePvkjReceipt = await createReceipt({
      date: "01.10.2026",
      quantity: "1",
      note: fixtures.warehouseRefuelingPvkjReceiptNote,
      warehouseName: fixtures.warehouseRefuelingWarehouseName,
      productType: "ПВКЖ",
      nomenclatureName: fixtures.nomenclatureNames.pvkj,
    });
    assert.equal(warehousePvkjReceipt.product_type, "pvkj");
    assert.equal(Number(warehousePvkjReceipt.purchase_price_per_tonne), 12_000);
    await waitForDatabaseRow(
      `SELECT current_balance_tonnes, average_cost_per_tonne,
              pvkj_balance_tonnes, pvkj_average_cost_per_tonne
       FROM warehouses WHERE id = $1`,
      [warehouseRefuelingWarehouseId],
      "the warehouse's real kerosene and PVKJ receipt ledger",
      (row) =>
        Number(row.current_balance_tonnes) === 2 &&
        Number(row.average_cost_per_tonne) === 15_000 &&
        Number(row.pvkj_balance_tonnes) === 1 &&
        Number(row.pvkj_average_cost_per_tonne) === 12_000,
      45_000,
    );

    const createWarehouseRefuelingOrder = async ({
      note,
      date,
      keroseneTonnes,
      pvkjTonnes,
      serviceTonnes,
    }) => {
      await navigateToRoute(cdp, "/refueling");
      await clickTestId(cdp, "button-add-refueling");
      await selectComboboxOption(
        cdp,
        "select-supplier",
        fixtures.warehouseRefuelingSupplierName,
      );
      await waitForExpression(
        cdp,
        `document.querySelector('[data-testid="select-basis"]')
          ?.innerText.includes(${JSON.stringify(fixtures.baseName)})`,
        "the warehouse supplier's refueling basis",
      );
      await selectComboboxOption(cdp, "select-buyer", fixtures.buyerName);
      if (pvkjTonnes !== undefined) {
        await addRefuelingProduct(cdp, "ПВКЖ");
      }
      if (serviceTonnes !== undefined) {
        await addRefuelingProduct(cdp, "Услуга заправки");
      }
      await fillInput(
        cdp,
        '[data-testid="input-refueling-date"]',
        date,
      );
      await fillProductMassTonnes(cdp, "Керосин", keroseneTonnes);
      if (pvkjTonnes !== undefined) {
        await fillProductMassTonnes(cdp, "ПВКЖ", pvkjTonnes);
      }
      if (serviceTonnes !== undefined) {
        await fillProductMassTonnes(
          cdp,
          "Услуга заправки",
          serviceTonnes,
        );
      }
      await fillInput(cdp, '[data-testid="input-notes"]', note);
      await waitForExpression(
        cdp,
        `!document.querySelector('[data-testid="button-submit-refueling"]')?.disabled`,
        `the completed warehouse-backed order ${note} to be submittable`,
        30_000,
      );
      const recalculationCreatedAfter = new Date(
        Date.now() - 1_000,
      ).toISOString();
      await clickTestId(cdp, "button-submit-refueling");
      const expectedRowCount = 1 + Number(pvkjTonnes !== undefined) +
        Number(serviceTonnes !== undefined);
      await waitForDatabaseRow(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active
         FROM aircraft_refueling WHERE notes = $1`,
        [note],
        `all ${expectedRowCount} final warehouse-backed products for ${note}`,
        (row) =>
          Number(row.total) === expectedRowCount &&
          Number(row.active) === expectedRowCount,
        30_000,
      );
      const rows = await pool.query(
        `SELECT id, refueling_order_id, product_type, quantity_tonnes,
                warehouse_id, is_draft, purchase_price_per_tonne,
                purchase_amount, sale_price_per_tonne, sale_amount,
                agent_fee, other_service_fee, profit,
                is_agent_fee_enabled, is_other_service_enabled
         FROM aircraft_refueling
         WHERE notes = $1 AND deleted_at IS NULL
         ORDER BY product_type`,
        [note],
      );
      assert.equal(rows.rows.length, expectedRowCount);
      assert.ok(
        rows.rows.every(
          (row) =>
            row.is_draft === false &&
            row.refueling_order_id === rows.rows[0].refueling_order_id,
        ),
        "all products are final rows in one refueling order",
      );
      await waitForRecalculation(
        "recalculation_queue",
        "warehouse_id",
        warehouseRefuelingWarehouseId,
        {
          productType: "kerosene",
          createdAfter: recalculationCreatedAfter,
          requireTask: false,
        },
      );
      if (pvkjTonnes !== undefined) {
        await waitForRecalculation(
          "recalculation_queue",
          "warehouse_id",
          warehouseRefuelingWarehouseId,
          {
            productType: "pvkj",
            createdAfter: recalculationCreatedAfter,
            requireTask: false,
          },
        );
      }
      return rows.rows;
    };

    const assertRefuelingEconomics = (deal) => {
      const agentFee =
        deal.is_agent_fee_enabled === false ? 0 : Number(deal.agent_fee || 0);
      const otherFee =
        deal.is_other_service_enabled === false
          ? 0
          : Number(deal.other_service_fee || 0);
      const expectedProfit =
        Number(deal.sale_amount || 0) -
        Number(deal.purchase_amount || 0) -
        agentFee -
        otherFee;
      assert.ok(Number.isFinite(Number(deal.purchase_amount)));
      assert.ok(Number.isFinite(Number(deal.sale_amount)));
      assert.ok(
        Math.abs(Number(deal.profit || 0) - expectedProfit) < 0.011,
        `${deal.product_type} profit matches the saved purchase, sale, and fee amounts`,
      );
    };

    const priorWarehouseOrder = await createWarehouseRefuelingOrder({
      note: fixtures.warehousePriorRefuelingNote,
      date: "08.10.2026",
      keroseneTonnes: "0.1",
      pvkjTonnes: "0.05",
    });
    await waitForDatabaseRow(
      `SELECT current_balance_tonnes, average_cost_per_tonne,
              pvkj_balance_tonnes, pvkj_average_cost_per_tonne
       FROM warehouses WHERE id = $1`,
      [warehouseRefuelingWarehouseId],
      "stock after the earlier real warehouse-backed write-off",
      (row) =>
        Number(row.current_balance_tonnes) === 1.9 &&
        Number(row.average_cost_per_tonne) === 15_000 &&
        Number(row.pvkj_balance_tonnes) === 0.95 &&
        Number(row.pvkj_average_cost_per_tonne) === 12_000,
      45_000,
    );
    const priorWarehouseDealByType = new Map(
      priorWarehouseOrder.map((deal) => [deal.product_type, deal]),
    );
    assert.deepEqual(
      [...priorWarehouseDealByType.keys()].sort(),
      ["kerosene", "pvkj"],
      "the earlier warehouse write-off includes both stocked product types",
    );
    for (const deal of priorWarehouseOrder) {
      assert.equal(deal.warehouse_id, warehouseRefuelingWarehouseId);
      assertRefuelingEconomics(deal);
    }
    assert.equal(
      Number(priorWarehouseDealByType.get("kerosene").purchase_price_per_tonne),
      15_000,
    );
    assert.equal(
      Number(priorWarehouseDealByType.get("pvkj").purchase_price_per_tonne),
      12_000,
    );
    const priorWarehouseWriteoffs = await pool.query(
      `SELECT source_id, product_type, quantity_tonnes
       FROM warehouse_transactions
       WHERE source_type = 'refueling'
         AND source_id = ANY($1::uuid[])
         AND deleted_at IS NULL`,
      [priorWarehouseOrder.map((deal) => deal.id)],
    );
    assert.equal(priorWarehouseWriteoffs.rows.length, 2);
    assert.ok(
      priorWarehouseWriteoffs.rows.every(
        (transaction) => Number(transaction.quantity_tonnes) < 0,
      ),
      "the earlier warehouse-backed deals have real inventory write-offs",
    );

    const testedWarehouseOrder = await createWarehouseRefuelingOrder({
      note: fixtures.warehouseMultiProductRefuelingNote,
      date: "10.10.2026",
      keroseneTonnes: "0.2",
      pvkjTonnes: "0.1",
      serviceTonnes: "0.007",
    });
    await waitForDatabaseRow(
      `SELECT current_balance_tonnes, average_cost_per_tonne,
              pvkj_balance_tonnes, pvkj_average_cost_per_tonne
       FROM warehouses WHERE id = $1`,
      [warehouseRefuelingWarehouseId],
      "stock after the final three-product warehouse-backed order",
      (row) =>
        Number(row.current_balance_tonnes) === 1.7 &&
        Number(row.average_cost_per_tonne) === 15_000 &&
        Number(row.pvkj_balance_tonnes) === 0.85 &&
        Number(row.pvkj_average_cost_per_tonne) === 12_000,
      45_000,
    );
    const testedWarehouseDealByType = new Map(
      testedWarehouseOrder.map((deal) => [deal.product_type, deal]),
    );
    assert.deepEqual(
      [...testedWarehouseDealByType.keys()].sort(),
      ["kerosene", "pvkj", "service"],
      "the final warehouse-backed order includes kerosene, PVKJ, and service",
    );
    for (const deal of testedWarehouseOrder) {
      assertRefuelingEconomics(deal);
    }
    const testedKeroseneBeforeRecalculation =
      testedWarehouseDealByType.get("kerosene");
    assert.equal(testedKeroseneBeforeRecalculation.warehouse_id, warehouseRefuelingWarehouseId);
    assert.equal(
      Number(testedKeroseneBeforeRecalculation.purchase_price_per_tonne),
      15_000,
    );
    assert.equal(
      Number(testedKeroseneBeforeRecalculation.purchase_amount),
      Number(testedKeroseneBeforeRecalculation.quantity_tonnes) * 15_000,
    );
    assert.equal(
      Number(testedWarehouseDealByType.get("pvkj").purchase_price_per_tonne),
      12_000,
    );
    const testedWarehouseWriteoffs = await pool.query(
      `SELECT source_id, product_type, quantity_tonnes
       FROM warehouse_transactions
       WHERE source_type = 'refueling'
         AND source_id = ANY($1::uuid[])
         AND deleted_at IS NULL`,
      [testedWarehouseOrder.map((deal) => deal.id)],
    );
    assert.deepEqual(
      testedWarehouseWriteoffs.rows.map((transaction) => transaction.product_type).sort(),
      ["kerosene", "pvkj"],
      "only stocked products create warehouse write-offs; service remains non-inventory",
    );
    assert.ok(
      testedWarehouseWriteoffs.rows.every(
        (transaction) => Number(transaction.quantity_tonnes) < 0,
      ),
    );

    await navigateToRoute(cdp, "/movement");
    await fillInput(cdp, 'input[placeholder="Поиск..."]', "");
    await waitForExpression(
      cdp,
      `document.querySelector('input[placeholder="Поиск..."]')?.value === ""`,
      "the movement table search to be cleared before editing the historical receipt",
    );
    await openRowActionByTestId(
      cdp,
      `movement-row-${warehouseRefuelingFirstReceipt.id}`,
      "Редактировать",
    );
    await waitForExpression(
      cdp,
      `Number(document.querySelector('[data-testid="input-quantity-tonnes"]')
        ?.value) === 1`,
      "the original backdated warehouse receipt in the movement edit form",
    );
    await fillInput(
      cdp,
      '[data-testid="input-quantity-tonnes"]',
      "1.5",
    );
    await fillInput(
      cdp,
      '[data-testid="input-movement-notes"]',
      fixtures.warehouseRefuelingFirstReceiptNote,
    );
    const warehouseReceiptRecalculationCreatedAfter = new Date(
      Date.now() - 1_000,
    ).toISOString();
    await clickTestId(cdp, "button-create-movement");
    const editedWarehouseReceipt = await waitForDatabaseRow(
      `SELECT id, quantity_tonnes, purchase_price_per_tonne, total_cost,
              movement_date, to_warehouse_id
       FROM movement WHERE id = $1`,
      [warehouseRefuelingFirstReceipt.id],
      "the first warehouse receipt quantity edited retroactively in the UI",
      (row) => Number(row.quantity_tonnes) === 1.5,
      30_000,
    );
    assert.equal(editedWarehouseReceipt.id, warehouseRefuelingFirstReceipt.id);
    assert.equal(Number(editedWarehouseReceipt.purchase_price_per_tonne), 10_000);
    assert.equal(Number(editedWarehouseReceipt.total_cost), 15_000);
    assert.equal(editedWarehouseReceipt.to_warehouse_id, warehouseRefuelingWarehouseId);
    await waitForRecalculation(
      "recalculation_queue",
      "warehouse_id",
      warehouseRefuelingWarehouseId,
      {
        productType: "kerosene",
        createdAfter: warehouseReceiptRecalculationCreatedAfter,
      },
    );
    const recalculatedWarehouseDeals = await pool.query(
      `SELECT id, product_type, quantity_tonnes, purchase_price_per_tonne,
              purchase_amount, sale_amount, agent_fee, other_service_fee,
              profit, is_agent_fee_enabled, is_other_service_enabled
       FROM aircraft_refueling
       WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [
        [
          priorWarehouseDealByType.get("kerosene").id,
          testedKeroseneBeforeRecalculation.id,
        ],
      ],
    );
    const recalculatedById = new Map(
      recalculatedWarehouseDeals.rows.map((deal) => [deal.id, deal]),
    );
    const recalculatedPriorKerosene = recalculatedById.get(
      priorWarehouseDealByType.get("kerosene").id,
    );
    const recalculatedTestedKerosene = recalculatedById.get(
      testedKeroseneBeforeRecalculation.id,
    );
    assert.equal(
      Number(recalculatedPriorKerosene.purchase_price_per_tonne),
      14_000,
      "the earlier warehouse-backed refueling is recalculated at the corrected average cost",
    );
    assert.equal(
      Number(recalculatedTestedKerosene.purchase_price_per_tonne),
      14_000,
      "the later multi-product order is recalculated at the corrected average cost",
    );
    assert.equal(
      Number(recalculatedTestedKerosene.purchase_amount),
      Number(recalculatedTestedKerosene.quantity_tonnes) * 14_000,
    );
    assertRefuelingEconomics(recalculatedPriorKerosene);
    assertRefuelingEconomics(recalculatedTestedKerosene);
    const recalculatedWarehouseBalances = await pool.query(
      `SELECT current_balance_tonnes, average_cost_per_tonne,
              pvkj_balance_tonnes, pvkj_average_cost_per_tonne
       FROM warehouses WHERE id = $1`,
      [warehouseRefuelingWarehouseId],
    );
    assert.equal(
      Number(recalculatedWarehouseBalances.rows[0].current_balance_tonnes),
      2.2,
    );
    assert.equal(
      Number(recalculatedWarehouseBalances.rows[0].average_cost_per_tonne),
      14_000,
    );
    assert.equal(
      Number(recalculatedWarehouseBalances.rows[0].pvkj_balance_tonnes),
      0.85,
    );
    assert.equal(
      Number(recalculatedWarehouseBalances.rows[0].pvkj_average_cost_per_tonne),
      12_000,
    );
    const finalOrderRows = await pool.query(
      `SELECT product_type, quantity_tonnes, purchase_price_per_tonne,
              purchase_amount, sale_amount, profit,
              is_agent_fee_enabled, is_other_service_enabled
       FROM aircraft_refueling
       WHERE notes = $1 AND deleted_at IS NULL
       ORDER BY product_type`,
      [fixtures.warehouseMultiProductRefuelingNote],
    );
    assert.deepEqual(
      finalOrderRows.rows.map((deal) => deal.product_type),
      ["kerosene", "pvkj", "service"],
    );
    for (const deal of finalOrderRows.rows) assertRefuelingEconomics(deal);
    assert.equal(
      Number(finalOrderRows.rows.find((deal) => deal.product_type === "kerosene").purchase_amount),
      Number(finalOrderRows.rows.find((deal) => deal.product_type === "kerosene").quantity_tonnes) * 14_000,
      "the final order's kerosene purchase amount uses the retroactively recalculated warehouse cost",
    );

    await navigateToRoute(cdp, "/refueling");
    await fillInput(
      cdp,
      '[data-testid="input-search-refueling"]',
      "",
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="input-search-refueling"]')?.value === ""`,
      "the refueling table search to be cleared before deleting the final order",
    );
    const testedOrderRowTestIds = testedWarehouseOrder.map(
      (deal) => `refueling-row-${deal.id}`,
    );
    const deletedOrderAnchorId = await openRowActionFromTestIds(
      cdp,
      testedOrderRowTestIds,
      "Удалить",
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[role="alertdialog"]')
        ?.innerText.includes("Удалить заказ заправки?")`,
      "the final warehouse-backed order deletion confirmation",
    );
    await clickButtonWithText(cdp, "Удалить");
    const deletedFinalOrder = await waitForDatabaseRow(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS deleted
       FROM aircraft_refueling
       WHERE id = ANY($1::uuid[])`,
      [testedWarehouseOrder.map((deal) => deal.id)],
      "all three final warehouse-backed refueling rows to be deleted",
      (row) => row.total === 3 && row.deleted === 3,
      30_000,
    );
    assert.deepEqual(deletedFinalOrder, { total: 3, deleted: 3 });
    await waitForDatabaseRow(
      `SELECT current_balance_tonnes, average_cost_per_tonne,
              pvkj_balance_tonnes, pvkj_average_cost_per_tonne
       FROM warehouses WHERE id = $1`,
      [warehouseRefuelingWarehouseId],
      "warehouse balances after deleting the final refueling order",
      (row) =>
        Number(row.current_balance_tonnes) === 2.4 &&
        Number(row.average_cost_per_tonne) === 14_000 &&
        Number(row.pvkj_balance_tonnes) === 0.95 &&
        Number(row.pvkj_average_cost_per_tonne) === 12_000,
      45_000,
    );
    const deletedOrderWriteoffs = await pool.query(
      `SELECT id, source_id, product_type, deleted_at
       FROM warehouse_transactions
       WHERE source_type = 'refueling'
         AND source_id = ANY($1::uuid[])
       ORDER BY product_type`,
      [testedWarehouseOrder.map((deal) => deal.id)],
    );
    assert.equal(deletedOrderWriteoffs.rows.length, 2);
    assert.ok(
      deletedOrderWriteoffs.rows.every((transaction) => transaction.deleted_at),
      "deleting the order soft-deletes both stock write-offs",
    );
    const orderDeleteAudit = await waitForDatabaseRow(
      `SELECT id FROM audit_log
       WHERE entity_id = $1 AND operation = 'DELETE'
       ORDER BY created_at DESC LIMIT 1`,
      [deletedOrderAnchorId],
      "the delete audit entry for the final warehouse-backed order",
    );
    await clickButtonWithText(cdp, "История");
    await waitForExpression(
      cdp,
      `Array.from(document.querySelectorAll('[role="dialog"]'))
        .some((dialog) =>
          dialog.innerText.includes("Все заправки ВС (включая удаленные)")) &&
       document.body.innerText.includes("Откат доступен")`,
      "the refueling audit panel with restore permission",
    );
    const finalOrderAuditSelector = JSON.stringify(
      `[data-testid="audit-entry-${orderDeleteAudit.id}"]`,
    );
    await waitForExpression(
      cdp,
      `Boolean(document.querySelector(${finalOrderAuditSelector}))`,
      "the final order's specific DELETE audit entry to render",
    );
    await waitForExpression(
      cdp,
      `Array.from(
        document.querySelector(${finalOrderAuditSelector})?.querySelectorAll("button") ?? [],
      ).some((button) => button.innerText.trim() === "Откатить")`,
      "the rollback button for the final order's DELETE audit entry",
    );
    const openedFinalOrderRollback = await cdp.evaluate(`(() => {
      const entry = document.querySelector(${finalOrderAuditSelector});
      const button = Array.from(entry?.querySelectorAll("button") ?? [])
        .find((item) => item.innerText.trim() === "Откатить");
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert.equal(openedFinalOrderRollback, true);
    await waitForExpression(
      cdp,
      `document.querySelector('[role="alertdialog"]')
        ?.innerText.includes("Удалённая запись будет восстановлена со всеми данными.")`,
      "confirmation that all products in the final order are restored",
    );
    const confirmedFinalOrderRollback = await cdp.evaluate(`(() => {
      const dialog = document.querySelector('[role="alertdialog"]');
      const button = Array.from(dialog?.querySelectorAll("button") ?? [])
        .find((item) => item.innerText.trim() === "Откатить");
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert.equal(confirmedFinalOrderRollback, true);
    const restoredFinalOrder = await waitForDatabaseRow(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active
       FROM aircraft_refueling
       WHERE id = ANY($1::uuid[])`,
      [testedWarehouseOrder.map((deal) => deal.id)],
      "all three final warehouse-backed order rows to be restored",
      (row) => row.total === 3 && row.active === 3,
      45_000,
    );
    assert.deepEqual(restoredFinalOrder, { total: 3, active: 3 });
    await waitForDatabaseRow(
      `SELECT current_balance_tonnes, average_cost_per_tonne,
              pvkj_balance_tonnes, pvkj_average_cost_per_tonne
       FROM warehouses WHERE id = $1`,
      [warehouseRefuelingWarehouseId],
      "warehouse balances after restoring the final refueling order",
      (row) =>
        Number(row.current_balance_tonnes) === 2.2 &&
        Number(row.average_cost_per_tonne) === 14_000 &&
        Number(row.pvkj_balance_tonnes) === 0.85 &&
        Number(row.pvkj_average_cost_per_tonne) === 12_000,
      45_000,
    );
    const restoredOrderWriteoffs = await pool.query(
      `SELECT id, source_id, product_type, quantity_tonnes, deleted_at
       FROM warehouse_transactions
       WHERE source_type = 'refueling'
         AND source_id = ANY($1::uuid[])
       ORDER BY product_type`,
      [testedWarehouseOrder.map((deal) => deal.id)],
    );
    assert.equal(restoredOrderWriteoffs.rows.length, 2);
    assert.ok(
      restoredOrderWriteoffs.rows.every((transaction) => !transaction.deleted_at),
      "restoring the order reactivates the original stock write-offs",
    );
    assert.deepEqual(
      restoredOrderWriteoffs.rows.map((transaction) => transaction.id).sort(),
      deletedOrderWriteoffs.rows.map((transaction) => transaction.id).sort(),
      "restoration reuses the original write-offs without creating duplicates",
    );
    await waitForAuditOperations(deletedOrderAnchorId, ["DELETE", "RESTORE"]);
    const rolledBackFinalOrderAudit = await pool.query(
      "SELECT rolled_back_at FROM audit_log WHERE id = $1",
      [orderDeleteAudit.id],
    );
    assert.ok(rolledBackFinalOrderAudit.rows[0]?.rolled_back_at);
    await clickButtonWithText(cdp, "Close");
    await waitForExpression(
      cdp,
      `!Array.from(document.querySelectorAll('[role="dialog"]'))
        .some((dialog) =>
          dialog.innerText.includes("Все заправки ВС (включая удаленные)"))`,
      "the refueling audit panel to close before the next UI flow",
    );
    await navigateToRoute(cdp, "/movement");
    console.log(
      "UI flow passed: warehouse-backed final multi-product order, backdated recalculation, delete, restore, and economics",
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
    const equipmentLedgerBeforeDelete = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active,
              COUNT(*)::int AS total
       FROM equipment_transactions
       WHERE source_type = 'refueling' AND source_id = $1`,
      [finalDeal.id],
    );
    assert.deepEqual(equipmentLedgerBeforeDelete.rows[0], {
      active: 1,
      total: 1,
    });

    await openRowActionByTestId(
      cdp,
      `text-basis-${finalDeal.id}`,
      "Удалить",
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[role="alertdialog"]')
        ?.innerText.includes("Удалить заказ заправки?")`,
      "the equipment refueling deletion confirmation",
    );
    await clickButtonWithText(cdp, "Удалить");
    await waitForDatabaseRow(
      `SELECT deleted_at FROM aircraft_refueling WHERE id = $1`,
      [finalDeal.id],
      "the final equipment refueling soft-deleted through the UI",
      (row) => Boolean(row.deleted_at),
    );
    await waitForAuditOperations(finalDeal.id, ["CREATE", "DELETE"]);
    await waitForRecalculation(
      "equipment_recalculation_queue",
      "equipment_id",
      equipmentId,
      { requireTask: false },
    );
    await waitForDatabaseRow(
      `SELECT current_balance_tonnes, average_cost_per_tonne
       FROM equipments WHERE id = $1`,
      [equipmentId],
      "the equipment balance after deleting the final refueling",
      (row) =>
        Number(row.current_balance_tonnes) === 1.5 &&
        Number(row.average_cost_per_tonne) === 15_000,
      45_000,
    );
    const equipmentLedgerAfterDelete = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active,
              COUNT(*)::int AS total
       FROM equipment_transactions
       WHERE source_type = 'refueling' AND source_id = $1`,
      [finalDeal.id],
    );
    assert.deepEqual(equipmentLedgerAfterDelete.rows[0], {
      active: 0,
      total: 1,
    });
    const refuelingDeleteAudit = await pool.query(
      `SELECT id FROM audit_log
       WHERE entity_id = $1 AND operation = 'DELETE'
       ORDER BY created_at DESC LIMIT 1`,
      [finalDeal.id],
    );
    assert.ok(
      refuelingDeleteAudit.rows[0]?.id,
      "the UI deletion should have an audit entry",
    );
    await waitForExpression(
      cdp,
      `!document.querySelector(${JSON.stringify(`[data-testid="text-basis-${finalDeal.id}"]`)})`,
      "the deleted equipment refueling to disappear from the table",
    );
    await clickButtonWithText(cdp, "История");
    await waitForExpression(
      cdp,
      `Array.from(document.querySelectorAll('[role="dialog"]'))
        .some((dialog) => dialog.innerText.includes("Все заправки ВС")) &&
       document.body.innerText.includes("Откат доступен")`,
      "the refueling audit panel with restore permission",
    );
    const refuelingDeleteAuditSelector = JSON.stringify(
      `[data-testid="audit-entry-${refuelingDeleteAudit.rows[0].id}"]`,
    );
    await waitForExpression(
      cdp,
      `Array.from(document.querySelector(${refuelingDeleteAuditSelector})
        ?.querySelectorAll("button") ?? [])
        .some((item) => item.innerText.trim() === "Откатить")`,
      "the rollback action for the equipment refueling deletion",
    );
    const openedRefuelingRollback = await cdp.evaluate(`(() => {
      const panel = Array.from(document.querySelectorAll('[role="dialog"]'))
        .find((dialog) => dialog.innerText.includes("Все заправки ВС"));
      const entry = panel?.querySelector(
        ${refuelingDeleteAuditSelector},
      );
      const button = Array.from(entry?.querySelectorAll("button") ?? [])
        .find((item) => item.innerText.trim() === "Откатить");
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert.equal(
      openedRefuelingRollback,
      true,
      "the deleted refueling audit entry should offer rollback",
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[role="alertdialog"]')
        ?.innerText.includes("Удалённая запись будет восстановлена со всеми данными.")`,
      "confirmation that the audit rollback restores the equipment refueling",
    );
    const confirmedRefuelingRollback = await cdp.evaluate(`(() => {
      const dialog = document.querySelector('[role="alertdialog"]');
      const button = Array.from(dialog?.querySelectorAll("button") ?? [])
        .find((item) => item.innerText.trim() === "Откатить");
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert.equal(confirmedRefuelingRollback, true);
    await waitForDatabaseRow(
      `SELECT deleted_at FROM aircraft_refueling WHERE id = $1`,
      [finalDeal.id],
      "the final equipment refueling restored through the audit UI",
      (row) => row.deleted_at === null,
    );
    await waitForAuditOperations(finalDeal.id, [
      "CREATE",
      "DELETE",
      "RESTORE",
    ]);
    await waitForRecalculation(
      "equipment_recalculation_queue",
      "equipment_id",
      equipmentId,
      { requireTask: false },
    );
    await waitForDatabaseRow(
      `SELECT current_balance_tonnes, average_cost_per_tonne
       FROM equipments WHERE id = $1`,
      [equipmentId],
      "the equipment balance after restoring the final refueling",
      (row) =>
        Number(row.current_balance_tonnes) === 1.29999 &&
        Number(row.average_cost_per_tonne) === 15_000,
      45_000,
    );
    const equipmentLedgerAfterRestore = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active,
              COUNT(*)::int AS total
       FROM equipment_transactions
       WHERE source_type = 'refueling' AND source_id = $1`,
      [finalDeal.id],
    );
    assert.deepEqual(equipmentLedgerAfterRestore.rows[0], {
      active: 1,
      total: 1,
    });
    const restoredFinalDeal = await waitForDatabaseRow(
      `SELECT purchase_price_per_tonne, purchase_amount, sale_amount, profit
       FROM aircraft_refueling WHERE id = $1`,
      [finalDeal.id],
      "the restored refueling economics",
    );
    for (const field of [
      "purchase_price_per_tonne",
      "purchase_amount",
      "sale_amount",
      "profit",
    ]) {
      assert.equal(
        Number(restoredFinalDeal[field]),
        Number(finalDeal[field]),
        `restoring the final refueling preserves ${field}`,
      );
    }
    const rolledBackRefuelingDelete = await pool.query(
      "SELECT rolled_back_at FROM audit_log WHERE id = $1",
      [refuelingDeleteAudit.rows[0].id],
    );
    assert.ok(rolledBackRefuelingDelete.rows[0]?.rolled_back_at);
    await waitForExpression(
      cdp,
      `Boolean(document.querySelector(${JSON.stringify(`[data-testid="text-basis-${finalDeal.id}"]`)}))`,
      "the restored equipment refueling to return to the active table",
    );
    console.log(
      "UI flow passed: equipment refueling delete/restore preserves stock, ledger, and economics",
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
    await waitForExpression(
      cdp,
      `(() => {
        const price = document.querySelector('[data-testid="select-purchase-price"]')?.innerText || "";
        const submit = document.querySelector('[data-testid="button-create-movement"]');
        return price.replace(/[^0-9]/g, "").includes("20000") &&
          submit && !submit.disabled;
      })()`,
      "the refreshed 20,000 ₽/т price before saving the later receipt",
    );
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
    await waitForExpression(
      cdp,
      `(() => {
        const price = document.querySelector('[data-testid="select-purchase-price"]')?.innerText || "";
        const submit = document.querySelector('[data-testid="button-create-movement"]');
        return price.replace(/[^0-9]/g, "").includes("10000") &&
          submit && !submit.disabled;
      })()`,
      "the refreshed 10,000 ₽/т price before saving the earlier receipt",
    );
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

    const legacyMovement = await pool.query(
      "SELECT id FROM movement WHERE notes = $1",
      [fixtures.legacyMovementNote],
    );
    assert.ok(legacyMovement.rows[0]?.id);
    await navigateToRoute(cdp, "/movement");
    await openRowActionByTestId(
      cdp,
      `movement-row-${legacyMovement.rows[0].id}`,
      "Редактировать",
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-movement-product"]')
        ?.innerText.includes("Керосин") &&
       document.querySelector('[data-testid="select-nomenclature"]')
        ?.innerText.includes("Выберите номенклатуру")`,
      "the legacy movement retaining an empty nomenclature while its type is unchanged",
    );
    await selectComboboxOption(cdp, "select-movement-product", "ПВКЖ");
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-nomenclature"]')
        ?.innerText.includes(${JSON.stringify(fixtures.nomenclatureNames.pvkj)})`,
      "the PVKJ default after changing a legacy movement's product type",
    );
    await clickTestId(cdp, "button-save-draft");
    const updatedLegacyMovement = await waitForDatabaseRow(
      `SELECT product_type, nomenclature_id, is_draft
       FROM movement WHERE id = $1`,
      [legacyMovement.rows[0].id],
      "the legacy movement saved with the new product default",
      (row) =>
        row.product_type === "pvkj" &&
        row.nomenclature_id === nomenclatureIds.pvkj &&
        row.is_draft === true,
    );
    assert.equal(updatedLegacyMovement.product_type, "pvkj");
    await waitForAuditOperations(legacyMovement.rows[0].id, ["UPDATE"]);
    console.log(
      "UI flow passed: legacy movement keeps blank nomenclature until product type changes, then saves the new default",
    );

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
