import assert from "node:assert/strict";
import test from "node:test";
import {
  counterpartySyncBatchSchema,
  counterpartySyncItemSchema,
  getCounterpartyStatusKind,
} from "./counterparty-sync-contract";

const sample = {
  type: "supplier",
  id_1c: "b10a8b22-31f7-4c18-b6e3-552ae6d7f821",
  inn: "7701234567",
  name: "Краткое название",
  full_name: "Полное название",
  status: "active",
};

test("1C counterparty payload accepts only the documented master fields", () => {
  assert.equal(counterpartySyncItemSchema.safeParse(sample).success, true);
  assert.equal(counterpartySyncItemSchema.safeParse({ ...sample, warehouseId: "attacker-controlled" }).success, false);
  assert.equal(counterpartySyncItemSchema.safeParse({ ...sample, type: "deal" }).success, false);
  assert.equal(counterpartySyncItemSchema.safeParse({ ...sample, id_1c: "not-a-uuid" }).success, false);
});

test("1C batch is bounded and requires at least one record", () => {
  assert.equal(counterpartySyncBatchSchema.safeParse({ items: [sample] }).success, true);
  assert.equal(counterpartySyncBatchSchema.safeParse({ items: [] }).success, false);
  assert.equal(counterpartySyncBatchSchema.safeParse({ items: Array(501).fill(sample) }).success, false);
});

test("1C status values preserve missing status and recognize deletion", () => {
  assert.equal(getCounterpartyStatusKind(undefined), "unchanged");
  assert.equal(getCounterpartyStatusKind(null), "unchanged");
  assert.equal(getCounterpartyStatusKind(" Активен "), "active");
  assert.equal(getCounterpartyStatusKind("Пометка удаления"), "deleted");
  assert.equal(getCounterpartyStatusKind("unknown"), "unknown");
});
