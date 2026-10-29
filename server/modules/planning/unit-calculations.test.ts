import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePlanningBalanceChainInTonnes,
  calculateWarehouseSummaryTonnes,
  normalizePlanningBalanceFields,
  normalizePlanningVolumeFields,
  planningVolumeTonnes,
} from "./unit-calculations";

test("planning volume normalization stores only tonnes", () => {
  assert.deepEqual(normalizePlanningVolumeFields({ volumeTonnes: "1.234567" }), {
    volumeTonnes: "1.23457",
  });
  assert.equal(normalizePlanningVolumeFields({}), undefined);
  assert.throws(
    () => normalizePlanningVolumeFields({ volumeTonnes: null }),
    /required in tonnes/,
  );
});

test("planning balance normalization accepts only tonnes", () => {
  assert.deepEqual(
    normalizePlanningBalanceFields({ balanceAfterTonnes: "2.500001" }),
    { balanceAfterTonnes: "2.50000" },
  );
  assert.deepEqual(
    normalizePlanningBalanceFields({ balanceAfterTonnes: null }),
    { balanceAfterTonnes: null },
  );
});

test("planning volume readers require the authoritative tonne field", () => {
  assert.equal(planningVolumeTonnes({ volumeTonnes: "0.125" }), 0.125);
  assert.throws(() => planningVolumeTonnes({}), /Missing planning volume/);
});

test("planning balance chain uses tonne balances and preserves precision", () => {
  const result = calculatePlanningBalanceChainInTonnes("1.50000", [
    {
      id: "income",
      type: "income",
      volumeTonnes: "0.12555",
      balanceAfterTonnes: null,
      isManualBalance: false,
    },
    {
      id: "manual",
      type: "expense",
      volumeTonnes: "0.01",
      balanceAfterTonnes: "2.25001",
      isManualBalance: true,
    },
    {
      id: "expense",
      type: "expense",
      volumeTonnes: "0.025",
      balanceAfterTonnes: null,
      isManualBalance: false,
    },
  ]);

  assert.deepEqual(result, [
    { id: "income", balanceAfterTonnes: "1.62555", shouldPersist: true },
    { id: "manual", balanceAfterTonnes: "2.25001", shouldPersist: false },
    { id: "expense", balanceAfterTonnes: "2.22501", shouldPersist: true },
  ]);
});

test("planning warehouse summaries keep all quantities in tonnes", () => {
  assert.deepEqual(calculateWarehouseSummaryTonnes(1.2, 0.2, "1.0", "2.0"), {
    plannedIncomeTonnes: 1.2,
    plannedExpenseTonnes: 0.2,
    balancePlanTonnes: 1,
    balanceFactTonnes: 2,
  });
});
