import assert from "node:assert/strict";
import test from "node:test";
import { priceSnapshotToCurrentUnits } from "./price-snapshot-units";

test("historical kg snapshots restore only canonical tonne values", () => {
  const source = {
    priceUnit: "kg",
    priceValues: ['{"price":75.12345}'],
    volume: "1234.56",
    soldVolume: "234.56",
    maxDealAmount: "900000.00",
  };
  const result = priceSnapshotToCurrentUnits(source);
  assert.equal(result.priceUnit, "tonne");
  assert.deepEqual(result.priceValues, ['{"price":75123.45}']);
  assert.equal(result.volumeUnit, "tonne");
  assert.equal(result.volume, "1.23456");
  assert.equal(result.soldVolume, "0.23456");
  assert.equal(result.maxDealAmount, "900000.00");
  assert.equal(source.priceUnit, "kg");
});

test("current snapshots are not converted a second time", () => {
  const result = priceSnapshotToCurrentUnits({
    priceUnit: "tonne",
    priceValues: ['{"price":75123.45}'],
    volumeUnit: "tonne",
    volume: "1.23456",
  });
  assert.deepEqual(result.priceValues, ['{"price":75123.45}']);
  assert.equal(result.volume, "1.23456");
});

test("historical litre quotes retain the rate and migrate only contract mass", () => {
  const result = priceSnapshotToCurrentUnits({
    priceUnit: "liter",
    priceValues: ['{"price":12.345678}'],
    volumeUnit: "kg",
    volume: "1000",
    soldVolume: null,
  });
  assert.equal(result.priceUnit, "liter");
  assert.deepEqual(result.priceValues, ['{"price":12.345678}']);
  assert.equal(result.volume, "1.00000");
  assert.equal(result.soldVolume, null);
});

test("missing historical markers use the original kg meaning", () => {
  const result = priceSnapshotToCurrentUnits({
    priceUnit: null,
    priceValues: ["75"],
    volume: "1000",
  });
  assert.equal(result.priceUnit, "tonne");
  assert.deepEqual(result.priceValues, ['{"price":75000}']);
  assert.equal(result.volume, "1.00000");
});

test("partial non-price snapshots do not modify unit markers", () => {
  assert.deepEqual(priceSnapshotToCurrentUnits({ notes: "restored" }), {
    notes: "restored",
  });
});

test("invalid or incomplete historical units fail before restoring a row", () => {
  assert.throws(() => priceSnapshotToCurrentUnits({ priceUnit: "kg" }), /требует/);
  assert.throws(
    () => priceSnapshotToCurrentUnits({ priceUnit: "kg", priceValues: ["bad"] }),
  );
});
