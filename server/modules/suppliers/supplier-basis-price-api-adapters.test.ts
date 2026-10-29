import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSupplierBasisPriceRates,
  SupplierBasisPriceRateInputError,
  supplierBasisPriceToApi,
} from "./supplier-basis-price-api-adapters";

test("supplier basis rates store only tonne-authoritative values", () => {
  const normalized = normalizeSupplierBasisPriceRates({
    servicePricePerTonne: 12345.67,
    pvkjPricePerTonne: "250.25",
    agentFeePerTonne: "1234.56",
  });

  assert.equal(normalized.servicePricePerTonne, "12345.670000");
  assert.equal(normalized.pvkjPricePerTonne, "250.250000");
  assert.equal(normalized.agentFeePerTonne, "1234.560000");
  assert.equal("servicePrice" in normalized, false);
  assert.equal("pvkjPrice" in normalized, false);
  assert.equal("agentFee" in normalized, false);
});

test("obsolete kilogram basis-rate payloads are rejected", () => {
  for (const legacyKey of ["servicePrice", "pvkjPrice", "agentFee"]) {
    assert.throws(
      () => normalizeSupplierBasisPriceRates({ [legacyKey]: 1 }),
      SupplierBasisPriceRateInputError,
    );
  }
});

test("invalid tonne rates fail and explicit null clears only the tonne value", () => {
  assert.throws(
    () => normalizeSupplierBasisPriceRates({ servicePricePerTonne: "invalid" }),
    /Некорректное значение/,
  );
  assert.equal(
    normalizeSupplierBasisPriceRates({ servicePricePerTonne: null })
      .servicePricePerTonne,
    null,
  );
});

test("unchanged displayed rates preserve saved tonne precision", () => {
  const normalized = normalizeSupplierBasisPriceRates(
    { servicePricePerTonne: "123.46" },
    { servicePricePerTonne: "123.456789" },
  );
  assert.equal(normalized.servicePricePerTonne, "123.456789");

  const edited = normalizeSupplierBasisPriceRates(
    { servicePricePerTonne: "123.47" },
    { servicePricePerTonne: "123.456789" },
  );
  assert.equal(edited.servicePricePerTonne, "123.470000");
});

test("non-rate service fields are returned unchanged", () => {
  const normalized = normalizeSupplierBasisPriceRates({
    servicePricePerTonne: "100.00",
    otherServiceType: "fixed",
    otherServiceValue: "25.50",
    otherServiceQuantity: "3",
  });

  assert.equal(normalized.otherServiceType, "fixed");
  assert.equal(normalized.otherServiceValue, "25.50");
  assert.equal(normalized.otherServiceQuantity, "3");
});

test("supplier API responses omit legacy kilogram rate fields", () => {
  const api = supplierBasisPriceToApi({
    servicePrice: "1",
    servicePricePerTonne: "1000",
    pvkjPrice: null,
    pvkjPricePerTonne: "250",
    basisId: "basis-1",
  });

  assert.deepEqual(api, {
    servicePricePerTonne: "1000",
    pvkjPricePerTonne: "250",
    basisId: "basis-1",
  });
});
