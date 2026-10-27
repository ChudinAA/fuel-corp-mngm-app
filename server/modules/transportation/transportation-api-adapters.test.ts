import assert from "node:assert/strict";
import test from "node:test";
import {
  toLegacyTransportationInput,
  transportationDealToApi,
  transportationResultToApi,
} from "./transportation-api-adapters";

test("transportation API tonnes and per-tonne rates adapt to legacy columns", () => {
  const legacy = toLegacyTransportationInput({
    inputMode: "tonnes",
    quantityTonnes: 0.025,
    salePricePerTonne: 12_345.67,
    deliveryTariffPerTonne: 300,
    saleAmount: 308.64,
  });

  assert.equal(legacy.quantityKg, 25);
  assert.equal(legacy.salePrice, 12.34567);
  assert.equal(legacy.deliveryTariff, 0.3);
  assert.equal(legacy.saleAmount, 308.64);
  assert.equal("quantityTonnes" in legacy, false);
});

test("litre-input per-tonne rates adapt back to the saved per-liter quote", () => {
  const legacy = toLegacyTransportationInput({
    inputMode: "liters",
    quantityTonnes: 0.08,
    quantityLiters: 100,
    density: 0.8,
    salePricePerTonne: 80_000,
  });

  assert.equal(legacy.quantityKg, 80);
  assert.equal(legacy.salePrice, 64);
});

test("saved transportation totals determine historical per-tonne rates", () => {
  const result = transportationDealToApi({
    id: "deal",
    quantityKg: "100",
    quantityLiters: "125",
    density: "0.8000",
    inputMode: "liters",
    salePrice: "60.000000",
    saleAmount: "10000.00",
    deliveryTariff: "2.000000",
    deliveryCost: "250.00",
  });

  assert.equal(result.quantityTonnes, 0.1);
  assert.equal(result.salePricePerTonne, 100_000);
  assert.equal(result.deliveryTariffPerTonne, 2_500);
  assert.equal("quantityKg" in result, false);
  assert.equal("salePrice" in result, false);
  assert.equal("deliveryTariff" in result, false);
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
