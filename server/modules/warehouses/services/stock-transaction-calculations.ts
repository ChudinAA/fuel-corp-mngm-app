import { TRANSACTION_TYPE } from "@shared/constants";

export interface StockBalance {
  balance: number;
  averageCost: number;
}

export interface StockMovementResult extends StockBalance {
  sum: number;
  price: number;
}

export function restoreStockMovement(
  current: StockBalance,
  transaction: {
    quantity: string | number;
    sum?: string | number | null;
    averageCostBefore?: string | number | null;
    averageCostAfter?: string | number | null;
  },
  recalculateAverageCost = true,
): StockBalance {
  const quantity = Number.parseFloat(String(transaction.quantity));
  const totalCost = Number.parseFloat(String(transaction.sum || "0"));
  const balance = Math.max(0, current.balance + quantity);
  let averageCost = current.averageCost;

  if (
    recalculateAverageCost &&
    transaction.averageCostBefore !== transaction.averageCostAfter
  ) {
    const restoredTotalCost = Math.max(
      0,
      current.balance * current.averageCost + totalCost,
    );
    averageCost = balance > 0 ? restoredTotalCost / balance : 0;
  }

  return { balance, averageCost };
}

export function calculateStockMovement(
  current: StockBalance,
  transaction: {
    transactionType: string;
    quantity: string | number;
  },
  incomingCost: number,
): StockMovementResult {
  const quantity = Math.abs(Number.parseFloat(String(transaction.quantity)));
  const isReceipt =
    transaction.transactionType === TRANSACTION_TYPE.RECEIPT ||
    transaction.transactionType === TRANSACTION_TYPE.TRANSFER_IN;

  if (isReceipt) {
    const balance = current.balance + quantity;
    const averageCost =
      balance > 0
        ? (current.balance * current.averageCost + incomingCost) / balance
        : 0;
    return {
      balance,
      averageCost,
      sum: incomingCost,
      price: quantity > 0 ? incomingCost / quantity : 0,
    };
  }

  const balance = Math.max(0, current.balance - quantity);
  return {
    balance,
    averageCost: current.averageCost,
    sum: quantity * current.averageCost,
    price: current.averageCost,
  };
}
