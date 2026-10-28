import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeTransportationInput,
  transportationDealToApi,
  transportationResultToApi,
} from "./transportation-api-adapters";

test("transportation API keeps tonne values and writes legacy mirrors", () => {
  const normalized = normalizeTransportationInput({
    inputMode: "tonnes",
    quantityTonnes: 0.025,
    salePricePerTonne: 12_345.67,
    deliveryTariffPerTonne: 300,
    saleAmount: 308.64,
  });

  assert.equal(normalized.quantityTonnes, 0.025);
  assert.equal(normalized.quantityKg, 25);
  assert.equal(normalized.salePricePerTonne, 12_345.67);
  assert.equal(normalized.salePrice, 12.34567);
  assert.equal(normalized.deliveryTariffPerTonne, 300);
  assert.equal(normalized.deliveryTariff, 0.3);
  assert.equal(normalized.saleAmount, 308.64);
});

test("litre-input rates round-trip through the legacy per-liter mirror", () => {
  const normalized = normalizeTransportationInput({
    inputMode: "liters",
    quantityTonnes: 0.08,
    quantityLiters: 100,
    density: 0.8,
    salePricePerTonne: 80_000,
  });

  assert.equal(normalized.quantityKg, 80);
  assert.equal(normalized.salePricePerTonne, 80_000);
  assert.equal(normalized.salePrice, 64);
  const roundTrip = transportationDealToApi({
    ...normalized,
    saleAmount: "5000.00",
  });
  assert.equal(roundTrip.salePricePerTonne, 80_000);
});

test("saved mass and per-liter rate determine historical per-tonne output", () => {
  const result = transportationDealToApi({
    id: "deal",
    quantityKg: "90",
    quantityLiters: "125",
    density: "0.8000",
    inputMode: "liters",
    salePrice: "60.000000",
    saleAmount: "500000.00",
    deliveryTariff: "2.000000",
    deliveryCost: "250.00",
  });

  assert.equal(result.quantityTonnes, 0.09);
  assert.equal(result.salePricePerTonne, 75_000);
  assert.equal(result.deliveryTariffPerTonne, 2_000);
  assert.equal(result.saleAmount, "500000.00");
  assert.equal(result.deliveryCost, "250.00");
  assert.equal("quantityKg" in result, false);
  assert.equal("salePrice" in result, false);
  assert.equal("deliveryTariff" in result, false);
});

test("persisted tonne mass and rates take precedence over conflicting legacy mirrors", () => {
  const result = transportationDealToApi({
    id: "deal",
    quantityKg: "100",
    quantityTonnes: "0.12345",
    quantityLiters: "125",
    density: "0.8",
    inputMode: "liters",
    salePrice: "60.000000",
    salePricePerTonne: "76543.210000",
    deliveryTariff: "2.000000",
    deliveryTariffPerTonne: "2500.000000",
  });

  assert.equal(result.quantityTonnes, 0.12345);
  assert.equal(result.salePricePerTonne, 76_543.21);
  assert.equal(result.deliveryTariffPerTonne, 2_500);
});

test("transportation result adaptation preserves page metadata", () => {
  const result = transportationResultToApi({
    data: [{ id: "deal", quantityKg: "100", saleAmount: "3000" }],
    total: 1,
  }) as { data: Array<Record<string, unknown>>; total: number };

  assert.equal(result.total, 1);
  assert.equal(result.data[0].quantityTonnes, 0.1);
  assert.equal("quantityKg" in result.data[0], false);
});
