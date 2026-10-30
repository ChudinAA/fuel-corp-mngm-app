import assert from "node:assert/strict";
import test from "node:test";
import {
  getOperationNomenclatureError,
  getOperationNomenclatureUpdateError,
} from "./nomenclature-validation";

const items = new Map([
  ["kerosene-id", { productType: "kerosene" }],
  ["pvkj-id", { productType: "pvkj" }],
  ["service-id", { productType: "service" }],
]);

const lookup = async (id: string) => items.get(id) ?? null;

test("new operation records require nomenclature for every selectable product type", async () => {
  for (const productType of ["kerosene", "pvkj", "service"]) {
    for (const nomenclatureId of [null, "", "   "]) {
      assert.equal(
        await getOperationNomenclatureError(
          { productType, nomenclatureId },
          lookup,
        ),
        "Выберите номенклатуру",
      );
    }
  }
});

test("legacy updates may preserve an empty nomenclature without changing product type", async () => {
  assert.equal(
    await getOperationNomenclatureError(
      { productType: "kerosene", nomenclatureId: null },
      lookup,
      false,
    ),
    null,
  );
  assert.equal(
    await getOperationNomenclatureError({}, lookup, false),
    null,
  );
});

test("nomenclature must exist and match the selected product type", async () => {
  assert.equal(
    await getOperationNomenclatureError(
      { productType: "kerosene", nomenclatureId: "kerosene-id" },
      lookup,
    ),
    null,
  );
  assert.equal(
    await getOperationNomenclatureError(
      { productType: "kerosene", nomenclatureId: "pvkj-id" },
      lookup,
    ),
    "Номенклатура не соответствует выбранному типу продукта",
  );
  assert.equal(
    await getOperationNomenclatureError(
      { productType: "kerosene", nomenclatureId: "deleted-id" },
      lookup,
    ),
    "Выбранная номенклатура не найдена или удалена",
  );
});

test("records without a nomenclature selector remain valid", async () => {
  assert.equal(
    await getOperationNomenclatureError(
      { productType: "storage", nomenclatureId: null },
      lookup,
    ),
    null,
  );
});

test("a new operation cannot omit its product type", async () => {
  assert.equal(
    await getOperationNomenclatureError(
      { productType: null, nomenclatureId: null },
      lookup,
    ),
    "Тип продукта обязателен",
  );
});

test("legacy null nomenclature survives edits only while product type is unchanged", async () => {
  const current = { productType: "kerosene", nomenclatureId: null };

  assert.equal(
    await getOperationNomenclatureUpdateError(
      current,
      { notes: "edit legacy record" },
      lookup,
    ),
    null,
  );
  assert.equal(
    await getOperationNomenclatureUpdateError(
      current,
      { productType: "kerosene", nomenclatureId: null },
      lookup,
    ),
    null,
  );
  assert.equal(
    await getOperationNomenclatureUpdateError(
      current,
      { productType: "pvkj", nomenclatureId: null },
      lookup,
    ),
    "Выберите номенклатуру",
  );
  assert.equal(
    await getOperationNomenclatureUpdateError(
      current,
      { productType: "pvkj", nomenclatureId: "kerosene-id" },
      lookup,
    ),
    "Номенклатура не соответствует выбранному типу продукта",
  );
});

test("updates keep existing IDs when omitted and cannot clear them", async () => {
  const current = { productType: "kerosene", nomenclatureId: "kerosene-id" };

  assert.equal(
    await getOperationNomenclatureUpdateError(
      current,
      { notes: "edit with existing selection" },
      lookup,
    ),
    null,
  );
  assert.equal(
    await getOperationNomenclatureUpdateError(
      current,
      { nomenclatureId: null },
      lookup,
    ),
    "Выберите номенклатуру",
  );
});
