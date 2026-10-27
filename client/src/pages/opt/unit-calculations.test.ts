import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateOptTonnes,
  contractPricePerKilogram,
  contractPricePerTonne,
  optTonnesToLegacyKilograms,
} from "./unit-calculations";

test("OPT quantity accepts tonnes or liters with deal density", () => {
  assert.equal(
    calculateOptTonnes({
      inputMode: "tonnes",
      quantityTonnes: "1.23456",
      quantityLiters: "",
      density: "",
    }),
    1.23456,
  );
  assert.equal(
    calculateOptTonnes({
      inputMode: "liters",
      quantityTonnes: "",
      quantityLiters: "1000",
      density: "0.8",
    }),
    0.8,
  );
  assert.equal(
    calculateOptTonnes({
      inputMode: "liters",
      quantityTonnes: "",
      quantityLiters: "1000",
      density: "",
    }),
    0,
  );
});

test("OPT rates convert from kg or liters to rubles per tonne", () => {
  assert.ok(
    Math.abs(
      (contractPricePerTonne("12.3456", "kg", "0.8") || 0) - 12345.6,
    ) < 1e-8,
  );
  assert.equal(contractPricePerTonne("8", "liter", "0.8"), 10000);
  assert.equal(contractPricePerKilogram("8", "liter", "0.8"), 10);
  assert.equal(contractPricePerTonne("8", "liter", ""), null);
});

test("OPT keeps the legacy API quantity in kilograms", () => {
  assert.equal(optTonnesToLegacyKilograms(1.23456), 1234.56);
});
