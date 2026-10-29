import { readBalanceTonnes } from "@/pages/shared/utils/tonne-balance-values";

function finiteNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateOptWarehouseBalanceTonnes(
  historicalSnapshot: unknown,
  currentSnapshot: unknown,
  editQuantityTonnes: string | number | null | undefined,
): number {
  const historicalBalance = readBalanceTonnes(historicalSnapshot);
  const currentBalance = readBalanceTonnes(currentSnapshot);
  if (historicalBalance === null || currentBalance === null) {
    throw new Error("Warehouse response is missing balanceTonnes");
  }
  const editQuantity = finiteNumber(editQuantityTonnes) ?? 0;

  return Math.min(historicalBalance, currentBalance) + editQuantity;
}
