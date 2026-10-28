import assert from "node:assert/strict";
import test from "node:test";
import { exchangeDealMovementUnitFields } from "./exchange-deal-movement-units";

test("exchange deal movements store tonnes and rates as authoritative values", () => {
  assert.deepEqual(exchangeDealMovementUnitFields(1.234567, 12_345.6789), {
    quantityTonnes: "1.23457",
    quantityKg: "1234.57",
    purchasePricePerTonne: "12345.678900",
    purchasePrice: "12.345679",
    costPerTonne: "12345.678900",
    costPerKg: "12.345679",
  });
});

test("exchange deal movement unit conversion rejects non-finite inputs", () => {
  assert.throws(
    () => exchangeDealMovementUnitFields(Number.NaN, 10_000),
    /finite numbers/,
  );
});
