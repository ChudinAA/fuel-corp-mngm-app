import assert from "node:assert/strict";
import test from "node:test";
import { SOURCE_TYPE } from "@shared/constants";
import { opt } from "@shared/schema";
import { WarehouseRecalculationService } from "./warehouse-recalculation-service";

test("warehouse recalculation updates OPT prices using tonne-authoritative fields", async () => {
  let savedValues: Record<string, unknown> | undefined;
  const tx = {
    query: {
      opt: {
        findFirst: async () => ({
          id: "opt-deal",
          quantityTonnes: "1.00000",
          salePricePerTonne: "20000",
          saleAmount: "20000",
          purchasePricePerTonne: "10000",
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
    5_000,
  );

  assert.equal(savedValues?.purchasePrice, undefined);
  assert.equal(savedValues?.purchasePricePerTonne, "5000.000000");
  assert.equal(savedValues?.purchaseAmount, "5000.00");
});
