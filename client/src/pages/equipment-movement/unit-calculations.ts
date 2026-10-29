import {
  litresAndDensityToTonnes,
} from "@shared/units";

export type EquipmentMovementInputMode = "liters" | "tonnes";

function parseFinite(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateEquipmentMovementTonnes(
  mode: EquipmentMovementInputMode,
  tonnesValue: string | number | null | undefined,
  litersValue: string | number | null | undefined,
  densityValue: string | number | null | undefined,
): number | null {
  if (mode === "tonnes") {
    const tonnes = parseFinite(tonnesValue);
    return tonnes !== null && tonnes > 0 ? tonnes : null;
  }

  const liters = parseFinite(litersValue);
  const density = parseFinite(densityValue);
  if (liters === null || liters <= 0 || density === null || density <= 0) {
    return null;
  }
  return litresAndDensityToTonnes(liters, density);
}

export function calculateLikAvailableBalanceTonnes(
  balanceSnapshot: unknown,
  fallbackBalanceTonnes: string | number | null | undefined,
  isEditing: boolean,
  initialQuantityTonnes: number,
): number {
  const snapshotBalance =
    balanceSnapshot &&
    typeof balanceSnapshot === "object" &&
    "balanceTonnes" in balanceSnapshot
      ? parseFinite((balanceSnapshot as { balanceTonnes?: unknown }).balanceTonnes as string | number)
      : null;
  const currentBalanceTonnes =
    snapshotBalance ?? parseFinite(fallbackBalanceTonnes);
  if (currentBalanceTonnes === null) {
    throw new Error("Equipment movement source is missing balanceTonnes");
  }
  return currentBalanceTonnes +
    (isEditing && Number.isFinite(initialQuantityTonnes)
      ? initialQuantityTonnes
      : 0);
}
