import assert from "node:assert/strict";
import test from "node:test";
import {
  refuelingAbroadDealToApi,
  refuelingAbroadInputUsesNormalizedRates,
  refuelingAbroadResultToApi,
  toLegacyRefuelingAbroadInput,
} from "./refueling-abroad-api-adapters";

test("foreign refueling API adapts tonnes and per-tonne currency rates to legacy storage", () => {
  const input = {
    inputMode: "liters",
    quantityTonnes: 0.01234,
    quantityLiters: 15.425,
    density: 0.8,
    purchasePriceUsdPerTonne: 20000,
    purchasePriceRubPerTonne: 1600000,
    salePriceUsdPerTonne: 25000,
    salePriceRubPerTonne: 2000000,
  };
  const legacy = toLegacyRefuelingAbroadInput(input);

  assert.equal(legacy.quantityKg, 12.34);
  assert.equal(legacy.purchasePriceUsd, 20);
  assert.equal(legacy.purchasePriceRub, 1600);
  assert.equal(legacy.salePriceUsd, 25);
  assert.equal(legacy.salePriceRub, 2000);
  assert.equal(legacy.inputMode, "liters");
  assert.equal(refuelingAbroadInputUsesNormalizedRates(input), true);
  assert.equal("quantityTonnes" in legacy, false);
  assert.equal("purchasePriceUsdPerTonne" in legacy, false);
});

test("saved totals become per-tonne foreign prices without changing totals", () => {
  const apiDeal = refuelingAbroadDealToApi({
    quantityKg: "20",
    quantityLiters: "25",
    density: "0.8",
    inputMode: "kg",
    purchaseAmountUsd: "200",
    purchaseAmountRub: "16000",
    saleAmountUsd: "300",
    saleAmountRub: "24000",
    purchasePriceUsd: "7",
    purchasePriceRub: "560",
    salePriceUsd: "9",
    salePriceRub: "720",
  });

  assert.equal(apiDeal.quantityTonnes, 0.02);
  assert.equal(apiDeal.inputMode, "liters");
  assert.equal(apiDeal.purchasePriceUsdPerTonne, 10000);
  assert.equal(apiDeal.purchasePriceRubPerTonne, 800000);
  assert.equal(apiDeal.salePriceUsdPerTonne, 15000);
  assert.equal(apiDeal.salePriceRubPerTonne, 1200000);
  assert.equal(apiDeal.purchaseAmountUsd, "200");
  assert.equal("quantityKg" in apiDeal, false);
  assert.equal("purchasePriceUsd" in apiDeal, false);
});

test("historical per-litre prices use the deal density when totals are absent", () => {
  const apiDeal = refuelingAbroadDealToApi({
    quantityKg: "8",
    quantityLiters: "10",
    density: "0.8",
    inputMode: "liters",
    purchasePriceUsd: "1",
    purchasePriceRub: "80",
    salePriceUsd: "1.5",
    salePriceRub: "120",
    purchaseAmountUsd: null,
    purchaseAmountRub: null,
    saleAmountUsd: null,
    saleAmountRub: null,
  });

  assert.equal(apiDeal.quantityTonnes, 0.008);
  assert.equal(apiDeal.purchasePriceUsdPerTonne, 1250);
  assert.equal(apiDeal.purchasePriceRubPerTonne, 100000);
  assert.equal(apiDeal.salePriceUsdPerTonne, 1875);
  assert.equal(apiDeal.salePriceRubPerTonne, 150000);
});

test("paginated and array deal results are adapted without changing pagination metadata", () => {
  const deal = {
    quantityKg: "10",
    quantityLiters: null,
    density: null,
    inputMode: "kg",
    purchaseAmountUsd: "100",
    purchasePriceUsd: "10",
  };
  const mapped = refuelingAbroadResultToApi({
    data: [deal],
    total: 1,
  }) as { data: Array<Record<string, unknown>>; total: number };

  assert.equal(mapped.total, 1);
  assert.equal(mapped.data[0].quantityTonnes, 0.01);
  assert.equal("quantityKg" in mapped.data[0], false);
});
