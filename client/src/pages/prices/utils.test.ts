import assert from "node:assert/strict";
import test from "node:test";
import {
  formatContractVolumeLimit,
  formatContractVolumeUsed,
  getApiPriceDisplay,
  getPriceDisplay,
} from "./utils";

test("new price rates display two decimals without discarding stored precision", () => {
  const display = getApiPriceDisplay(
    { unit: "tonne", values: [1234.567, null] },
    "₽",
  );

  assert.match(display, /234,57 ₽/);
  assert.match(display, /—/);
});

test("price table fallback handles kg and tonne storage without double conversion", () => {
  assert.equal(getPriceDisplay(['{"price":"1.234567"}'], "₽", "kg"), "1 234,57 ₽");
  assert.equal(getPriceDisplay(['{"price":"1234.567"}'], "₽", "tonne"), "1 234,57 ₽");
});

test("contract mass limits and usage display five decimals in tonnes", () => {
  const volume = {
    limitUnit: "tonne" as const,
    limit: 0.00001,
    usedUnit: "tonne" as const,
    used: 0.00002,
  };

  assert.equal(formatContractVolumeLimit(volume), "0,00001 т");
  assert.equal(formatContractVolumeUsed(volume), "0,00002 т");
});

test("liter usage remains liters while the contract mass limit remains tonnes", () => {
  assert.equal(
    formatContractVolumeUsed({
      limitUnit: "tonne",
      limit: 1,
      usedUnit: "liter",
      used: 12.345,
    }),
    "12,35 л",
  );
});
