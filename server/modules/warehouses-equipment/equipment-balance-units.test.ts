import assert from "node:assert/strict";
import test from "node:test";
import {
  massMirrorFields,
  normalizeEquipmentBalanceFields,
  normalizeEquipmentTransactionMassFields,
  readMassTonnes,
} from "./equipment-balance-units";

test("stored equipment tonnes are authoritative with a legacy kg fallback", () => {
  assert.ok(Math.abs(readMassTonnes("1.23456", "2000") - 1.23456) < 1e-12);
  assert.ok(Math.abs(readMassTonnes(null, "1234.56") - 1.23456) < 1e-12);
  assert.equal(readMassTonnes(undefined, undefined), 0);
});

test("mass mirrors retain five tonne decimals and signed kg values", () => {
  assert.deepEqual(massMirrorFields(-0.01234), {
    tonnes: "-0.01234",
    kilograms: "-12.34",
  });
});

test("equipment balance writes sync tonne-first and legacy kg inputs", () => {
  assert.deepEqual(
    normalizeEquipmentBalanceFields({
      currentBalanceTonnes: "1.23456",
      currentBalance: "2000",
      pvkjBalance: "10.01",
    }),
    {
      currentBalanceTonnes: "1.23456",
      currentBalance: "1234.56",
      pvkjBalanceTonnes: "0.01001",
      pvkjBalance: "10.01",
    },
  );
});

test("equipment ledger writes preserve signed quantity and mirror snapshots", () => {
  assert.deepEqual(
    normalizeEquipmentTransactionMassFields({
      quantity: "-1000",
      quantityTonnes: "-0.12345",
      balanceBefore: "1000",
      balanceAfterTonnes: "0.87655",
    }),
    {
      quantity: "-123.45",
      quantityTonnes: "-0.12345",
      balanceBefore: "1000.00",
      balanceBeforeTonnes: "1.00000",
      balanceAfter: "876.55",
      balanceAfterTonnes: "0.87655",
    },
  );
});
