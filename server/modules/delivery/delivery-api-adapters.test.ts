import assert from "node:assert/strict";
import test from "node:test";
import {
  deliveryCostToApi,
  deliveryCostsToApi,
  toLegacyDeliveryCostInput,
} from "./delivery-api-adapters";

test("delivery tariff API stores tonnes and a per-kilogram compatibility mirror", () => {
  const legacy = toLegacyDeliveryCostInput({
    costPerTonne: "12345.67",
    distance: "100",
  });

  assert.equal(legacy.costPerTonne, "12345.67");
  assert.equal(legacy.costPerKg, "12.345670");
  assert.equal(legacy.distance, "100");
});

test("delivery tariff API prefers the tonne field and hides the legacy rate", () => {
  const cost = deliveryCostToApi({
    id: "tariff",
    costPerKg: "0.123456",
    costPerTonne: "123.457000",
  });

  assert.equal(cost.costPerTonne, 123.457);
  assert.equal("costPerKg" in cost, false);
});

test("legacy-only tariff input derives the tonne rate", () => {
  const normalized = toLegacyDeliveryCostInput({ costPerKg: "0.123456" });

  assert.equal(normalized.costPerKg, "0.123456");
  assert.equal(normalized.costPerTonne, "123.456");
});

test("legacy numeric tariff input is normalized for the database schema", () => {
  const normalized = toLegacyDeliveryCostInput({ costPerKg: 0.2 });

  assert.equal(normalized.costPerKg, "0.2");
  assert.equal(normalized.costPerTonne, "200");
});

test("editing another tariff field preserves stored tonne and kilogram precision", () => {
  const legacy = toLegacyDeliveryCostInput(
    { costPerTonne: "123.46", transitDays: 3 },
    { costPerKg: "0.123456", costPerTonne: "123.456000" },
  );

  assert.equal(legacy.costPerTonne, "123.456000");
  assert.equal(legacy.costPerKg, "0.123456");
  assert.equal(legacy.transitDays, 3);
});

test("a changed legacy rate wins only when the submitted tonne rate is unchanged", () => {
  const normalized = toLegacyDeliveryCostInput(
    { costPerTonne: "123.46", costPerKg: "0.200000" },
    { costPerTonne: "123.456000", costPerKg: "0.123456" },
  );

  assert.equal(normalized.costPerTonne, "200");
  assert.equal(normalized.costPerKg, "0.200000");
});

test("a changed tonne rate wins over a stale legacy value", () => {
  const normalized = toLegacyDeliveryCostInput(
    { costPerTonne: "250.00", costPerKg: "0.123456" },
    { costPerTonne: "123.456000", costPerKg: "0.123456" },
  );

  assert.equal(normalized.costPerTonne, "250");
  assert.equal(normalized.costPerKg, "0.250000");
});

test("delivery tariff list adaptation preserves rows and metadata", () => {
  const costs = deliveryCostsToApi([
    { id: "a", costPerKg: "2" },
    { id: "b", costPerKg: "3" },
  ]) as Array<Record<string, unknown>>;

  assert.deepEqual(
    costs.map((cost) => cost.costPerTonne),
    [2_000, 3_000],
  );
  assert.ok(costs.every((cost) => !("costPerKg" in cost)));
});
