import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateStoredTransportationMassTonnes,
  calculateTransportationPricePerTonne,
} from "./unit-calculations";

test("transportation uses API tonne rates directly and converts legacy kg rates", () => {
  assert.equal(calculateTransportationPricePerTonne(1234.56, "tonne"), 1234.56);
  assert.equal(calculateTransportationPricePerTonne(12.5, "kg"), 12500);
});

test("transportation converts per-liter rates using deal density", () => {
  assert.equal(calculateTransportationPricePerTonne(12.5, "liter", 0.8), 15625);
});

test("historical transportation mass uses saved kg, not liters and density", () => {
  assert.equal(calculateStoredTransportationMassTonnes("90", "125", "0.8"), 0.09);
  assert.equal(calculateStoredTransportationMassTonnes(null, "125", "0.8"), null);
});
