import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateBalanceMassEquivalentTonnes,
  calculateDealMassTonnes,
  calculateDealPricePerTonne,
  priceToPerTonne,
} from "../server/modules/storage-cards/storage/storage-card-mass";

test("supplier card balance derives tonnes from a tonne-denominated price", () => {
  assert.equal(priceToPerTonne(2_000, "tonne"), 2_000);
  assert.equal(calculateBalanceMassEquivalentTonnes(1_000, 2_000, "tonne"), 0.5);
});

test("supplier card balance derives tonnes from a per-litre price only with deal density", () => {
  assert.equal(priceToPerTonne(1.6, "liter"), null);
  assert.equal(priceToPerTonne(1.6, "liter", 0.8), 2_000);
  assert.equal(
    calculateBalanceMassEquivalentTonnes(2_000, 1.6, "liter", 0.8),
    1,
  );
});

test("legacy and unknown price units are rejected", () => {
  assert.equal(priceToPerTonne(2, "kg"), null);
  assert.equal(priceToPerTonne(2, "ton"), null);
  assert.equal(priceToPerTonne(2, "t"), null);
  assert.equal(calculateBalanceMassEquivalentTonnes(100, 2, "kg"), null);
  assert.equal(calculateBalanceMassEquivalentTonnes(100, 0, "tonne"), null);
  assert.equal(calculateBalanceMassEquivalentTonnes(100, 2, "liter"), null);
  assert.equal(calculateBalanceMassEquivalentTonnes(100, 2, "unknown"), null);
});

test("storage-card deal summaries use only the saved tonne quantity", () => {
  assert.equal(calculateDealMassTonnes("1.234567"), 1.234567);
  assert.equal(calculateDealMassTonnes(null), null);
  assert.equal(calculateDealMassTonnes(-1), null);
  assert.equal(calculateDealPricePerTonne("9600", 0.96), 10_000);
  assert.equal(calculateDealPricePerTonne(100, null), null);
});
