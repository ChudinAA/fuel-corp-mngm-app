import assert from "node:assert/strict";
import test from "node:test";
import { getBudgetMonthRange } from "./budget-month-range";

test("budget month range accepts a month-only value", () => {
  assert.deepEqual(getBudgetMonthRange("2026-03"), {
    start: "2026-03-01",
    end: "2026-04-01",
  });
});

test("budget month range handles year boundaries and stored timestamps", () => {
  assert.deepEqual(getBudgetMonthRange("2026-12-01T00:00:00.000Z"), {
    start: "2026-12-01",
    end: "2027-01-01",
  });
});

test("budget month range rejects invalid input", () => {
  assert.throws(() => getBudgetMonthRange("2026-13"), RangeError);
  assert.throws(() => getBudgetMonthRange("not-a-month"), TypeError);
});
