import assert from "node:assert/strict";
import test from "node:test";
import {
  equipmentBalanceToApi,
  equipmentToApi,
  equipmentTransactionToApi,
} from "./equipment-api-adapters";

test("equipment API adds tonne balances and preserves legacy kilogram fields", () => {
  const result = equipmentToApi({
    id: "equipment-1",
    currentBalance: "1234.56",
    pvkjBalance: "0.01",
    averageCost: "12.0000",
    pvkjAverageCost: "0.0150",
  });

  assert.equal(result.currentBalance, "1234.56");
  assert.equal(result.pvkjBalance, "0.01");
  assert.equal(result.currentBalanceTonnes, "1.23456");
  assert.equal(result.pvkjBalanceTonnes, "0.00001");
  assert.equal(result.averageCostPerTonne, "12000.000");
  assert.equal(result.pvkjAverageCostPerTonne, "15.000");
});

test("equipment API treats missing balances as zero tonnes", () => {
  const result = equipmentToApi({ currentBalance: null, pvkjBalance: undefined });

  assert.equal(result.currentBalanceTonnes, "0.00000");
  assert.equal(result.pvkjBalanceTonnes, "0.00000");
});

test("equipment API prefers persisted tonne balances over legacy kg mirrors", () => {
  const result = equipmentToApi({
    currentBalance: "2000.00",
    currentBalanceTonnes: "1.23456",
    pvkjBalance: "10.00",
    pvkjBalanceTonnes: "0.00001",
  });

  assert.equal(result.currentBalanceTonnes, "1.23456");
  assert.equal(result.pvkjBalanceTonnes, "0.00001");
});

test("equipment balance snapshot exposes tonnes and a per-tonne cost", () => {
  const result = equipmentBalanceToApi({
    balance: "1000.01",
    averageCost: "12.0000",
  });

  assert.equal(result.balanceTonnes, "1.00001");
  assert.equal(result.averageCostPerTonne, "12000.000");
  assert.equal(result.balance, "1000.01");
});

test("equipment balance snapshot prefers persisted tonnes", () => {
  const result = equipmentBalanceToApi({
    balance: "2000.00",
    balanceTonnes: "1.23456",
    averageCost: "12.0000",
  });

  assert.equal(result.balanceTonnes, "1.23456");
  assert.equal(result.balance, "2000.00");
});

test("equipment transaction API exposes tonne mass and per-tonne cost fields", () => {
  const result = equipmentTransactionToApi({
    quantity: "10.50",
    balanceBefore: null,
    balanceAfter: "20.00",
    averageCostBefore: "12.0000",
    averageCostAfter: "13.2500",
    price: "12.0000",
  });

  assert.equal(result.quantityTonnes, "0.01050");
  assert.equal(result.balanceBeforeTonnes, null);
  assert.equal(result.balanceAfterTonnes, "0.02000");
  assert.equal(result.averageCostBeforePerTonne, "12000.000");
  assert.equal(result.averageCostAfterPerTonne, "13250.000");
  assert.equal(result.pricePerTonne, "12000.000");
});

test("equipment transaction API prefers persisted tonne quantities and snapshots", () => {
  const result = equipmentTransactionToApi({
    quantity: "-1000.00",
    quantityTonnes: "-0.12345",
    balanceBefore: "1000.00",
    balanceBeforeTonnes: "0.90000",
    balanceAfter: "0.00",
    balanceAfterTonnes: "0.77655",
  });

  assert.equal(result.quantityTonnes, "-0.12345");
  assert.equal(result.balanceBeforeTonnes, "0.90000");
  assert.equal(result.balanceAfterTonnes, "0.77655");
});
