import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveWarehouseAverageCostPerTonne,
  resolveWarehouseBalanceTonnes,
} from "./warehouse-balance-utils";

test("movement prefers explicit tonne balances and per-tonne costs", () => {
  assert.equal(
    resolveWarehouseBalanceTonnes(
      { balanceTonnes: "1.23456", balance: "9999" },
      "3",
      "3000",
    ),
    1.23456,
  );
  assert.equal(
    resolveWarehouseAverageCostPerTonne(
      { averageCostPerTonne: "12345.67", averageCost: "99" },
      "5000",
      "5",
    ),
    12345.67,
  );
});

test("movement converts legacy snapshot and warehouse fields as fallback", () => {
  assert.equal(
    resolveWarehouseBalanceTonnes({ balance: "1250.01" }),
    1.25001,
  );
  assert.equal(
    resolveWarehouseBalanceTonnes(undefined, "0.50000", "500"),
    0.5,
  );
  assert.equal(
    resolveWarehouseAverageCostPerTonne({ averageCost: "12.345678" }),
    12345.678,
  );
  assert.equal(
    resolveWarehouseAverageCostPerTonne(undefined, null, "8.75"),
    8750,
  );
});
