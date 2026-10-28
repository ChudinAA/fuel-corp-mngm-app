import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSupplierBasisPriceRates } from "./supplier-basis-price-api-adapters";

test("tonne rates write kilogram compatibility mirrors", () => {
  const normalized = normalizeSupplierBasisPriceRates({
    servicePricePerTonne: 12345.67,
    pvkjPricePerTonne: "250.25",
    agentFeePerTonne: "1234.56",
  });

  assert.equal(normalized.servicePricePerTonne, "12345.670000");
  assert.equal(normalized.servicePrice, "12.345670");
  assert.equal(normalized.pvkjPricePerTonne, "250.250000");
  assert.equal(normalized.pvkjPrice, "0.250250");
  assert.equal(normalized.agentFeePerTonne, "1234.560000");
  assert.equal(normalized.agentFee, "1.234560");
});

test("legacy kilogram inputs derive per-tonne values", () => {
  const normalized = normalizeSupplierBasisPriceRates({
    servicePrice: "0.123456",
    pvkjPrice: 0.25,
    agentFee: "1.000001",
  });

  assert.equal(normalized.servicePrice, "0.123456");
  assert.equal(normalized.servicePricePerTonne, "123.456000");
  assert.equal(normalized.pvkjPrice, "0.25");
  assert.equal(normalized.pvkjPricePerTonne, "250.000000");
  assert.equal(normalized.agentFee, "1.000001");
  assert.equal(normalized.agentFeePerTonne, "1000.001000");
});

test("unchanged displayed tonne rates preserve both stored precisions", () => {
  const normalized = normalizeSupplierBasisPriceRates(
    {
      servicePricePerTonne: "12345.68",
      servicePrice: "12.345679",
    },
    {
      servicePricePerTonne: "12345.678901",
      servicePrice: "12.345679",
    },
  );

  assert.equal(normalized.servicePricePerTonne, "12345.678901");
  assert.equal(normalized.servicePrice, "12.345679");
});

test("a high-precision tonne edit stays authoritative within the same display cent", () => {
  const normalized = normalizeSupplierBasisPriceRates(
    {
      pvkjPricePerTonne: "250.004",
      pvkjPrice: "0.300000",
    },
    {
      pvkjPricePerTonne: "250.000000",
      pvkjPrice: "0.250000",
    },
  );

  assert.equal(normalized.pvkjPricePerTonne, "250.004000");
  assert.equal(normalized.pvkjPrice, "0.250004");
});

test("a kg-only edit wins when the tonne value is the unchanged display value", () => {
  const normalized = normalizeSupplierBasisPriceRates(
    {
      agentFeePerTonne: "250.25",
      agentFee: "0.300000",
    },
    {
      agentFeePerTonne: "250.250000",
      agentFee: "0.250250",
    },
  );

  assert.equal(normalized.agentFeePerTonne, "300.000000");
  assert.equal(normalized.agentFee, "0.300000");
});

test("a changed tonne rate wins over a stale legacy mirror", () => {
  const normalized = normalizeSupplierBasisPriceRates(
    {
      agentFeePerTonne: "250.00",
      agentFee: "0.200000",
    },
    {
      agentFeePerTonne: "200.000000",
      agentFee: "0.200000",
    },
  );

  assert.equal(normalized.agentFeePerTonne, "250.000000");
  assert.equal(normalized.agentFee, "0.250000");
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
