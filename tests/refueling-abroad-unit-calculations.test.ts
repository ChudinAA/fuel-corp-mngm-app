import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateRefuelingAmount,
  calculateRefuelingMassTonnes,
  calculateRefuelingPricePerTonne,
  calculateStoredRefuelingMassTonnes,
} from "../client/src/pages/refueling-abroad/unit-calculations";
import { insertRefuelingAbroadSchema } from "../server/modules/refueling-abroad/entities/refueling-abroad";

test("refueling mass is represented in tonnes for tonne and litre input", () => {
  assert.equal(calculateRefuelingMassTonnes("tonnes", "1.23456"), 1.23456);
  assert.equal(calculateRefuelingMassTonnes("liters", "1000", "0.8"), 0.8);
  assert.equal(calculateRefuelingMassTonnes("liters", "1000", "0"), null);
});

test("per-kilogram and per-litre rates become deal-specific per-tonne rates", () => {
  assert.equal(calculateRefuelingPricePerTonne(2, "tonnes"), 2_000);
  assert.equal(calculateRefuelingPricePerTonne(1.6, "liters", 0.8), 2_000);
  assert.equal(calculateRefuelingPricePerTonne(1.6, "liters"), null);
});

test("converting a per-litre quote to tonnes preserves the deal amount", () => {
  const tonnes = calculateRefuelingMassTonnes("liters", 1_000, 0.8);
  const pricePerTonne = calculateRefuelingPricePerTonne(1.6, "liters", 0.8);
  assert.equal(calculateRefuelingAmount(pricePerTonne, tonnes), 1_600);
});

test("non-draft litre deals require a positive deal density", () => {
  const payload = {
    refuelingDate: "2026-10-27",
    productType: "jet",
    supplierId: "supplier",
    buyerId: "buyer",
    quantityKg: 80,
    inputMode: "liters",
    quantityLiters: 100,
    isDraft: false,
  };

  const invalid = insertRefuelingAbroadSchema.safeParse({
    ...payload,
    density: 0,
  });
  assert.equal(invalid.success, false);
  assert.ok(
    !invalid.success &&
      invalid.error.issues.some((issue) => issue.path[0] === "density"),
  );

  assert.equal(
    insertRefuelingAbroadSchema.safeParse({ ...payload, density: 0.8 }).success,
    true,
  );
});

test("stored legacy litre deals use liters and deal density before the old kg field", () => {
  assert.equal(
    calculateStoredRefuelingMassTonnes("liters", "1000", "1000", "0.8"),
    0.8,
  );
  const kilogramRecordTonnes = calculateStoredRefuelingMassTonnes(
    "kg",
    "1234.56",
    null,
    null,
  );
  assert.ok(
    kilogramRecordTonnes !== null &&
      Math.abs(kilogramRecordTonnes - 1.23456) < 1e-12,
  );
  assert.equal(
    calculateStoredRefuelingMassTonnes("liters", "1000", "1000", null),
    null,
  );
});
