import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWarehouseLimit } from "./warehouse-limit-units";

test("tonne-native monthly limits retain five decimals and mirror kilograms", () => {
  assert.deepEqual(normalizeWarehouseLimit({ limitVolumeTonnes: "12.34567" }), {
    limitVolumeTonnes: "12.34567",
    limitVolume: "12345.67",
  });
});

test("legacy kilogram limits derive the authoritative tonne value", () => {
  assert.deepEqual(normalizeWarehouseLimit({ limitVolume: "12345.67" }), {
    limitVolume: "12345.67",
    limitVolumeTonnes: "12.34567",
  });
});

test("explicit null clears both monthly-limit representations", () => {
  assert.deepEqual(normalizeWarehouseLimit({ limitVolumeTonnes: null }), {
    limitVolumeTonnes: null,
    limitVolume: null,
  });
});

test("omitted limit fields remain omitted for partial warehouse updates", () => {
  assert.deepEqual(normalizeWarehouseLimit({}), {});
});

test("negative, invalid, and over-precision limits are rejected", () => {
  assert.throws(() => normalizeWarehouseLimit({ limitVolumeTonnes: "-1" }));
  assert.throws(() => normalizeWarehouseLimit({ limitVolumeTonnes: "1.123456" }));
  assert.throws(() => normalizeWarehouseLimit({ limitVolume: "12.345" }));
});
