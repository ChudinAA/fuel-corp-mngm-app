import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSupplierBasisPriceRates,
  supplierBasisPriceToApi,
} from "./supplier-basis-price-api-adapters";

test("supplier basis price rates are stored in tonnes without kilogram mirrors", () => {
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

test("unchanged displayed tonne rates preserve stored precision", () => {
  const normalized = normalizeSupplierBasisPriceRates(
    { servicePricePerTonne: "12345.68" },
    { servicePricePerTonne: "12345.678901" },
  );

  assert.equal(normalized.servicePricePerTonne, "12345.678901");
});

test("changed tonne rates are normalized without converting units", () => {
  const normalized = normalizeSupplierBasisPriceRates(
    { pvkjPricePerTonne: "250.01" },
    { pvkjPricePerTonne: "250.000000" },
  );

  assert.equal(normalized.pvkjPricePerTonne, "250.010000");
});

test("kilogram-only API input is rejected", () => {
  assert.throws(
    () => normalizeSupplierBasisPriceRates({ servicePrice: "0.123456" }),
    /больше не поддерживается/,
  );
});

test("supplier basis API responses omit kilogram mirror fields", () => {
  const response = supplierBasisPriceToApi({
    id: "basis-price",
    servicePrice: "12.345",
    servicePricePerTonne: "12345.000000",
    pvkjPrice: null,
    pvkjPricePerTonne: null,
    agentFee: "1.25",
    agentFeePerTonne: "1250.000000",
  });

  assert.equal("servicePrice" in response, false);
  assert.equal("pvkjPrice" in response, false);
  assert.equal("agentFee" in response, false);
  assert.equal(response.servicePricePerTonne, "12345.000000");
});

test("other basis service fields are preserved", () => {
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
