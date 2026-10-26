import { test } from "node:test";
import assert from "node:assert/strict";
import { getSelectedPriceContract } from "./contract-hint";

const first = { id: "550e8400-e29b-41d4-a716-446655440000", contractNumber: "A-1" };
const second = { id: "550e8400-e29b-41d4-a716-446655440001", contractNumber: "A-2" };
const prices = [first, second];

test("contract lookup preserves a raw UUID ending in digits", () => {
  assert.equal(getSelectedPriceContract(prices, first.id), first);
});
test("contract lookup resolves a composite price and value index", () => {
  assert.equal(getSelectedPriceContract(prices, `${second.id}-12`), second);
});
test("changing the selected price changes its contract", () => {
  assert.notEqual(getSelectedPriceContract(prices, `${first.id}-0`), getSelectedPriceContract(prices, `${second.id}-0`));
});
test("unknown or empty selections do not show an unrelated contract", () => {
  assert.equal(getSelectedPriceContract(prices, ""), undefined);
  assert.equal(getSelectedPriceContract(prices, undefined), undefined);
  assert.equal(getSelectedPriceContract(prices, "missing-0"), undefined);
});
