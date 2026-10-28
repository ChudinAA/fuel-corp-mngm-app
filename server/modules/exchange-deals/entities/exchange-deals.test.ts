import assert from "node:assert/strict";
import test from "node:test";
import { insertExchangeDealSchema } from "./exchange-deals";

test("exchange-deal masses accept and preserve five decimal places in tonnes", () => {
  const deal = insertExchangeDealSchema.parse({
    weightTon: "1.23456",
    actualWeightTon: "2.34567",
  });

  assert.equal(deal.weightTon, "1.23456");
  assert.equal(deal.actualWeightTon, "2.34567");
});
