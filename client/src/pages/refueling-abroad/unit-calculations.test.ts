import assert from "node:assert/strict";
import test from "node:test";
import { calculateRefuelingPricePerTonne } from "./unit-calculations";

test("foreign refueling uses tonne rates directly", () => {
  assert.equal(calculateRefuelingPricePerTonne(1234.56, "tonnes", null, "tonne"), 1234.56);
});

test("foreign refueling converts per-liter rates using deal density", () => {
  assert.equal(calculateRefuelingPricePerTonne(12.5, "liters", 0.8, "liter"), 15625);
});
