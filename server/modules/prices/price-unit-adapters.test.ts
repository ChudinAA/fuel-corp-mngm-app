import assert from "node:assert/strict";
import test from "node:test";
import {
  priceResponseToApi,
  priceSelectionVolumeToApi,
  priceToApi,
  priceUnitFilterToStorage,
  priceWriteFromApi,
} from "./price-unit-adapters";

test("price API exposes tonne rates and contract volumes from legacy kilogram values", () => {
  const result = priceToApi({
    priceUnit: "kg",
    priceValues: ['{"price":"1.234567"}'],
    volume: "12345.67",
    soldVolume: "2345.67",
  });

  assert.deepEqual(result.priceRate, {
    unit: "tonne",
    values: [1234.567],
  });
  assert.deepEqual(result.contractVolume, {
    limitUnit: "tonne",
    limit: 12.34567,
    usedUnit: "tonne",
    used: 2.34567,
  });
});

test("liter-denominated rates remain per liter while used mass is exposed in tonnes", () => {
  const result = priceToApi({
    priceUnit: "liter",
    priceValues: ['{"price":"12.345678"}'],
    volume: "4000",
    soldVolume: "125.5",
  });

  assert.deepEqual(result.priceRate, {
    unit: "liter",
    values: [12.345678],
  });
  assert.deepEqual(result.contractVolume, {
    limitUnit: "tonne",
    limit: 4,
    usedUnit: "tonne",
    used: 0.1255,
  });
});

test("new tonne-based price writes normalize to legacy database columns", () => {
  const result = priceWriteFromApi({
    priceRate: { unit: "tonne", values: [1234.567] },
    contractVolume: { limitUnit: "tonne", limit: 1.23456 },
  });

  assert.equal(result.priceUnit, "kg");
  assert.deepEqual(result.priceValues, ['{"price":1.234567}']);
  assert.equal(result.volume, "1234.56");
});

test("new liter-based price writes do not convert the source rate or volume", () => {
  const result = priceWriteFromApi({
    priceRate: { unit: "liter", values: [12.345678] },
    contractVolume: { limitUnit: "tonne", limit: 1 },
  });

  assert.equal(result.priceUnit, "liter");
  assert.deepEqual(result.priceValues, ['{"price":12.345678}']);
  assert.equal(result.volume, "1000");
});

test("price response adapters mark malformed historical rates instead of fabricating zero", () => {
  const result = priceResponseToApi({
    priceUnit: "kg",
    priceValues: ["not-json"],
  }) as { priceRate: { values: Array<number | null> } };

  assert.deepEqual(result.priceRate.values, [null]);
});

test("price response adapters transform rows inside paginated responses", () => {
  const result = priceResponseToApi({
    data: [{ priceUnit: "kg", priceValues: ['{"price":"2"}'] }],
    total: 1,
  }) as { data: Array<{ priceRate: { values: Array<number | null> } }> };

  assert.deepEqual(result.data[0].priceRate.values, [2000]);
});

test("price writes reject contract limits that are not expressed in tonnes", () => {
  assert.throws(
    () =>
      priceWriteFromApi({
        priceRate: { unit: "tonne", values: [100] },
        contractVolume: { limitUnit: "liter", limit: 1000 },
      }),
    /Invalid literal value/,
  );
});

test("volume-limited new price writes require explicit volume units", () => {
  assert.throws(
    () =>
      priceWriteFromApi({
        priceRate: { unit: "tonne", values: [100] },
        limitType: "volume",
      }),
    /договорный объём с указанием единицы/,
  );
});

test("price lookup accepts tonnes and maps them to the legacy mass-unit filter", () => {
  assert.equal(priceUnitFilterToStorage("tonne"), "kg");
  assert.equal(priceUnitFilterToStorage("kg"), "kg");
  assert.equal(priceUnitFilterToStorage("liter"), "liter");
  assert.equal(priceUnitFilterToStorage(undefined), undefined);
  assert.throws(() => priceUnitFilterToStorage("gallon"), /Неизвестная единица/);
});

test("price selection results use five-decimal tonnes and reject invalid mass", () => {
  assert.deepEqual(priceSelectionVolumeToApi(1234.56), {
    value: "1.23456",
    unit: "tonne",
  });
  assert.throws(
    () => priceSelectionVolumeToApi(Number.NaN),
    /Некорректный тоннаж/,
  );
});
