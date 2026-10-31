import assert from "node:assert/strict";
import test from "node:test";
import { getTableColumns } from "drizzle-orm";
import { movement } from "./movement";

test("movement schema only selects tonne-based price and quantity fields", () => {
  const columns = Object.values(getTableColumns(movement)).map(
    (column) => column.name,
  );

  assert.ok(columns.includes("quantity_tonnes"));
  assert.ok(columns.includes("delivery_price_per_tonne"));
  assert.ok(columns.includes("purchase_price_per_tonne"));
  assert.ok(columns.includes("cost_per_tonne"));

  for (const legacyColumn of [
    "quantity_kg",
    "purchase_price",
    "delivery_price",
    "cost_per_kg",
  ]) {
    assert.ok(
      !columns.includes(legacyColumn),
      `movement schema must not select dropped column ${legacyColumn}`,
    );
  }
});
