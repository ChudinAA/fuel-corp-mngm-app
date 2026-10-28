import assert from "node:assert/strict";
import test from "node:test";
import {
  movementDealToApi,
  movementResultToApi,
  normalizeMovementInput,
} from "./movement-api-adapters";

test("movement API keeps tonne fields authoritative and writes kg mirrors", () => {
  const normalized = normalizeMovementInput({
    quantityTonnes: 0.025,
    purchasePricePerTonne: 10_000,
    deliveryPricePerTonne: 250,
    costPerTonne: 12_345.67,
    totalCost: 308.64,
  });

  assert.equal(normalized.quantityTonnes, 0.025);
  assert.equal(normalized.quantityKg, 25);
  assert.equal(normalized.purchasePricePerTonne, 10_000);
  assert.equal(normalized.purchasePrice, 10);
  assert.equal(normalized.deliveryPricePerTonne, 250);
  assert.equal(normalized.deliveryPrice, 0.25);
  assert.equal(normalized.costPerTonne, 12_345.67);
  assert.equal(normalized.costPerKg, 12.34567);
  assert.equal(normalized.totalCost, 308.64);
});

test("movement API uses saved historical mass even when liters disagree", () => {
  const deal = movementDealToApi({
    quantityKg: "12.34",
    quantityTonnes: "0.01234",
    quantityLiters: "15.5",
    density: "0.8",
    inputMode: "liters",
    purchasePrice: "10.000000",
    purchasePricePerTonne: "10000.000000",
    deliveryPrice: "0.250000",
    deliveryPricePerTonne: "250.000000",
    costPerKg: "12.345670",
    costPerTonne: "12345.670000",
  });

  assert.equal(deal.quantityTonnes, 0.01234);
  assert.equal(deal.purchasePricePerTonne, 10_000);
  assert.equal(deal.deliveryPricePerTonne, 250);
  assert.equal(deal.costPerTonne, 12_345.67);
  assert.equal(deal.purchaseAmount, 123.4);
  assert.equal("quantityKg" in deal, false);
  assert.equal("purchasePrice" in deal, false);
  assert.equal("costPerKg" in deal, false);
});

test("movement result adaptation preserves page metadata", () => {
  const result = movementResultToApi({
    data: [{ id: "movement", quantityKg: "25", quantityTonnes: "0.025" }],
    total: 1,
  }) as { data: Array<Record<string, unknown>>; total: number };

  assert.equal(result.total, 1);
  assert.equal(result.data[0].quantityTonnes, 0.025);
  assert.equal("quantityKg" in result.data[0], false);
});
