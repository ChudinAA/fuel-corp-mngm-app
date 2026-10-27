import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePlanningBalanceChainInTonnes,
  legacyKilogramsToTonnes,
  tonnesToLegacyKilograms,
} from "./unit-calculations";

test("planning balance chain calculates in tonnes and persists legacy kilograms", () => {
  const result = calculatePlanningBalanceChainInTonnes("1000.00", [
    {
      id: "income",
      type: "income",
      volume: "50.00",
      balanceAfter: "1000.00",
      isManualBalance: false,
    },
    {
      id: "manual",
      type: "income",
      volume: "999.00",
      balanceAfter: "500.00",
      isManualBalance: true,
    },
    {
      id: "expense",
      type: "expense",
      volume: "10.00",
      balanceAfter: null,
      isManualBalance: false,
    },
  ]);

  assert.deepEqual(result, [
    { id: "income", balanceAfterKg: "1050.00", shouldPersist: true },
    { id: "manual", balanceAfterKg: "500.00", shouldPersist: false },
    { id: "expense", balanceAfterKg: "490.00", shouldPersist: true },
  ]);
});

test("planning preserves 0.01 kg precision as 0.00001 tonnes", () => {
  const result = calculatePlanningBalanceChainInTonnes("0.00", [
    {
      id: "small",
      type: "income",
      volume: "0.01",
      balanceAfter: null,
      isManualBalance: false,
    },
  ]);

  assert.deepEqual(result, [
    { id: "small", balanceAfterKg: "0.01", shouldPersist: true },
  ]);
  assert.equal(legacyKilogramsToTonnes("0.01"), 0.00001);
  assert.equal(tonnesToLegacyKilograms(0.00001), "0.01");
});

test("planning summary totals round-trip summed legacy kilograms", () => {
  const totalTonnes = ["0.01", "0.01", "1000.50"].reduce(
    (sum, quantityKg) =>
      sum + legacyKilogramsToTonnes(quantityKg, "summary volume"),
    0,
  );

  assert.equal(tonnesToLegacyKilograms(totalTonnes), "1000.52");
});

test("planning balance conversion fails on malformed mass values", () => {
  assert.throws(
    () =>
      calculatePlanningBalanceChainInTonnes("not-a-number", []),
    /Invalid planning actual balance/,
  );
});
