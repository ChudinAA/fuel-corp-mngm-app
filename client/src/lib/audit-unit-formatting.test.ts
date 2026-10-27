import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPricePerTonne,
  formatTonnes,
} from "@shared/units";
import { formatValue } from "./audit-helpers";

test("audit shows legacy kilogram quantities as tonnes", () => {
  assert.equal(formatValue("1234.56789", "quantityKg"), formatTonnes(1.23456789));
});

test("audit displays explicit tonne quantities without converting twice", () => {
  assert.equal(formatValue("1.23456", "quantityTonnes"), formatTonnes(1.23456));
});

test("audit displays explicit per-tonne prices with two decimals", () => {
  for (const field of [
    "purchasePricePerTonne",
    "salePricePerTonne",
    "purchasePriceUsdPerTonne",
    "purchasePriceRubPerTonne",
    "salePriceUsdPerTonne",
    "salePriceRubPerTonne",
    "deliveryTariffPerTonne",
    "agentFeeRatePerTonne",
  ]) {
    assert.equal(
      formatValue("1234.567", field),
      formatPricePerTonne(1234.567),
    );
  }
});

test("legacy foreign prices convert to per-tonne values using the deal input unit", () => {
  const litreSnapshot = { inputMode: "liters", density: "0.8" };
  assert.equal(
    formatValue("8", "purchasePriceUsd", null, litreSnapshot),
    formatPricePerTonne(10000),
  );
  assert.equal(
    formatValue("8", "salePriceRub", null, litreSnapshot),
    formatPricePerTonne(10000),
  );
  assert.equal(
    formatValue("8", "purchasePriceUsd", null, { inputMode: "kg" }),
    formatPricePerTonne(8000),
  );
});

test("audit shows per-kilogram rates as two-decimal per-tonne prices", () => {
  assert.equal(
    formatValue("1.234567", "costPerKg"),
    formatPricePerTonne(1234.567),
  );
  assert.equal(
    formatValue("0.025", "agentFeeRate"),
    formatPricePerTonne(25),
  );
  assert.equal(
    formatValue("2.5", "otherServiceValue", null, { otherServiceType: "per_kg" }),
    formatPricePerTonne(2500),
  );
});

test("audit converts both structured and legacy text price snapshots", () => {
  assert.equal(
    formatValue(
      ['{"price":1.2345}', '{"price":2.5}'],
      "priceValues",
      null,
      { priceUnit: "kg" },
    ),
    `${formatPricePerTonne(1234.5)}, ${formatPricePerTonne(2500)}`,
  );
  assert.equal(
    formatValue("1.2345, 2.5", "priceValues", null, { priceUnit: "kg" }),
    `${formatPricePerTonne(1234.5)}, ${formatPricePerTonne(2500)}`,
  );
  assert.equal(
    formatValue("1.2345", "priceValues", null, { priceUnit: "liter" }),
    formatPricePerTonne(1.2345),
  );
  assert.equal(
    formatValue("1.2345", "priceValues", null, { priceUnit: "per_liter" }),
    formatPricePerTonne(1.2345),
  );
});

test("audit converts old service summaries while preserving explicit tonne summaries", () => {
  assert.equal(
    formatValue("Услуга: 0.001 (за кг)", "services"),
    `Услуга: ${formatPricePerTonne(1)} (за т)`,
  );
  assert.equal(
    formatValue(
      "Базис: сервис: 0.01, ПВКЖ: 0.02, агент: 0.03",
      "basisPrices",
    ),
    `Базис: сервис: ${formatPricePerTonne(10)} ₽/т, ПВКЖ: ${formatPricePerTonne(20)} ₽/т, агент: ${formatPricePerTonne(30)} ₽/т`,
  );
  assert.equal(formatValue("kg", "priceUnit"), "За тонну");
});
