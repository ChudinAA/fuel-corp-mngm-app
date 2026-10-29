import assert from "node:assert/strict";
import test from "node:test";
import {
  formatStoredBasisRatePerTonne,
  formatOtherBasisServiceValue,
  formTonnesRateToNumber,
  getStoredBasisPriceRate,
  storedBasisRateToFormTonnes,
} from "./basis-price-units";

test("tonne-authoritative basis rates drive the form and display", () => {
  assert.equal(storedBasisRateToFormTonnes("123.456789"), "123.46");
  assert.equal(formatStoredBasisRatePerTonne("123.456789"), "123,46");
  assert.equal(formTonnesRateToNumber("123.45"), 123.45);
  assert.equal(formTonnesRateToNumber(""), null);
});

test("missing tonne rates remain empty and do not read kilogram fallbacks", () => {
  assert.equal(storedBasisRateToFormTonnes(null), "");
  assert.equal(formatStoredBasisRatePerTonne(null), "");
  assert.equal(getStoredBasisPriceRate(null), null);
  assert.deepEqual(getStoredBasisPriceRate("123.456789"), {
    value: 123.456789,
    unit: "tonne",
  });
});

test("other basis service values retain their own units", () => {
  assert.equal(formatOtherBasisServiceValue("250.5", "royalty_per_ton"), "250,50 ₽/т");
  assert.equal(formatOtherBasisServiceValue("7.5", "percent_of_amount"), "7,50%");
  assert.equal(formatOtherBasisServiceValue("1200", "fixed"), "1 200,00 ₽");
});
