import assert from "node:assert/strict";
import test from "node:test";
import { SOURCE_TYPE } from "@shared/constants";
import { opt } from "@shared/schema";
import { WarehouseRecalculationService } from "./warehouse-recalculation-service";

test("warehouse recalculation synchronizes the OPT per-tonne purchase price", async () => {
  let savedValues: Record<string, unknown> | undefined;
  const tx = {
    query: {
      opt: {
        findFirst: async () => ({
          id: "opt-deal",
          quantityKg: "1000",
          salePrice: "20",
          purchasePrice: "10",
          purchaseAmount: "10000",
          profit: "10000",
        }),
      },
    },
    update: (table: unknown) => {
      assert.equal(table, opt);
      return {
        set: (values: Record<string, unknown>) => {
          savedValues = values;
          return { where: async () => undefined };
        },
      };
    },
  };

  await WarehouseRecalculationService.updateRelatedDeal(
    tx as never,
    SOURCE_TYPE.OPT,
    "opt-deal",
    5,
  );

  assert.equal(savedValues?.purchasePrice, "5.000000");
  assert.equal(savedValues?.purchasePricePerTonne, "5000.000000");
  assert.equal(savedValues?.purchaseAmount, "5000.00");
});
