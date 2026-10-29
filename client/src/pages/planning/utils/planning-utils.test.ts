import assert from "node:assert/strict";
import test from "node:test";
import { fmtTonnes, sumAllocatedForPeriod } from "./planning-utils";

test("planning formatter displays tonne values directly", () => {
  assert.equal(fmtTonnes("1.23456"), "1,23456 т");
  assert.equal(fmtTonnes("0"), "0 т");
  assert.equal(fmtTonnes(null), "—");
});

test("planning allocation summaries sum saved tonnes directly", () => {
  assert.equal(
    sumAllocatedForPeriod(
      [
        {
          periodFrom: "2026-01-01",
          periodTo: "2026-01-31",
          supplierId: "supplier-a",
          volumeTonnes: "1.25",
        },
        {
          periodFrom: "2026-01-01",
          periodTo: "2026-01-31",
          supplierId: "supplier-b",
          volumeTonnes: "9.5",
        },
      ],
      new Date("2026-01-01T00:00:00"),
      new Date("2026-01-31T23:59:59"),
      "supplier-a",
    ),
    1.25,
  );
});
