import assert from "node:assert/strict";
import test from "node:test";
import {
  equipmentMovementDealToApi,
  equipmentMovementResultToApi,
  normalizeEquipmentMovementInput,
} from "./equipment-movement-api-adapters";

test("equipment movement keeps tonnes authoritative and writes kg compatibility mirrors", () => {
  const normalized = normalizeEquipmentMovementInput({
    quantityTonnes: 0.01523,
    costPerTonne: 12_500.123456,
    totalCost: 187.5,
  });

  assert.equal(normalized.quantityTonnes, "0.01523");
  assert.equal(normalized.quantityKg, "15.23");
  assert.equal(normalized.costPerTonne, "12500.123456");
  assert.equal(normalized.costPerKg, "12.500123");
  assert.equal(normalized.totalCost, 187.5);
});

test("equipment movement API prefers saved mass over liters and legacy mass", () => {
  const deal = equipmentMovementDealToApi({
    quantityKg: "12.34",
    quantityTonnes: "0.01235",
    quantityLiters: "15.5",
    density: "0.8",
    costPerKg: "12.500000",
    costPerTonne: "12499.875000",
  });

  assert.equal(deal.quantityTonnes, 0.01235);
  assert.equal(deal.costPerTonne, 12499.875);
  assert.equal("quantityKg" in deal, false);
  assert.equal("costPerKg" in deal, false);
});

test("equipment movement legacy rows use stored kg rather than inferred liters", () => {
  const deal = equipmentMovementDealToApi({
    quantityKg: "12.34",
    quantityLiters: "15.5",
    density: "0.8",
    costPerKg: "12.500000",
  });

  assert.equal(deal.quantityTonnes, 0.01234);
  assert.equal(deal.costPerTonne, 12_500);
});

test("equipment movement result adaptation preserves page metadata", () => {
  const result = equipmentMovementResultToApi({
    items: [{ id: "equipment-movement", quantityTonnes: "0.025", quantityKg: "25" }],
    total: 1,
  }) as { items: Array<Record<string, unknown>>; total: number };

  assert.equal(result.total, 1);
  assert.equal(result.items[0].quantityTonnes, 0.025);
  assert.equal("quantityKg" in result.items[0], false);
});
