import assert from "node:assert/strict";
import test from "node:test";
import { calculateRefuelingPricePerTonne } from "./unit-calculations";

test("refueling uses API tonne rates directly and converts legacy kg rates", () => {
  assert.equal(calculateRefuelingPricePerTonne(1234.56, "tonnes", null, "tonne"), 1234.56);
  assert.equal(calculateRefuelingPricePerTonne(12.5, "tonnes", null, "kg"), 12500);
});

test("refueling converts per-liter rates using the deal density", () => {
  assert.equal(calculateRefuelingPricePerTonne(12.5, "liters", 0.8, "liter"), 15625);
});
