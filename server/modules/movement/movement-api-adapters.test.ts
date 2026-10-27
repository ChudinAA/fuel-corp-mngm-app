import assert from "node:assert/strict";
import test from "node:test";
import {
  movementDealToApi,
  movementResultToApi,
  toLegacyMovementInput,
} from "./movement-api-adapters";

test("movement API adapts tonne masses and rates to legacy storage units", () => {
  const legacy = toLegacyMovementInput({
    quantityTonnes: 0.025,
    purchasePricePerTonne: 10_000,
    deliveryPricePerTonne: 250,
    costPerTonne: 12_345.67,
    totalCost: 308.64,
  });

  assert.equal(legacy.quantityKg, 25);
  assert.equal(legacy.purchasePrice, 10);
  assert.equal(legacy.deliveryPrice, 0.25);
  assert.equal(legacy.costPerKg, 12.34567);
  assert.equal(legacy.totalCost, 308.64);
  assert.equal("quantityTonnes" in legacy, false);
});

test("movement API preserves 5-place mass from liters and density", () => {
  const deal = movementDealToApi({
    quantityKg: "12.34",
    quantityLiters: "15.5",
    density: "0.8",
    inputMode: "liters",
    purchasePrice: "10.000000",
    deliveryPrice: "0.250000",
    costPerKg: "12.345670",
  });

  assert.equal(deal.quantityTonnes, 0.0124);
  assert.equal(deal.purchasePricePerTonne, 10_000);
  assert.equal(deal.deliveryPricePerTonne, 250);
  assert.equal(deal.costPerTonne, 12_345.67);
  assert.equal("quantityKg" in deal, false);
  assert.equal("purchasePrice" in deal, false);
  assert.equal("costPerKg" in deal, false);
});

test("movement result adaptation preserves page metadata", () => {
  const result = movementResultToApi({
    data: [{ id: "movement", quantityKg: "25" }],
    total: 1,
  }) as { data: Array<Record<string, unknown>>; total: number };

  assert.equal(result.total, 1);
  assert.equal(result.data[0].quantityTonnes, 0.025);
  assert.equal("quantityKg" in result.data[0], false);
});
