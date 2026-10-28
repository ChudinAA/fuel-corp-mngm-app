import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWarehouseBalanceUnits } from "./warehouse-balance-units";

test("tonne balances keep five decimals and update the kg mirror", () => {
  assert.deepEqual(
    normalizeWarehouseBalanceUnits({ currentBalanceTonnes: "1.23456" }),
    { currentBalanceTonnes: "1.23456", currentBalance: "1234.56" },
  );
});

test("legacy kg balances derive tonnes without changing their sign", () => {
  assert.deepEqual(
    normalizeWarehouseBalanceUnits({ pvkjBalance: "-12.34" }),
    { pvkjBalance: "-12.34", pvkjBalanceTonnes: "-0.01234" },
  );
});

test("partial updates do not alter omitted stock balances", () => {
  assert.deepEqual(normalizeWarehouseBalanceUnits({}), {});
});

test("balance clears and invalid precision are explicit", () => {
  assert.deepEqual(
    normalizeWarehouseBalanceUnits({ currentBalanceTonnes: null }),
    { currentBalanceTonnes: null, currentBalance: null },
  );
  assert.throws(() =>
    normalizeWarehouseBalanceUnits({ currentBalanceTonnes: "1.123456" }),
  );
});
