import assert from "node:assert/strict";
import test from "node:test";
import {
  extractPriceRate,
  getPriceRateOptions,
  warehouseAverageCostRate,
} from "./price-rate";

const legacyPrice = {
  id: "12345678-1234-1234-1234-123456789012",
  priceValues: ['{"price":"12.5"}'],
  priceUnit: "kg",
} as any;

test("selected API rates retain their explicit tonne or liter unit", () => {
  const tonne = extractPriceRate(
    [{ ...legacyPrice, priceRate: { unit: "tonne", values: [1234.567] } }],
    `${legacyPrice.id}-0`,
  );
  const liter = extractPriceRate(
    [{ ...legacyPrice, priceRate: { unit: "liter", values: [12.5] } }],
    `${legacyPrice.id}-0`,
  );

  assert.deepEqual(tonne, { value: 1234.567, unit: "tonne" });
  assert.deepEqual(liter, { value: 12.5, unit: "liter" });
});

test("API rate options work without legacy priceValues", () => {
  const rates = getPriceRateOptions({
    ...legacyPrice,
    priceValues: null,
    priceRate: { unit: "tonne", values: [1234.56, null] },
  });

  assert.deepEqual(rates, [
    { value: 1234.56, unit: "tonne" },
    { value: null, unit: "tonne" },
  ]);
});

test("legacy rates retain their stored kg or liter unit", () => {
  assert.deepEqual(
    extractPriceRate([legacyPrice], `${legacyPrice.id}-0`),
    { value: 12.5, unit: "kg" },
  );
  assert.deepEqual(
    extractPriceRate(
      [{ ...legacyPrice, priceUnit: "liter" }],
      `${legacyPrice.id}-0`,
    ),
    { value: 12.5, unit: "liter" },
  );
});

test("malformed API rates do not fall back to fabricated legacy values", () => {
  assert.deepEqual(
    extractPriceRate(
      [{ ...legacyPrice, priceRate: { unit: "tonne", values: [null] } }],
      `${legacyPrice.id}-0`,
    ),
    { value: null, unit: "tonne" },
  );
});

test("warehouse average cost prefers per-tonne rates and retains kg fallback", () => {
  assert.deepEqual(
    warehouseAverageCostRate("12500.25", "12.5"),
    { value: 12500.25, unit: "tonne" },
  );
  assert.deepEqual(
    warehouseAverageCostRate(null, "12.5"),
    { value: 12.5, unit: "kg" },
  );
  assert.deepEqual(
    warehouseAverageCostRate("invalid", "12.5"),
    { value: 12.5, unit: "kg" },
  );
});
