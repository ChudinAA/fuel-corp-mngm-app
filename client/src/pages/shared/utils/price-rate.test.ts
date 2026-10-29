import assert from "node:assert/strict";
import test from "node:test";
import {
  extractPriceRate,
  getPriceRateOptions,
  warehouseAverageCostRate,
} from "./price-rate";

const price = {
  id: "12345678-1234-1234-1234-123456789012",
  priceUnit: "tonne",
  priceRate: { unit: "tonne", values: [12.5] },
} as any;

test("selected API rates retain their explicit tonne or liter unit", () => {
  const tonne = extractPriceRate(
    [{ ...price, priceRate: { unit: "tonne", values: [1234.567] } }],
    `${price.id}-0`,
  );
  const liter = extractPriceRate(
    [{ ...price, priceRate: { unit: "liter", values: [12.5] } }],
    `${price.id}-0`,
  );

  assert.deepEqual(tonne, { value: 1234.567, unit: "tonne" });
  assert.deepEqual(liter, { value: 12.5, unit: "liter" });
});

test("API rate options work without legacy priceValues", () => {
  const rates = getPriceRateOptions({
    ...price,
    priceRate: { unit: "tonne", values: [1234.56, null] },
  });

  assert.deepEqual(rates, [
    { value: 1234.56, unit: "tonne" },
    { value: null, unit: "tonne" },
  ]);
});

test("price rate options require the canonical API rate shape", () => {
  assert.deepEqual(getPriceRateOptions(price), [
    { value: 12.5, unit: "tonne" },
  ]);
  assert.deepEqual(getPriceRateOptions({ ...price, priceRate: undefined }), []);
});

test("malformed API rates do not fall back to fabricated legacy values", () => {
  assert.deepEqual(
    extractPriceRate(
      [{ ...price, priceRate: { unit: "tonne", values: [null] } }],
      `${price.id}-0`,
    ),
    { value: null, unit: "tonne" },
  );
});

test("warehouse average cost reads tonne rates only", () => {
  assert.deepEqual(
    warehouseAverageCostRate("12500.25"),
    { value: 12500.25, unit: "tonne" },
  );
  assert.deepEqual(
    warehouseAverageCostRate(null),
    { value: 0, unit: "tonne" },
  );
});
