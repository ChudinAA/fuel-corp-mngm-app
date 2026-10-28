import assert from "node:assert/strict";
import test from "node:test";
import {
  kilogramsToPriceStoredVolume,
  normalizePriceValuesForStorage,
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

  assert.equal(result.priceUnit, "kg");
  assert.equal(result.priceRate.unit, "tonne");
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

test("contract mass units are independent from the price-rate unit", () => {
  const result = priceToApi({
    priceUnit: "liter",
    volumeUnit: "tonne",
    priceValues: ['{"price":"12.5"}'],
    volume: "0.12345",
    soldVolume: "0.02345",
  });

  assert.deepEqual(result.priceRate, {
    unit: "liter",
    values: [12.5],
  });
  assert.deepEqual(result.contractVolume, {
    limitUnit: "tonne",
    limit: 0.12345,
    usedUnit: "tonne",
    used: 0.02345,
  });
});

test("unknown stored contract-volume units fail explicitly", () => {
  assert.throws(
    () => priceToApi({ priceUnit: "kg", volumeUnit: "liter", priceValues: [] }),
    /Неизвестная единица массы лимита цены/,
  );
});

test("sold contract volume is persisted in its declared mass unit", () => {
  assert.equal(kilogramsToPriceStoredVolume(1234.56789, "kg"), 1234.56789);
  assert.equal(kilogramsToPriceStoredVolume(1234.56789, "tonne"), 1.23457);
  assert.throws(
    () => kilogramsToPriceStoredVolume(1000, "liter"),
    /Неизвестная единица массы лимита цены/,
  );
});

test("already tonne-denominated stored rates are not converted a second time", () => {
  const result = priceToApi({
    priceUnit: "tonne",
    priceValues: ['{"price":"1234.567"}'],
  });

  assert.deepEqual(result.priceRate, {
    unit: "tonne",
    values: [1234.567],
  });
});

test("raw numeric legacy rates are converted using the declared kg unit", () => {
  const result = priceToApi({
    priceUnit: "kg",
    priceValues: ["75"],
  });

  assert.deepEqual(result.priceRate, {
    unit: "tonne",
    values: [75000],
  });
});

test("raw numeric tonne rates are not converted again", () => {
  const result = priceToApi({
    priceUnit: "tonne",
    priceValues: ["75"],
  });

  assert.deepEqual(result.priceRate, {
    unit: "tonne",
    values: [75],
  });
});

test("unknown stored price units fail explicitly", () => {
  assert.throws(
    () => priceToApi({ priceUnit: "gallon", priceValues: [] }),
    /Неизвестная сохранённая единица цены/,
  );
});

test("new tonne-based price writes store rates and limits in tonnes", () => {
  const result = priceWriteFromApi({
    priceRate: { unit: "tonne", values: [1234.567] },
    contractVolume: { limitUnit: "tonne", limit: 1.23456 },
  });

  assert.equal(result.priceUnit, "tonne");
  assert.equal(result.volumeUnit, "tonne");
  assert.deepEqual(result.priceValues, ['{"price":1234.567}']);
  assert.equal(result.volume, "1.23456");
});

test("liter-based rates keep their rate unit and store mass limits in tonnes", () => {
  const result = priceWriteFromApi({
    priceRate: { unit: "liter", values: [12.345678] },
    contractVolume: { limitUnit: "tonne", limit: 1 },
  });

  assert.equal(result.priceUnit, "liter");
  assert.equal(result.volumeUnit, "tonne");
  assert.deepEqual(result.priceValues, ['{"price":12.345678}']);
  assert.equal(result.volume, "1.00000");
});

test("price value storage accepts API objects and already-normalized JSON", () => {
  assert.deepEqual(
    normalizePriceValuesForStorage([
      { price: "12.345" },
      '{"price":12.5}',
    ]),
    ['{"price":12.345}', '{"price":12.5}'],
  );
});

test("price value storage rejects malformed and raw numeric legacy entries", () => {
  assert.throws(
    () => normalizePriceValuesForStorage(["123.45"]),
    /Укажите корректную ставку цены/,
  );
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

test("price lookup accepts legacy and tonne-stored mass rates", () => {
  assert.deepEqual(priceUnitFilterToStorage("tonne"), ["kg", "tonne"]);
  assert.deepEqual(priceUnitFilterToStorage("kg"), ["kg", "tonne"]);
  assert.deepEqual(priceUnitFilterToStorage("liter"), ["liter"]);
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
