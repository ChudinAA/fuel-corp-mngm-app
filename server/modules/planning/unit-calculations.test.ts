import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateWarehouseSummaryTonnes,
  calculatePlanningBalanceChainInTonnes,
  legacyKilogramsToTonnes,
  normalizePlanningBalanceFields,
  normalizePlanningVolumeFields,
  planningVolumeTonnes,
  tonnesToLegacyKilograms,
} from "./unit-calculations";

test("planning balance chain starts from tonne stock and persists legacy kilograms", () => {
  const result = calculatePlanningBalanceChainInTonnes("1.00000", [
    {
      id: "income",
      type: "income",
      volume: "50.00",
      volumeTonnes: "0.05000",
      balanceAfter: "1000.00",
      balanceAfterTonnes: "1.00000",
      isManualBalance: false,
    },
    {
      id: "manual",
      type: "income",
      volume: "999.00",
      volumeTonnes: "0.99900",
      balanceAfter: "500.00",
      balanceAfterTonnes: "0.50000",
      isManualBalance: true,
    },
    {
      id: "expense",
      type: "expense",
      volume: "10.00",
      volumeTonnes: "0.01000",
      balanceAfter: null,
      balanceAfterTonnes: null,
      isManualBalance: false,
    },
  ]);

  assert.deepEqual(result, [
    {
      id: "income",
      balanceAfterKg: "1050.00",
      balanceAfterTonnes: "1.05000",
      shouldPersist: true,
    },
    {
      id: "manual",
      balanceAfterKg: "500.00",
      balanceAfterTonnes: "0.50000",
      shouldPersist: false,
    },
    {
      id: "expense",
      balanceAfterKg: "490.00",
      balanceAfterTonnes: "0.49000",
      shouldPersist: true,
    },
  ]);
});

test("planning preserves 0.01 kg plan precision from a tonne stock balance", () => {
  const result = calculatePlanningBalanceChainInTonnes("0.00000", [
    {
      id: "small",
      type: "income",
      volume: "0.01",
      volumeTonnes: "0.00001",
      balanceAfter: null,
      balanceAfterTonnes: null,
      isManualBalance: false,
    },
  ]);

  assert.deepEqual(result, [
    {
      id: "small",
      balanceAfterKg: "0.01",
      balanceAfterTonnes: "0.00001",
      shouldPersist: true,
    },
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

test("warehouse planning summary uses the authoritative tonne stock balance", () => {
  assert.deepEqual(
    calculateWarehouseSummaryTonnes(
      0.01234,
      0.005,
      "1.00001",
      "2.34567",
    ),
    {
      plannedIncomeTonnes: 0.01234,
      plannedExpenseTonnes: 0.005,
      balancePlanTonnes: 1.00001,
      balanceFactTonnes: 2.34567,
    },
  );
});

test("planning writes tonnes as authoritative while maintaining kg mirrors", () => {
  assert.deepEqual(
    normalizePlanningVolumeFields({
      volume: "123.45",
      volumeTonnes: "0.12345",
    }),
    { volume: "123.45", volumeTonnes: "0.12345" },
  );
  assert.deepEqual(
    normalizePlanningVolumeFields({ volume: "0.01" }),
    { volume: "0.01", volumeTonnes: "0.00001" },
  );
  assert.deepEqual(
    normalizePlanningBalanceFields({ balanceAfterTonnes: "0.50000" }),
    { balanceAfter: "500.00", balanceAfterTonnes: "0.50000" },
  );
});

test("legacy-only planning edits win when the submitted tonne value is stale", () => {
  assert.deepEqual(
    normalizePlanningVolumeFields(
      { volume: "12000.00", volumeTonnes: "10.00000" },
      { volume: "10000.00", volumeTonnes: "10.00000" },
    ),
    { volume: "12000.00", volumeTonnes: "12.00000" },
  );
  assert.deepEqual(
    normalizePlanningBalanceFields(
      { balanceAfter: "2500.00", balanceAfterTonnes: "2.00000" },
      { balanceAfter: "2000.00", balanceAfterTonnes: "2.00000" },
    ),
    { balanceAfter: "2500.00", balanceAfterTonnes: "2.50000" },
  );
});

test("planning summary calculations prefer saved tonne fields and fall back to kg", () => {
  assert.equal(
    planningVolumeTonnes(
      { volume: "1000.00", volumeTonnes: "2.34567" },
      "summary volume",
    ),
    2.34567,
  );
  assert.equal(planningVolumeTonnes({ volume: "1000.00" }), 1);
});

test("planning balance conversion fails on malformed mass values", () => {
  assert.throws(
    () =>
      calculatePlanningBalanceChainInTonnes("not-a-number", []),
    /Invalid planning actual balance/,
  );
});
