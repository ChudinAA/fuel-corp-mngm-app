import test from "node:test";
import assert from "node:assert/strict";
import { getNomenclatureSelection as choose } from "./nomenclature-selection";

const items = [
  { id: "fuel", productType: "kerosene", isDefault: true },
  { id: "fuel-other", productType: "kerosene", isDefault: false },
  { id: "service", productType: "service", isDefault: true },
];

test("loading never clears a selected item", () => {
  assert.equal(choose([], "kerosene", "fuel", false), undefined);
});
test("empty list does not repeatedly write an empty value and trigger validation", () => {
  for (const value of ["", undefined, null]) {
    assert.equal(choose([], "kerosene", value, true), undefined);
  }
});
test("new forms select the matching product default once", () => {
  assert.equal(choose(items, "kerosene", "", true), "fuel");
  assert.equal(choose(items, "kerosene", "fuel", true), undefined);
});
test("a valid manual choice is preserved", () => {
  assert.equal(choose(items, "kerosene", "fuel-other", true), undefined);
});
test("changing product selects the new product default", () => {
  assert.equal(choose(items, "service", "fuel", true), "service");
});
test("changing product without a default clears an invalid selection once", () => {
  assert.equal(choose(items, "pvkj", "fuel", true), "");
  assert.equal(choose(items, "pvkj", "", true), undefined);
});
test("historical empty selection is not inferred from the current default", () => {
  assert.equal(choose(items, "kerosene", "", true, true), undefined);
});
test("integration kind codes are never used as product types", () => {
  assert.equal(choose([{ id: "unmapped", isDefault: true }], "kerosene", "", true), undefined);
});
