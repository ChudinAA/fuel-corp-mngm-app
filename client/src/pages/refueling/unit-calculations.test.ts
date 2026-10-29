import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateRefuelingPricePerTonne,
  calculateRefuelingMassTonnes,
} from "./unit-calculations";

test("refueling uses tonne rates directly", () => {
  assert.equal(calculateRefuelingPricePerTonne(1234.56, "tonnes", null, "tonne"), 1234.56);
});

test("refueling computes authoritative mass in tonnes", () => {
  assert.equal(calculateRefuelingMassTonnes("tonnes", 0.01045), 0.01045);
  assert.equal(calculateRefuelingMassTonnes("liters", 10, 0.8), 0.008);
});

test("refueling converts per-liter rates using the deal density", () => {
  assert.equal(calculateRefuelingPricePerTonne(12.5, "liters", 0.8, "liter"), 15625);
});
