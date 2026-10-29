import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateOptTonnes,
  contractPricePerTonne,
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

test("OPT accepts tonne and liter rates but not kilogram rates", () => {
  assert.equal(contractPricePerTonne("12.3456", "tonne", "0.8"), 12.3456);
  assert.equal(contractPricePerTonne("12.3456", "kg", "0.8"), null);
  assert.equal(contractPricePerTonne("8", "liter", "0.8"), 10000);
  assert.equal(contractPricePerTonne("8", "liter", ""), null);
});

test("OPT rates already expressed per tonne remain unchanged", () => {
  assert.equal(contractPricePerTonne("1234.56", "tonne", null), 1234.56);
});
