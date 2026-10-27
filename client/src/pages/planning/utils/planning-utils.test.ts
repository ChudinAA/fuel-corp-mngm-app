import assert from "node:assert/strict";
import test from "node:test";
import { fmtTons, kgToTons, tonsToKg } from "./planning-utils";

test("planning mass adapters preserve the legacy 0.01 kg precision", () => {
  assert.equal(kgToTons("1234.56"), "1.23456");
  assert.equal(tonsToKg("1.23456"), "1234.56");
  assert.equal(tonsToKg("0.00001"), "0.01");
});

test("planning mass displays always use five decimal places", () => {
  assert.equal(fmtTons("1234.56"), "1,23456 т");
  assert.equal(fmtTons("0"), "0,00000 т");
  assert.equal(fmtTons(null), "—");
});
