import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateRefuelingAmount,
  calculateRefuelingMassTonnes,
  calculateRefuelingPricePerTonne,
  formatRefuelingPriceOption,
} from "../client/src/pages/refueling/unit-calculations";
import { insertAircraftRefuelingSchema } from "../server/modules/refueling/entities/refueling";

test("domestic refueling accepts tonnes and derives tonnes from liters and density", () => {
  assert.equal(calculateRefuelingMassTonnes("tonnes", "1.23456"), 1.23456);
  assert.equal(calculateRefuelingMassTonnes("liters", "1000", "0.8"), 0.8);
  assert.equal(calculateRefuelingMassTonnes("liters", "1000", "0"), null);
});

test("domestic refueling uses tonne prices and converts per-litre prices by density", () => {
  assert.equal(calculateRefuelingPricePerTonne(2, "tonnes"), 2);
  assert.equal(calculateRefuelingPricePerTonne(1.6, "liters", 0.8), 2_000);
  assert.equal(
    calculateRefuelingPricePerTonne(95, "tonnes", null, "tonne"),
    95,
  );
  assert.equal(calculateRefuelingPricePerTonne(1.6, "liters"), null);
});

test("per-litre amount is unchanged by conversion to tonnes", () => {
  const tonnes = calculateRefuelingMassTonnes("liters", 1_000, 0.8);
  const pricePerTonne = calculateRefuelingPricePerTonne(1.6, "liters", 0.8);
  assert.equal(calculateRefuelingAmount(pricePerTonne, tonnes ?? 0), 1_600);
});

test("price option labels use per-tonne rates and preserve the source per-litre quote", () => {
  const label = formatRefuelingPriceOption(1.6, "liters", 0.8);
  assert.match(label, /,00 ₽\/т/);
  assert.match(label, /1,60 ₽\/л/);
  assert.match(
    formatRefuelingPriceOption(2, "tonnes", null, "₽", "tonne"),
    /2,00 ₽\/т$/,
  );
});

test("non-draft litre refueling requires positive density", () => {
  const result = insertAircraftRefuelingSchema.safeParse({
    isDraft: false,
    inputMode: "liters",
    quantityLiters: 100,
    density: 0,
  });
  assert.ok(!result.success);
  assert.ok(
    !result.success &&
      result.error.issues.some((issue) => issue.path[0] === "density"),
  );
});
