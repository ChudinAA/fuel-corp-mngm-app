import assert from "node:assert/strict";
import test from "node:test";
import { summarizeDailyRefueling } from "./daily-refueling-report-utils";

test("daily refueling summary totals tonnes, liters, and unchanged sale amounts", () => {
  const summary = summarizeDailyRefueling([
    {
      quantityTonnes: "0.00125",
      quantityLiters: "1.5625",
      saleAmount: "20.25",
    },
    {
      quantityTonnes: "0.00250",
      quantityLiters: "3.125",
      saleAmount: "40.50",
    },
  ]);

  assert.equal(summary.totalTonnes, 0.00375);
  assert.equal(summary.totalLiters, 4.6875);
  assert.equal(summary.totalRevenue, 60.75);
});

test("daily refueling summary tolerates missing legacy amounts without losing new totals", () => {
  const summary = summarizeDailyRefueling([
    { quantityTonnes: "0.00001", saleAmount: null, totalAmount: "5.00" },
  ]);

  assert.equal(summary.totalTonnes, 0.00001);
  assert.equal(summary.totalRevenue, 5);
});
