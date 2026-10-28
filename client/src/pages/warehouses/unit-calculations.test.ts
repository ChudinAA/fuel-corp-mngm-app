import assert from "node:assert/strict";
import test from "node:test";
import {
  inventoryInputToWarehouseTonnesPayload,
  tonnesToLegacyWarehouseKilograms,
} from "./unit-calculations";

test("warehouse limits convert tonnes to legacy kilograms", () => {
  assert.equal(tonnesToLegacyWarehouseKilograms("1.23456"), "1234.56");
});

test("inventory converts tonne balance and per-tonne cost at the API boundary", () => {
  assert.deepEqual(
    inventoryInputToWarehouseTonnesPayload({
      productType: "kerosene",
      targetDate: "2026-10-27",
      targetBalance: "2.00001",
      targetAverageCost: "12345.67",
    }),
    {
      productType: "kerosene",
      targetDate: "2026-10-27",
      targetBalanceTonnes: "2.00001",
      targetAverageCostPerTonne: "12345.67",
    },
  );
});
