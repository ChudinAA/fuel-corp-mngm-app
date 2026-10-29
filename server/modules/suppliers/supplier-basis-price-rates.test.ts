import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSupplierBasisPriceRates } from "./supplier-basis-price-rates";

test("supplier basis tonne rates are normalized to six decimal places", () => {
  const normalized = normalizeSupplierBasisPriceRates({
    servicePricePerTonne: 12345.67,
    pvkjPricePerTonne: "250.25",
    agentFeePerTonne: null,
  });

  assert.equal(normalized.servicePricePerTonne, "12345.670000");
  assert.equal(normalized.pvkjPricePerTonne, "250.250000");
  assert.equal(normalized.agentFeePerTonne, null);
});

test("unchanged displayed tonne rates preserve stored precision", () => {
  const normalized = normalizeSupplierBasisPriceRates(
    { servicePricePerTonne: "12345.68" },
    { servicePricePerTonne: "12345.678901" },
  );

  assert.equal(normalized.servicePricePerTonne, "12345.678901");
});

test("changed tonne rates are stored without unit conversion", () => {
  const normalized = normalizeSupplierBasisPriceRates(
    { pvkjPricePerTonne: "250.01" },
    { pvkjPricePerTonne: "250.000000" },
  );

  assert.equal(normalized.pvkjPricePerTonne, "250.010000");
});

test("normalization preserves unrelated supplier basis fields", () => {
  const normalized = normalizeSupplierBasisPriceRates({
    servicePricePerTonne: "100.00",
    otherServiceType: "fixed",
  });

  assert.equal(normalized.servicePricePerTonne, "100.000000");
  assert.equal(normalized.otherServiceType, "fixed");
});
