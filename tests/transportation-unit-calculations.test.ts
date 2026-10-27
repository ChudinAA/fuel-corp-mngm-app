import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateStoredTransportationMassTonnes,
  calculateTransportationAmount,
  calculateTransportationMassTonnes,
  calculateTransportationPricePerTonne,
  formatTransportationPriceOption,
  transportationTonnesToLegacyKg,
} from "../client/src/pages/transportation/unit-calculations";
import { transportationFormSchema } from "../client/src/pages/transportation/schemas";
import { insertTransportationSchema } from "../server/modules/transportation/entities/transportation";

test("transportation quantity is represented in tonnes for tonne and litre input", () => {
  assert.equal(calculateTransportationMassTonnes("tonnes", "1.23456"), 1.23456);
  assert.equal(
    calculateTransportationMassTonnes("liters", "1000", "0.8"),
    0.8,
  );
  assert.equal(
    calculateTransportationMassTonnes("liters", "1000", "0"),
    null,
  );
});

test("transportation prices per kilogram and litre convert using the deal unit", () => {
  assert.equal(calculateTransportationPricePerTonne(2, "kg"), 2_000);
  assert.equal(calculateTransportationPricePerTonne(1.6, "liter", 0.8), 2_000);
  assert.equal(calculateTransportationPricePerTonne(95, "tonne"), 95);
  assert.equal(calculateTransportationPricePerTonne(1.6, "liter"), null);
});

test("per-litre transportation amounts remain unchanged after conversion", () => {
  const tonnes = calculateTransportationMassTonnes("liters", 1_000, 0.8);
  const ratePerTonne = calculateTransportationPricePerTonne(1.6, "liter", 0.8);
  assert.equal(calculateTransportationAmount(ratePerTonne, tonnes ?? 0), 1_600);
  assert.equal(transportationTonnesToLegacyKg(tonnes ?? 0), 800);
});

test("transportation table mass uses deal density before the legacy kilogram field", () => {
  assert.equal(
    calculateStoredTransportationMassTonnes("1000", "1000", "0.8"),
    0.8,
  );
  const fallback = calculateStoredTransportationMassTonnes(
    "1234.56",
    null,
    null,
  );
  assert.ok(fallback !== null && Math.abs(fallback - 1.23456) < 1e-12);
});

test("transportation price choices show two-decimal rates per tonne", () => {
  assert.match(
    formatTransportationPriceOption(1.6, "liter", 0.8),
    /,00 ₽\/т/,
  );
  assert.match(
    formatTransportationPriceOption(1.6, "liter", 0.8),
    /1,60 ₽\/л/,
  );
});

test("transportation forms and API reject litre deals without positive density", () => {
  const formResult = transportationFormSchema.safeParse({
    buyerId: "buyer",
    dealDate: "2026-10-27",
    inputMode: "liters",
    quantityLiters: 1_000,
    density: 0,
  });
  assert.ok(!formResult.success);
  assert.ok(
    !formResult.success &&
      formResult.error.issues.some((issue) => issue.path[0] === "density"),
  );

  const apiResult = insertTransportationSchema.safeParse({
    buyerId: "buyer",
    dealDate: "2026-10-27",
    inputMode: "liters",
    quantityLiters: 1_000,
    quantityKg: 800,
    density: 0,
  });
  assert.ok(!apiResult.success);
  assert.ok(
    !apiResult.success &&
      apiResult.error.issues.some((issue) => issue.path[0] === "density"),
  );
});
