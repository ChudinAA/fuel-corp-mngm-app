import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateRefuelingAmount,
  calculateRefuelingMassTonnes,
  calculateRefuelingPricePerTonne,
  calculateStoredRefuelingMassTonnes,
} from "../client/src/pages/refueling-abroad/unit-calculations";

test("refueling mass is represented in tonnes for tonne and litre input", () => {
  assert.equal(calculateRefuelingMassTonnes("tonnes", "1.23456"), 1.23456);
  assert.equal(calculateRefuelingMassTonnes("liters", "1000", "0.8"), 0.8);
  assert.equal(calculateRefuelingMassTonnes("liters", "1000", "0"), null);
});

test("per-kilogram and per-litre rates become deal-specific per-tonne rates", () => {
  assert.equal(calculateRefuelingPricePerTonne(2, "tonnes"), 2_000);
  assert.equal(calculateRefuelingPricePerTonne(1.6, "liters", 0.8), 2_000);
  assert.equal(calculateRefuelingPricePerTonne(1.6, "liters"), null);
});

test("converting a per-litre quote to tonnes preserves the deal amount", () => {
  const tonnes = calculateRefuelingMassTonnes("liters", 1_000, 0.8);
  const pricePerTonne = calculateRefuelingPricePerTonne(1.6, "liters", 0.8);
  assert.equal(calculateRefuelingAmount(pricePerTonne, tonnes), 1_600);
});

test("stored legacy litre deals use liters and deal density before the old kg field", () => {
  assert.equal(
    calculateStoredRefuelingMassTonnes("liters", "1000", "1000", "0.8"),
    0.8,
  );
  assert.equal(
    calculateStoredRefuelingMassTonnes("kg", "1234.56", null, null),
    1.23456,
  );
  assert.equal(
    calculateStoredRefuelingMassTonnes("liters", "1000", "1000", null),
    null,
  );
});
