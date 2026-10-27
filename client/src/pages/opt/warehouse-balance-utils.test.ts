import assert from "node:assert/strict";
import test from "node:test";
import { calculateOptWarehouseBalanceTonnes } from "./warehouse-balance-utils";

test("OPT balance uses tonne snapshots and adds edited deal tonnes", () => {
  assert.equal(
    calculateOptWarehouseBalanceTonnes(
      { balanceTonnes: "2.5", balance: "9000" },
      { balanceTonnes: "2.25", balance: "8000" },
      "1",
      "1000",
      "125.5",
    ),
    2.3755,
  );
});

test("OPT balance converts legacy kilograms and keeps edit balance", () => {
  assert.equal(
    calculateOptWarehouseBalanceTonnes(
      { balance: "1200" },
      { balance: "1100" },
      null,
      "1000",
      "250",
    ),
    1.35,
  );
});

test("OPT balance falls back to the explicit current warehouse tonnes", () => {
  assert.equal(
    calculateOptWarehouseBalanceTonnes(
      undefined,
      undefined,
      "3.12500",
      "9999",
      "0",
    ),
    3.125,
  );
});
