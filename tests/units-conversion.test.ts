import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPricePerTonne,
  formatTonnes,
  kilogramsToTonnes,
  pricePerLitreToPerTonne,
  pricePerKilogramToPerTonne,
  pricePerTonneToPerKilogram,
  tonnesToKilograms,
} from "../shared/units";

test("mass conversions preserve the existing kilogram precision", () => {
  assert.equal(kilogramsToTonnes(12_345.67), 12.34567);
  assert.equal(tonnesToKilograms(12.34567), 12_345.67);
  assert.equal(kilogramsToTonnes(0.01), 0.00001);
});

test("per-kilogram and per-tonne prices preserve transaction totals", () => {
  const kg = 12_345.67;
  const pricePerKg = 9.876543;
  const tonnes = kilogramsToTonnes(kg);
  const pricePerTonne = pricePerKilogramToPerTonne(pricePerKg);

  assert.equal(tonnes * pricePerTonne, kg * pricePerKg);
  assert.equal(pricePerTonneToPerKilogram(pricePerTonne), pricePerKg);
});

test("per-litre prices convert using the density of the specific deal", () => {
  const litres = 8_000;
  const density = 0.8;
  const pricePerLitre = 75;
  const massTonnes = kilogramsToTonnes(litres * density);
  const pricePerTonne = pricePerLitreToPerTonne(pricePerLitre, density);

  assert.equal(massTonnes * pricePerTonne, litres * pricePerLitre);
  assert.throws(() => pricePerLitreToPerTonne(75, 0), RangeError);
});

test("unit formatters use five decimals for mass and two for tonne prices", () => {
  assert.equal(formatTonnes(12.3), "12,30000");
  assert.equal(formatTonnes("0.00001"), "0,00001");
  assert.equal(formatPricePerTonne(1234.5), "1 234,50");
});

test("conversions reject invalid numeric input instead of hiding it", () => {
  assert.throws(() => kilogramsToTonnes(Number.NaN), TypeError);
  assert.throws(() => formatTonnes("not-a-number"), TypeError);
});
