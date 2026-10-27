import assert from "node:assert/strict";
import test from "node:test";
import {
  warehouseBalanceToApi,
  warehouseMonthlyStatsToApi,
  warehouseTransactionToApi,
} from "./warehouse-api-adapters";

test("warehouse balance API adds tonne fields without changing legacy values", () => {
  const result = warehouseBalanceToApi({
    balance: "1234.56",
    averageCost: "12.345678",
  });

  assert.equal(result.balance, "1234.56");
  assert.equal(result.averageCost, "12.345678");
  assert.equal(result.balanceTonnes, "1.23456");
  assert.equal(result.averageCostPerTonne, "12345.678");
});

test("warehouse transaction API adds tonne mass and per-tonne rates", () => {
  const result = warehouseTransactionToApi({
    quantityKg: "-0.01",
    balanceBefore: "12.34",
    balanceAfter: "12.33",
    price: "9.876543",
    averageCostBefore: "8.123456",
    averageCostAfter: "8.234567",
  });

  assert.equal(result.quantityKg, "-0.01");
  assert.equal(result.quantityTonnes, "-0.00001");
  assert.equal(result.balanceBeforeTonnes, "0.01234");
  assert.equal(result.balanceAfterTonnes, "0.01233");
  assert.equal(result.pricePerTonne, "9876.543");
  assert.equal(result.averageCostBeforePerTonne, "8123.456");
  assert.equal(result.averageCostAfterPerTonne, "8234.567");
});

test("warehouse API adapters reject malformed numeric values", () => {
  assert.throws(
    () =>
      warehouseBalanceToApi({
        balance: "not-a-number",
        averageCost: "0",
      }),
    /Invalid legacy kilogram value/,
  );
});

test("warehouse monthly stats add tonne totals while preserving kilogram totals", () => {
  const result = warehouseMonthlyStatsToApi({
    income: 1234.56,
    expense: 45.67,
    pvkjIncome: 800,
    pvkjExpense: 25.5,
  });

  assert.equal(result.income, 1234.56);
  assert.equal(result.expense, 45.67);
  assert.equal(result.pvkjIncome, 800);
  assert.equal(result.pvkjExpense, 25.5);
  assert.equal(result.incomeTonnes, 1.23456);
  assert.equal(result.expenseTonnes, 0.04567);
  assert.equal(result.pvkjIncomeTonnes, 0.8);
  assert.equal(result.pvkjExpenseTonnes, 0.0255);
});
