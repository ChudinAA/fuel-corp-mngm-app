import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLogisticsCapacity } from "./logistics-capacity-units";

test("tonne-native capacity writes preserve five decimals and mirror legacy kg", () => {
  assert.deepEqual(
    normalizeLogisticsCapacity({ capacityTonnes: "12.34567" }),
    { capacityTonnes: "12.34567", capacityKg: "12345.67" },
  );
});

test("legacy kg capacity writes derive the authoritative tonne value", () => {
  assert.deepEqual(
    normalizeLogisticsCapacity({ capacityKg: "12345.67" }),
    { capacityKg: "12345.67", capacityTonnes: "12.34567" },
  );
});

test("explicit tonne null clears both unit representations", () => {
  assert.deepEqual(
    normalizeLogisticsCapacity({ capacityTonnes: null, capacityKg: "50.00" }),
    { capacityTonnes: null, capacityKg: null },
  );
});

test("omitted capacity fields remain omitted on partial updates", () => {
  assert.deepEqual(normalizeLogisticsCapacity({}), {});
});

test("negative, invalid, and over-precision capacities are rejected", () => {
  assert.throws(
    () => normalizeLogisticsCapacity({ capacityTonnes: "-1" }),
    /non-negative decimal/,
  );
  assert.throws(
    () => normalizeLogisticsCapacity({ capacityTonnes: "1.123456" }),
    /at most 5 places/,
  );
  assert.throws(
    () => normalizeLogisticsCapacity({ capacityKg: "12.345" }),
    /at most 2 places/,
  );
});
