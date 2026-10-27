import assert from "node:assert/strict";
import test from "node:test";
import type { PriceWithApiRate } from "../utils/price-rate";
import {
  calculateRemainingContractTonnes,
  getContractLimitTonnes,
} from "./use-contract-volume";

test("contract remaining mass is calculated in tonnes", () => {
  const remaining = calculateRemainingContractTonnes({
    totalVolumeTonnes: 1.5,
    usedVolumeTonnes: 0.8,
    initialQuantityTonnes: 0.1,
    currentQuantityTonnes: 0.2,
  });

  assert.ok(Math.abs(remaining - 0.6) < 0.0000001);
});

test("contract limit prefers the tonne API field and adapts legacy kilograms", () => {
  const apiPrice = {
    volume: "999999",
    contractVolume: {
      limitUnit: "tonne",
      limit: 1.23456,
      usedUnit: "tonne",
      used: 0.25,
    },
  } as PriceWithApiRate;
  const legacyPrice = { volume: "1234.56" } as PriceWithApiRate;

  assert.ok(Math.abs(getContractLimitTonnes(apiPrice) - 1.23456) < 1e-12);
  assert.ok(Math.abs(getContractLimitTonnes(legacyPrice) - 1.23456) < 1e-12);
});
