import {
  kilogramsToTonnes,
  pricePerKilogramToPerTonne,
} from "@shared/units";

type LegacyEquipmentBalances = {
  currentBalance?: string | number | null;
  pvkjBalance?: string | number | null;
  averageCost?: string | number | null;
  pvkjAverageCost?: string | number | null;
};

type LegacyEquipmentTransaction = {
  quantity: string | number;
  balanceBefore?: string | number | null;
  balanceAfter?: string | number | null;
  averageCostBefore?: string | number | null;
  averageCostAfter?: string | number | null;
  price?: string | number | null;
};

type LegacyEquipmentBalanceSnapshot = {
  balance?: string | number | null;
  averageCost?: string | number | null;
};

function storedKilogramsToTonnes(
  value: string | number | null | undefined,
): string | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return null;
  }
  return kilogramsToTonnes(Number(value)).toFixed(5);
}

function storedPricePerKilogramToPerTonne(
  value: string | number | null | undefined,
): string | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return null;
  }
  return pricePerKilogramToPerTonne(Number(value)).toFixed(3);
}

export function equipmentToApi<T extends LegacyEquipmentBalances>(equipment: T) {
  const currentBalanceKg = Number(equipment.currentBalance ?? "0");
  const pvkjBalanceKg = Number(equipment.pvkjBalance ?? "0");

  return {
    ...equipment,
    currentBalanceTonnes: kilogramsToTonnes(currentBalanceKg).toFixed(5),
    pvkjBalanceTonnes: kilogramsToTonnes(pvkjBalanceKg).toFixed(5),
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
    balanceTonnes: storedKilogramsToTonnes(balance.balance ?? "0")!,
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
    quantityTonnes: storedKilogramsToTonnes(transaction.quantity)!,
    balanceBeforeTonnes: storedKilogramsToTonnes(
      transaction.balanceBefore,
    ),
    balanceAfterTonnes: storedKilogramsToTonnes(transaction.balanceAfter),
    averageCostBeforePerTonne: storedPricePerKilogramToPerTonne(
      transaction.averageCostBefore,
    ),
    averageCostAfterPerTonne: storedPricePerKilogramToPerTonne(
      transaction.averageCostAfter,
    ),
    pricePerTonne: storedPricePerKilogramToPerTonne(transaction.price),
  };
}
