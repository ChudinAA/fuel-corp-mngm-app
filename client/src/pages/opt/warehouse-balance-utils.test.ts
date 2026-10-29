import assert from "node:assert/strict";
import test from "node:test";
import { calculateOptWarehouseBalanceTonnes } from "./warehouse-balance-utils";

test("OPT balance uses tonne snapshots and adds edited deal tonnes", () => {
  assert.equal(
    calculateOptWarehouseBalanceTonnes(
      { balanceTonnes: "2.5", balance: "9000" },
      { balanceTonnes: "2.25", balance: "8000" },
      "0.1255",
    ),
    2.3755,
  );
});

test("OPT balance rejects responses without tonne balances", () => {
  assert.throws(
    () =>
      calculateOptWarehouseBalanceTonnes(
        { balance: "1200" },
        { balance: "1100" },
        "0.25",
      ),
    /missing balanceTonnes/,
  );
});
