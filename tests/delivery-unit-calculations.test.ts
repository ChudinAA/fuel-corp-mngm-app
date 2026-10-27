import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deliveryRateForApi,
  deliveryRateInputValue,
} from "../client/src/pages/delivery/unit-calculations";

test("delivery rates stay in rubles per tonne with two decimals", () => {
  assert.equal(deliveryRateInputValue("123.456"), "123.46");
});

test("delivery API payload keeps rates to two decimals", () => {
  assert.equal(deliveryRateForApi("123.46"), "123.46");
});

test("delivery API payload rejects invalid rates", () => {
  assert.throws(
    () => deliveryRateForApi(""),
    /valid delivery price per tonne/i,
  );
});
