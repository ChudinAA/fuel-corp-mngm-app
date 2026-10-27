import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateBalanceMassEquivalentTonnes,
  calculateDealMassTonnes,
  calculateDealPricePerTonne,
  priceToPerTonne,
} from "../server/modules/storage-cards/storage/storage-card-mass";

test("supplier card USD balance derives tonnes from a per-kilogram price", () => {
  assert.equal(priceToPerTonne(2, "kg"), 2_000);
  assert.equal(calculateBalanceMassEquivalentTonnes(1_000, 2, "kg"), 0.5);
});

test("supplier card balance derives tonnes from a per-litre price only with deal density", () => {
  assert.equal(priceToPerTonne(1.6, "liter"), null);
  assert.equal(priceToPerTonne(1.6, "liter", 0.8), 2_000);
  assert.equal(
    calculateBalanceMassEquivalentTonnes(2_000, 1.6, "liter", 0.8),
    1,
  );
});

test("tonne-denominated price is not scaled again", () => {
  assert.equal(priceToPerTonne(2_000, "ton"), 2_000);
  assert.equal(calculateBalanceMassEquivalentTonnes(1_000, 2_000, "ton"), 0.5);
});

test("mass equivalent is unavailable for invalid prices or units", () => {
  assert.equal(calculateBalanceMassEquivalentTonnes(100, 0, "kg"), null);
  assert.equal(calculateBalanceMassEquivalentTonnes(100, 2, "liter"), null);
  assert.equal(calculateBalanceMassEquivalentTonnes(100, 2, "unknown"), null);
});

test("deal mass uses stored kilograms or liters multiplied by that deal's density", () => {
  const storedMassTonnes = calculateDealMassTonnes(
    "1234.56789",
    null,
    null,
  );
  assert.ok(
    storedMassTonnes !== null &&
      Math.abs(storedMassTonnes - 1.23456789) < 1e-12,
  );
  assert.equal(calculateDealMassTonnes(0, 1_200, 0.8), 0.96);
  // Older abroad deals may have stored liters in quantityKg; explicit
  // liters+density are the reliable source when both fields are present.
  assert.equal(calculateDealMassTonnes(500, 1_200, 0.8), 0.96);
  assert.equal(calculateDealMassTonnes(500, null, null), 0.5);
  assert.equal(calculateDealMassTonnes(0, 1_200, null), null);
});

test("deal amount is expressed as currency per tonne without early rounding", () => {
  assert.equal(calculateDealPricePerTonne("9600", 0.96), 10_000);
  assert.equal(calculateDealPricePerTonne(100, null), null);
});
