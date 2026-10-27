import { resolveWarehouseBalanceTonnes } from "@/pages/shared/utils/warehouse-balance-units";

type NumericValue = string | number | null | undefined;

function finiteNumber(value: NumericValue): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateOptWarehouseBalanceTonnes(
  historicalSnapshot: unknown,
  currentSnapshot: unknown,
  initialBalanceTonnes: NumericValue,
  initialBalanceKilograms: NumericValue,
  editQuantityKilograms: NumericValue,
): number {
  const historicalBalance = resolveWarehouseBalanceTonnes(
    historicalSnapshot,
    initialBalanceTonnes,
    initialBalanceKilograms,
  );
  const currentBalance = resolveWarehouseBalanceTonnes(
    currentSnapshot,
    initialBalanceTonnes,
    initialBalanceKilograms,
  );
  const editQuantity = finiteNumber(editQuantityKilograms) ?? 0;

  return Math.min(historicalBalance, currentBalance) + editQuantity / 1000;
}
