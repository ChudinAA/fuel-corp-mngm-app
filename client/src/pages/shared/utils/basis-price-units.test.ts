import assert from "node:assert/strict";
import test from "node:test";
import {
  formatLegacyKilogramRatePerTonne,
  formatStoredBasisRatePerTonne,
  formatOtherBasisServiceValue,
  formTonnesRateToNumber,
  formTonnesRateToLegacyKilograms,
  getStoredBasisPriceRate,
  legacyKilogramRateToFormTonnes,
  storedBasisRateToFormTonnes,
} from "./basis-price-units";

test("basis rates show kopecks per tonne and round-trip to legacy storage", () => {
  assert.equal(legacyKilogramRateToFormTonnes("0.123456"), "123.46");
  assert.equal(formatLegacyKilogramRatePerTonne("0.123456"), "123,46");
  assert.equal(formTonnesRateToLegacyKilograms("125.67"), "0.12567");
});

test("an unchanged displayed basis rate preserves its stored precision", () => {
  assert.equal(
    formTonnesRateToLegacyKilograms("123.46", "0.123456"),
    "0.123456",
  );
});

test("tonne-authoritative basis rates drive the form and display", () => {
  assert.equal(storedBasisRateToFormTonnes("123.456789", "0.999999"), "123.46");
  assert.equal(formatStoredBasisRatePerTonne("123.456789", "0.999999"), "123,46");
  assert.equal(formTonnesRateToNumber("123.45"), 123.45);
  assert.equal(formTonnesRateToNumber(""), null);
});

test("basis rates fall back to legacy kilograms before tonnes are stored", () => {
  assert.equal(storedBasisRateToFormTonnes(null, "0.123456"), "123.46");
  assert.equal(formatStoredBasisRatePerTonne(null, "0.123456"), "123,46");
  assert.deepEqual(getStoredBasisPriceRate(null, "0.123456"), {
    value: 0.123456,
    unit: "kg",
  });
  assert.deepEqual(getStoredBasisPriceRate("123.456789", "0.123456"), {
    value: 123.456789,
    unit: "tonne",
  });
});

test("other basis service values retain their own units", () => {
  assert.equal(formatOtherBasisServiceValue("250.5", "royalty_per_ton"), "250,50 ₽/т");
  assert.equal(formatOtherBasisServiceValue("7.5", "percent_of_amount"), "7,50%");
  assert.equal(formatOtherBasisServiceValue("1200", "fixed"), "1 200,00 ₽");
});
