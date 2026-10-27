import assert from "node:assert/strict";
import test from "node:test";
import { equipmentToApi } from "./equipment-api-adapters";

test("equipment API adds tonne balances and preserves legacy kilogram fields", () => {
  const result = equipmentToApi({
    id: "equipment-1",
    currentBalance: "1234.56",
    pvkjBalance: "0.01",
  });

  assert.equal(result.currentBalance, "1234.56");
  assert.equal(result.pvkjBalance, "0.01");
  assert.equal(result.currentBalanceTonnes, "1.23456");
  assert.equal(result.pvkjBalanceTonnes, "0.00001");
});

test("equipment API treats missing balances as zero tonnes", () => {
  const result = equipmentToApi({ currentBalance: null, pvkjBalance: undefined });

  assert.equal(result.currentBalanceTonnes, "0.00000");
  assert.equal(result.pvkjBalanceTonnes, "0.00000");
});
