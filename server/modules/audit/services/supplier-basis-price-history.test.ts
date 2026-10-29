import assert from "node:assert/strict";
import test from "node:test";
import { supplierBasisPriceSnapshotToCurrentUnits } from "./supplier-basis-price-history";

test("historical supplier rates restore in per-tonne fields only", () => {
  const result = supplierBasisPriceSnapshotToCurrentUnits({
    name: "supplier",
    basisPrices: [
      {
        basisId: "basis",
        servicePrice: "0.123456",
        pvkjPrice: "0.25",
        agentFee: "1.000001",
        otherServiceType: "fixed",
      },
    ],
  });
  assert.deepEqual(result.basisPrices, [
    {
      basisId: "basis",
      servicePricePerTonne: "123.456000",
      pvkjPricePerTonne: "250.000000",
      agentFeePerTonne: "1000.001000",
      otherServiceType: "fixed",
    },
  ]);
});

test("historical tonne rates win when both old and current units exist", () => {
  const result = supplierBasisPriceSnapshotToCurrentUnits({
    basisPrices: [
      {
        servicePrice: "0.1",
        servicePricePerTonne: "150.123456",
      },
    ],
  });
  assert.deepEqual(result.basisPrices, [
    { servicePricePerTonne: "150.123456" },
  ]);
});

test("invalid historical supplier rates fail before restoration", () => {
  assert.throws(
    () =>
      supplierBasisPriceSnapshotToCurrentUnits({
        basisPrices: [{ servicePrice: "not-a-rate" }],
      }),
    /историческая ставка/,
  );
});

test("snapshots without supplier basis rates remain unchanged", () => {
  assert.deepEqual(
    supplierBasisPriceSnapshotToCurrentUnits({ basisPrices: null }),
    { basisPrices: null },
  );
});
