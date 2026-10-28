import assert from "node:assert/strict";
import test from "node:test";
import {
  refuelingAbroadDealToApi,
  refuelingAbroadResultToApi,
  normalizeRefuelingAbroadUnitInput,
  toLegacyRefuelingAbroadInput,
} from "./refueling-abroad-api-adapters";

test("foreign refueling input keeps explicit tonnes and per-tonne rates", () => {
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
  const normalizedInput = toLegacyRefuelingAbroadInput(input);
  assert.equal(normalizedInput.quantityTonnes, 0.01234);
  assert.equal(normalizedInput.purchasePriceUsdPerTonne, 20000);
  assert.equal(normalizedInput.purchasePriceRubPerTonne, 1600000);
  assert.equal(normalizedInput.inputMode, "liters");
  assert.equal("quantityKg" in normalizedInput, false);
  assert.equal("purchasePriceUsd" in normalizedInput, false);

  const dualWritten = normalizeRefuelingAbroadUnitInput(normalizedInput);
  assert.equal(dualWritten.quantityKg, 12.34);
  assert.equal(dualWritten.purchasePriceUsd, 16);
  assert.equal(dualWritten.purchasePriceRub, 1280);
  assert.equal(dualWritten.salePriceUsd, 20);
  assert.equal(dualWritten.salePriceRub, 1600);
});

test("legacy kilogram rates become per-tonne rates while preserving their source values", () => {
  const normalized = normalizeRefuelingAbroadUnitInput({
    inputMode: "kg",
    quantityKg: 20,
    density: 0.8,
    purchasePriceUsd: 7,
    purchasePriceRub: 560,
    salePriceUsd: 9,
    salePriceRub: 720,
  });

  assert.equal(normalized.quantityTonnes, 0.02);
  assert.equal(normalized.purchasePriceUsdPerTonne, 7000);
  assert.equal(normalized.purchasePriceRubPerTonne, 560000);
  assert.equal(normalized.salePriceUsdPerTonne, 9000);
  assert.equal(normalized.salePriceRubPerTonne, 720000);
  assert.equal(normalized.purchasePriceUsd, 7);
});

test("legacy per-litre rates use the saved deal density, not its amount-to-mass ratio", () => {
  const normalized = normalizeRefuelingAbroadUnitInput({
    inputMode: "liters",
    quantityKg: 8,
    quantityLiters: 10,
    density: 0.8,
    purchasePriceUsd: 1,
    purchaseAmountUsd: 20,
  });

  assert.equal(normalized.quantityTonnes, 0.008);
  assert.equal(normalized.purchasePriceUsdPerTonne, 1250);
  assert.equal(normalized.purchasePriceUsd, 1);
  assert.equal(normalized.purchaseAmountUsd, 20);
});

test("an unchanged displayed per-tonne rate retains its saved precision", () => {
  const normalized = normalizeRefuelingAbroadUnitInput(
    {
      inputMode: "tonnes",
      quantityTonnes: 0.02,
      purchasePriceUsdPerTonne: 1000.01,
    },
    {
      inputMode: "tonnes",
      quantityTonnes: "0.02000",
      quantityKg: "20.00",
      purchasePriceUsdPerTonne: "1000.006789",
      purchasePriceUsd: "1.000007",
      density: "0.8",
    },
  );

  assert.equal(normalized.purchasePriceUsdPerTonne, 1000.006789);
  assert.equal(normalized.purchasePriceUsd, 1.000007);
});

test("a legacy-only edit wins when the submitted tonne value is stale", () => {
  const normalized = normalizeRefuelingAbroadUnitInput(
    {
      inputMode: "kg",
      quantityTonnes: 0.02,
      quantityKg: 22,
      purchasePriceUsdPerTonne: 7000,
      purchasePriceUsd: 8,
    },
    {
      inputMode: "kg",
      quantityTonnes: "0.02000",
      quantityKg: "20.00",
      purchasePriceUsdPerTonne: "7000.000000",
      purchasePriceUsd: "7.000000",
      density: "0.8",
    },
  );

  assert.equal(normalized.quantityTonnes, 0.022);
  assert.equal(normalized.purchasePriceUsdPerTonne, 8000);
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

test("stored per-tonne rates take precedence over unchanged historical totals", () => {
  const apiDeal = refuelingAbroadDealToApi({
    quantityKg: "8",
    quantityTonnes: "0.00800",
    quantityLiters: "10",
    density: "0.8",
    inputMode: "liters",
    purchaseAmountUsd: "20",
    purchasePriceUsd: "1",
    purchasePriceUsdPerTonne: "1250.000000",
  });

  assert.equal(apiDeal.purchasePriceUsdPerTonne, 1250);
  assert.equal(apiDeal.purchaseAmountUsd, "20");
  assert.equal(apiDeal.quantityTonnes, 0.008);
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
