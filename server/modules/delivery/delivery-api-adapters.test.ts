import assert from "node:assert/strict";
import test from "node:test";
import {
  deliveryCostToApi,
  deliveryCostsToApi,
  toLegacyDeliveryCostInput,
} from "./delivery-api-adapters";

test("delivery tariff API adapts per-tonne rates to legacy storage", () => {
  const legacy = toLegacyDeliveryCostInput({
    costPerTonne: "12345.67",
    distance: "100",
  });

  assert.equal(legacy.costPerKg, "12.345670");
  assert.equal(legacy.distance, "100");
  assert.equal("costPerTonne" in legacy, false);
});

test("delivery tariff API returns per-tonne rates without legacy rate field", () => {
  const cost = deliveryCostToApi({
    id: "tariff",
    costPerKg: "0.123456",
  });

  assert.equal(cost.costPerTonne, 123.456);
  assert.equal("costPerKg" in cost, false);
});

test("editing another tariff field preserves legacy rate precision", () => {
  const legacy = toLegacyDeliveryCostInput(
    { costPerTonne: "123.46", transitDays: 3 },
    { costPerKg: "0.123456" },
  );

  assert.equal(legacy.costPerKg, "0.123456");
  assert.equal(legacy.transitDays, 3);
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
