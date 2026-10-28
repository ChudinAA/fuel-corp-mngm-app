import assert from "node:assert/strict";
import test from "node:test";
import {
  refuelingDealToApi,
  normalizeRefuelingInput,
} from "./refueling-api-adapters";

test("refueling API converts tonnes and per-tonne rates at the legacy boundary", () => {
  const normalized = normalizeRefuelingInput({
    quantityTonnes: 0.00001,
    purchasePricePerTonne: 10000,
    salePricePerTonne: 15000,
    agentFeeRatePerTonne: 2500,
  });

  assert.equal(normalized.quantityTonnes, 0.00001);
  assert.equal(normalized.quantityKg, 0.01);
  assert.equal(normalized.purchasePricePerTonne, 10000);
  assert.equal(normalized.purchasePrice, 10);
  assert.equal(normalized.salePricePerTonne, 15000);
  assert.equal(normalized.salePrice, 15);
  assert.equal(normalized.agentFeeRatePerTonne, 2500);
  assert.equal(normalized.agentFeeRate, 2.5);
});

test("legacy refueling rates convert from saved kg values and mass comes from kg", () => {
  const apiDeal = refuelingDealToApi({
    quantityKg: "20",
    quantityLiters: "30",
    density: "0.8",
    inputMode: "liters",
    purchaseAmount: "200",
    saleAmount: "300",
    purchasePrice: "8",
    salePrice: "12",
    agentFeeRate: "2.5",
  });

  assert.equal(apiDeal.quantityTonnes, 0.02);
  assert.equal(apiDeal.purchasePricePerTonne, 8000);
  assert.equal(apiDeal.salePricePerTonne, 12000);
  assert.equal(apiDeal.agentFeeRatePerTonne, 2500);
  assert.equal("quantityKg" in apiDeal, false);
  assert.equal("purchasePrice" in apiDeal, false);
  assert.equal("salePrice" in apiDeal, false);
});

test("recharge sale rates exclude enabled fees without changing the deal total", () => {
  const apiDeal = refuelingDealToApi({
    quantityKg: "20",
    quantityLiters: "25",
    density: "0.8",
    purchaseAmount: "200",
    saleAmount: "350",
    agentFee: "10",
    agentFeeRate: "2.5",
    isAgentFeeEnabled: true,
    otherServiceFee: "40",
    isOtherServiceEnabled: true,
    isPriceRecharge: true,
  });

  assert.equal(apiDeal.salePricePerTonne, 15000);
  assert.equal(apiDeal.saleAmount, "350");
});

test("persisted tonne fields override legacy mirrors on API reads", () => {
  const apiDeal = refuelingDealToApi({
    quantityKg: "99",
    quantityTonnes: "0.02",
    purchasePrice: "99",
    purchasePricePerTonne: "777",
    salePrice: "88",
    salePricePerTonne: "888",
    agentFeeRate: "7",
    agentFeeRatePerTonne: "7000",
    purchaseAmount: "200",
    saleAmount: "300",
  });

  assert.equal(apiDeal.quantityTonnes, 0.02);
  assert.equal(apiDeal.purchasePricePerTonne, 777);
  assert.equal(apiDeal.salePricePerTonne, 888);
  assert.equal(apiDeal.agentFeeRatePerTonne, 7000);
  assert.equal(apiDeal.purchaseAmount, "200");
  assert.equal(apiDeal.saleAmount, "300");
});

