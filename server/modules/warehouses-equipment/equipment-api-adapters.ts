import {
  pricePerKilogramToPerTonne,
} from "@shared/units";
import { readMassTonnes } from "./equipment-balance-units";

type LegacyEquipmentBalances = {
  currentBalance?: string | number | null;
  currentBalanceTonnes?: string | number | null;
  pvkjBalance?: string | number | null;
  pvkjBalanceTonnes?: string | number | null;
  averageCost?: string | number | null;
  pvkjAverageCost?: string | number | null;
};

type LegacyEquipmentTransaction = {
  quantity: string | number;
  quantityTonnes?: string | number | null;
  balanceBefore?: string | number | null;
  balanceBeforeTonnes?: string | number | null;
  balanceAfter?: string | number | null;
  balanceAfterTonnes?: string | number | null;
  averageCostBefore?: string | number | null;
  averageCostAfter?: string | number | null;
  price?: string | number | null;
};

type LegacyEquipmentBalanceSnapshot = {
  balance?: string | number | null;
  balanceTonnes?: string | number | null;
  averageCost?: string | number | null;
};

function storedPricePerKilogramToPerTonne(
  value: string | number | null | undefined,
): string | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return null;
  }
  return pricePerKilogramToPerTonne(Number(value)).toFixed(3);
}

export function equipmentToApi<T extends LegacyEquipmentBalances>(equipment: T) {
  return {
    ...equipment,
    currentBalanceTonnes: readMassTonnes(
      equipment.currentBalanceTonnes,
      equipment.currentBalance,
    ).toFixed(5),
    pvkjBalanceTonnes: readMassTonnes(
      equipment.pvkjBalanceTonnes,
      equipment.pvkjBalance,
    ).toFixed(5),
    averageCostPerTonne: storedPricePerKilogramToPerTonne(
      equipment.averageCost,
    ),
    pvkjAverageCostPerTonne: storedPricePerKilogramToPerTonne(
      equipment.pvkjAverageCost,
    ),
  };
}

export function equipmentBalanceToApi<
  T extends LegacyEquipmentBalanceSnapshot,
>(balance: T) {
  return {
    ...balance,
    balanceTonnes: readMassTonnes(
      balance.balanceTonnes,
      balance.balance,
    ).toFixed(5),
    averageCostPerTonne: storedPricePerKilogramToPerTonne(
      balance.averageCost,
    ),
  };
}

export function equipmentTransactionToApi<
  T extends LegacyEquipmentTransaction,
>(transaction: T) {
  return {
    ...transaction,
    quantityTonnes: readMassTonnes(
      transaction.quantityTonnes,
      transaction.quantity,
    ).toFixed(5),
    balanceBeforeTonnes:
      transaction.balanceBeforeTonnes == null &&
      transaction.balanceBefore == null
        ? null
        : readMassTonnes(
            transaction.balanceBeforeTonnes,
            transaction.balanceBefore,
          ).toFixed(5),
    balanceAfterTonnes:
      transaction.balanceAfterTonnes == null &&
      transaction.balanceAfter == null
        ? null
        : readMassTonnes(
            transaction.balanceAfterTonnes,
            transaction.balanceAfter,
          ).toFixed(5),
    averageCostBeforePerTonne: storedPricePerKilogramToPerTonne(
      transaction.averageCostBefore,
    ),
    averageCostAfterPerTonne: storedPricePerKilogramToPerTonne(
      transaction.averageCostAfter,
    ),
    pricePerTonne: storedPricePerKilogramToPerTonne(transaction.price),
  };
}
