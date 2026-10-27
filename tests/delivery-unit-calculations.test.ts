import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deliveryRatePerKgForSave,
  deliveryRatePerTonneInputValue,
} from "../client/src/pages/delivery/unit-calculations";

test("legacy delivery rates are shown in rubles per tonne with two decimals", () => {
  assert.equal(deliveryRatePerTonneInputValue("0.123456"), "123.46");
});

test("saving unrelated route edits preserves the original legacy rate precision", () => {
  assert.equal(
    deliveryRatePerKgForSave("123.46", "0.123456"),
    0.123456,
  );
});

test("edited or new per-tonne delivery rates convert back at the API boundary", () => {
  assert.equal(deliveryRatePerKgForSave("123.47", "0.123456"), 0.12347);
  assert.equal(deliveryRatePerKgForSave("123.47"), 0.12347);
});
