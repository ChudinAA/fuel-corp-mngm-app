import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCurrency,
  formatCurrencyForTable,
  normalizeCurrencyForDisplay,
} from "../client/src/pages/refueling/utils";

test("currency display normalizes rounding noise to zero", () => {
  assert.equal(normalizeCurrencyForDisplay(-0.00000000001, 2), 0);
  assert.equal(formatCurrency(-0.00000000001), "0,00 ₽");
  assert.equal(formatCurrencyForTable(-0.00000000001).includes("-"), false);
});

test("currency display preserves a real cent-level loss", () => {
  assert.equal(normalizeCurrencyForDisplay(-0.005, 2), -0.005);
  assert.equal(formatCurrency(-0.005), "-0,01 ₽");
});
