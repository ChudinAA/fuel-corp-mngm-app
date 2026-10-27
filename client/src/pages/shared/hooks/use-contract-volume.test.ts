import assert from "node:assert/strict";
import test from "node:test";
import { calculateRemainingContractTonnes } from "./use-contract-volume";

test("contract mass limit converts stored kilograms to tonnes", () => {
  const remaining = calculateRemainingContractTonnes({
    totalVolumeKilograms: 1_500,
    usedVolumeTonnes: 0.8,
    initialQuantityTonnes: 0.1,
    currentQuantityTonnes: 0.2,
  });

  assert.ok(Math.abs(remaining - 0.6) < 0.0000001);
});
