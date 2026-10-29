import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateTransportationMassTonnes,
  calculateTransportationPricePerTonne,
} from "./unit-calculations";

test("transportation calculates mass in tonnes or from liters and density", () => {
  assert.equal(calculateTransportationMassTonnes("tonnes", "1.25"), 1.25);
  assert.equal(
    calculateTransportationMassTonnes("liters", "125", "0.8"),
    0.1,
  );
});

test("transportation converts supported contract price units to per-tonne rates", () => {
  assert.equal(calculateTransportationPricePerTonne(1234.56, "tonne"), 1234.56);
  assert.equal(calculateTransportationPricePerTonne(12.5, "liter", 0.8), 15625);
});
