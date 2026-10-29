import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPricePerTonne,
  formatTonnes,
  litresAndDensityToTonnes,
  pricePerLitreToPerTonne,
} from "../shared/units";

test("per-litre prices convert using the density of the specific deal", () => {
  const litres = 8_000;
  const density = 0.8;
  const pricePerLitre = 75;
  const massTonnes = litresAndDensityToTonnes(litres, density);
  const pricePerTonne = pricePerLitreToPerTonne(pricePerLitre, density);

  assert.equal(massTonnes * pricePerTonne, litres * pricePerLitre);
  assert.throws(() => pricePerLitreToPerTonne(75, 0), RangeError);
  assert.throws(() => litresAndDensityToTonnes(litres, 0), RangeError);
});

test("unit formatters use five decimals for mass and two for tonne prices", () => {
  assert.equal(formatTonnes(12.3), "12,30000");
  assert.equal(formatTonnes("0.00001"), "0,00001");
  assert.equal(formatPricePerTonne(1234.5), "1 234,50");
});

test("conversions reject invalid numeric input instead of hiding it", () => {
  assert.throws(() => litresAndDensityToTonnes(Number.NaN, 0.8), TypeError);
  assert.throws(() => formatTonnes("not-a-number"), TypeError);
});
