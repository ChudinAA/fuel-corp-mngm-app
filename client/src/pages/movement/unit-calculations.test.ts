import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateMovementMassTonnes,
  calculateMovementPricePerTonne,
  formatMovementPriceOption,
  movementTonnesRateToLegacyKgRate,
  movementTonnesToLegacyKg,
} from "./unit-calculations";
import { movementFormSchema } from "./schemas";

test("movement mass inputs resolve to tonnes at five-decimal display precision", () => {
  assert.equal(
    calculateMovementMassTonnes("tonnes", "0.60000", "", ""),
    0.6,
  );
  assert.equal(
    calculateMovementMassTonnes("liters", "", "750", "0.8"),
    0.6,
  );
  assert.equal(
    calculateMovementMassTonnes("liters", "", "750", "0"),
    null,
  );
});

test("legacy per-kilogram and per-liter prices convert to per-tonne rates", () => {
  assert.equal(calculateMovementPricePerTonne(80, "kg", null), 80_000);
  assert.equal(calculateMovementPricePerTonne(70, "liter", 0.8), 87_500);
  assert.equal(calculateMovementPricePerTonne(70, "liter", null), null);

  const liters = 750;
  const density = 0.8;
  const tonnes = calculateMovementMassTonnes(
    "liters",
    "",
    liters,
    density,
  );
  const pricePerTonne = calculateMovementPricePerTonne(
    70,
    "liter",
    density,
  );
  assert.equal(tonnes, 0.6);
  assert.equal((tonnes ?? 0) * (pricePerTonne ?? 0), liters * 70);
});

test("legacy API conversions preserve mass and rate dimensions", () => {
  assert.equal(movementTonnesToLegacyKg(0.6), 600);
  assert.equal(movementTonnesRateToLegacyKgRate(87_500), 87.5);
});

test("movement price options show the converted rate and source liter rate", () => {
  const option = formatMovementPriceOption(70, "liter", 0.8);
  assert.match(option, /87.?500,00 ₽\/т/);
  assert.match(option, /70,00 ₽\/л/);
});

test("movement form validates tonnes and liters with positive density", () => {
  assert.equal(
    movementFormSchema.safeParse({
      inputMode: "tonnes",
      quantityTonnes: "0.00001",
    }).success,
    true,
  );
  assert.equal(
    movementFormSchema.safeParse({
      inputMode: "tonnes",
      quantityTonnes: "0",
    }).success,
    false,
  );
  assert.equal(
    movementFormSchema.safeParse({
      inputMode: "liters",
      quantityLiters: "750",
      density: "0.8",
    }).success,
    true,
  );
  assert.equal(
    movementFormSchema.safeParse({
      inputMode: "liters",
      quantityLiters: "750",
      density: "0",
    }).success,
    false,
  );
});
