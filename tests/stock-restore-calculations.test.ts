import assert from "node:assert/strict";
import { test } from "node:test";
import { PRODUCT_TYPE, TRANSACTION_TYPE } from "../shared/constants";
import {
  calculateStockMovement,
  restoreStockMovement,
  type StockBalance,
} from "../server/modules/warehouses/services/stock-transaction-calculations";

test("restoring an older fuel sale preserves the latest balance and average cost after later movements", () => {
  for (const productType of [PRODUCT_TYPE.KEROSENE, PRODUCT_TYPE.PVKJ]) {
    for (const storage of ["warehouse", "equipment"]) {
      const opening: StockBalance = { balance: 100, averageCost: 10 };
      const oldSale = {
        transactionType: TRANSACTION_TYPE.SALE,
        quantity: "-20",
        sum: "200",
        averageCostBefore: "10",
        averageCostAfter: "10",
      };
      const laterReceipt = {
        transactionType: TRANSACTION_TYPE.RECEIPT,
        quantity: "40",
      };
      const laterSale = {
        transactionType: TRANSACTION_TYPE.SALE,
        quantity: "-10",
      };

      // Delete the old order, then apply the receipt and sale made afterwards.
      let current: StockBalance = { balance: 100 - 20, averageCost: 10 };
      current.balance = Math.max(
        0,
        current.balance - Number.parseFloat(oldSale.quantity),
      );
      current = calculateStockMovement(current, laterReceipt, 600);
      current = calculateStockMovement(current, laterSale, 0);
      assert.equal(current.balance, 130);
      assert.ok(Math.abs(current.averageCost - 11.4285714286) < 0.0000001);

      // The immediate restore uses current stock state; the queued replay then
      // recalculates all later movements from the restored historical sale.
      current = restoreStockMovement(current, oldSale);
      assert.equal(current.balance, 110);
      assert.ok(Math.abs(current.averageCost - 11.4285714286) < 0.0000001);

      let replayed = opening;
      replayed = calculateStockMovement(replayed, oldSale, 0);
      replayed = calculateStockMovement(replayed, laterReceipt, 600);
      replayed = calculateStockMovement(replayed, laterSale, 0);
      assert.equal(
        replayed.balance,
        110,
        `${storage} ${productType} balance after replay`,
      );
      assert.ok(
        Math.abs(replayed.averageCost - 11.6666666667) < 0.0000001,
        `${storage} ${productType} average cost after replay: ${replayed.averageCost}`,
      );
    }
  }
});
