import {
  litresAndDensityToTonnes,
  kilogramsToTonnes,
  pricePerKilogramToPerTonne,
  pricePerTonneToPerKilogram,
  tonnesToKilograms,
} from "@shared/units";
import { resolveWarehouseBalanceTonnes } from "@/pages/shared/utils/warehouse-balance-units";

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

export function equipmentMovementTonnesToLegacyKg(tonnes: number): number {
  return tonnesToKilograms(tonnes);
}

export function equipmentMovementTonnesRateToLegacyKgRate(
  ratePerTonne: number,
): number {
  return pricePerTonneToPerKilogram(ratePerTonne);
}

export function equipmentMovementLegacyKgToTonnes(
  quantityKg: string | number | null | undefined,
): number | null {
  const kilograms = parseFinite(quantityKg);
  return kilograms === null ? null : kilogramsToTonnes(kilograms);
}

export function equipmentMovementLegacyPricePerKgToPerTonne(
  pricePerKg: string | number | null | undefined,
): number | null {
  const price = parseFinite(pricePerKg);
  return price === null ? null : pricePerKilogramToPerTonne(price);
}

export function calculateLikAvailableBalanceTonnes(
  balanceSnapshot: unknown,
  fallbackBalanceTonnes: string | number | null | undefined,
  fallbackBalanceKilograms: string | number | null | undefined,
  isEditing: boolean,
  initialQuantityTonnes: number,
): number {
  const currentBalanceTonnes = resolveWarehouseBalanceTonnes(
    balanceSnapshot,
    fallbackBalanceTonnes,
    fallbackBalanceKilograms,
  );
  return currentBalanceTonnes +
    (isEditing && Number.isFinite(initialQuantityTonnes)
      ? initialQuantityTonnes
      : 0);
}
