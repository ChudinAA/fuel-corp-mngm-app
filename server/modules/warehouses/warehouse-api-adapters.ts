import {
  kilogramsToTonnes,
  pricePerKilogramToPerTonne,
} from "@shared/units";

type NumericValue = string | number | null | undefined;

export interface WarehouseBalanceSnapshot {
  balance: NumericValue;
  balanceTonnes?: NumericValue;
  averageCost: NumericValue;
  [key: string]: unknown;
}

export interface WarehouseRecordSnapshot {
  currentBalance: NumericValue;
  currentBalanceTonnes?: NumericValue;
  pvkjBalance: NumericValue;
  pvkjBalanceTonnes?: NumericValue;
  averageCost: NumericValue;
  pvkjAverageCost: NumericValue;
  [key: string]: unknown;
}

export interface WarehouseTransactionSnapshot {
  quantityKg: NumericValue;
  quantityTonnes?: NumericValue;
  balanceBefore: NumericValue;
  balanceBeforeTonnes?: NumericValue;
  balanceAfter: NumericValue;
  balanceAfterTonnes?: NumericValue;
  price: NumericValue;
  averageCostBefore: NumericValue;
  averageCostAfter: NumericValue;
  [key: string]: unknown;
}

export interface WarehouseMonthlyStatsSnapshot {
  income: number;
  expense: number;
  pvkjIncome: number;
  pvkjExpense: number;
  incomeTonnes?: number;
  expenseTonnes?: number;
  pvkjIncomeTonnes?: number;
  pvkjExpenseTonnes?: number;
  [key: string]: unknown;
}

function kilogramsAsTonnes(value: NumericValue): NumericValue {
  if (value === null || value === undefined || value === "") return value;
  const kilograms = Number(value);
  if (!Number.isFinite(kilograms)) {
    throw new TypeError(`Invalid legacy kilogram value: ${String(value)}`);
  }
  return kilogramsToTonnes(kilograms).toFixed(5);
}

function perKilogramAsPerTonne(value: NumericValue): NumericValue {
  if (value === null || value === undefined || value === "") return value;
  const perKilogram = Number(value);
  if (!Number.isFinite(perKilogram)) {
    throw new TypeError(`Invalid legacy per-kilogram price: ${String(value)}`);
  }
  return pricePerKilogramToPerTonne(perKilogram).toFixed(3);
}

export function warehouseToApi<T extends WarehouseRecordSnapshot>(
  warehouse: T,
) {
  return {
    ...warehouse,
    currentBalanceTonnes:
      warehouse.currentBalanceTonnes ??
      kilogramsAsTonnes(warehouse.currentBalance),
    pvkjBalanceTonnes:
      warehouse.pvkjBalanceTonnes ?? kilogramsAsTonnes(warehouse.pvkjBalance),
    averageCostPerTonne: perKilogramAsPerTonne(warehouse.averageCost),
    pvkjAverageCostPerTonne: perKilogramAsPerTonne(
      warehouse.pvkjAverageCost,
    ),
  };
}

export function warehouseBalanceToApi<T extends WarehouseBalanceSnapshot>(
  balance: T,
) {
  return {
    ...balance,
    balanceTonnes:
      balance.balanceTonnes ?? kilogramsAsTonnes(balance.balance),
    averageCostPerTonne: perKilogramAsPerTonne(balance.averageCost),
  };
}

export function warehouseTransactionToApi<
  T extends WarehouseTransactionSnapshot,
>(transaction: T) {
  return {
    ...transaction,
    quantityTonnes:
      transaction.quantityTonnes ??
      kilogramsAsTonnes(transaction.quantityKg),
    balanceBeforeTonnes:
      transaction.balanceBeforeTonnes ??
      kilogramsAsTonnes(transaction.balanceBefore),
    balanceAfterTonnes:
      transaction.balanceAfterTonnes ??
      kilogramsAsTonnes(transaction.balanceAfter),
    pricePerTonne: perKilogramAsPerTonne(transaction.price),
    averageCostBeforePerTonne: perKilogramAsPerTonne(
      transaction.averageCostBefore,
    ),
    averageCostAfterPerTonne: perKilogramAsPerTonne(
      transaction.averageCostAfter,
    ),
  };
}

export function warehouseMonthlyStatsToApi<
  T extends WarehouseMonthlyStatsSnapshot,
>(stats: T) {
  return {
    ...stats,
    incomeTonnes:
      stats.incomeTonnes ??
      Number(kilogramsToTonnes(stats.income).toFixed(5)),
    expenseTonnes:
      stats.expenseTonnes ??
      Number(kilogramsToTonnes(stats.expense).toFixed(5)),
    pvkjIncomeTonnes:
      stats.pvkjIncomeTonnes ??
      Number(kilogramsToTonnes(stats.pvkjIncome).toFixed(5)),
    pvkjExpenseTonnes:
      stats.pvkjExpenseTonnes ??
      Number(kilogramsToTonnes(stats.pvkjExpense).toFixed(5)),
  };
}
