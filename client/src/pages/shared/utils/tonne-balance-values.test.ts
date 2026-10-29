import assert from "node:assert/strict";
import test from "node:test";
import {
  readAverageCostPerTonne,
  readBalanceTonnes,
} from "./tonne-balance-values";

test("reads authoritative tonne balances and cost rates", () => {
  assert.equal(readBalanceTonnes({ balanceTonnes: "1.23456" }), 1.23456);
  assert.equal(
    readAverageCostPerTonne({ averageCostPerTonne: "12345.67" }),
    12345.67,
  );
});

test("does not infer tonnes from kg-only fields", () => {
  assert.equal(readBalanceTonnes({ balance: "1234.56" }), null);
  assert.equal(readAverageCostPerTonne({ averageCost: "12.34" }), null);
});
