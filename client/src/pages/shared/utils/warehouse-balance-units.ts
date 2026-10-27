import {
  kilogramsToTonnes,
  pricePerKilogramToPerTonne,
} from "@shared/units";

type NumericValue = string | number | null | undefined;

interface WarehouseBalanceValues {
  balanceTonnes?: NumericValue;
  balance?: NumericValue;
  averageCostPerTonne?: NumericValue;
  averageCost?: NumericValue;
}

function finiteNumber(value: NumericValue): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function objectValues(value: unknown): WarehouseBalanceValues | null {
  return value !== null && typeof value === "object"
    ? (value as WarehouseBalanceValues)
    : null;
}

export function resolveWarehouseBalanceTonnes(
  snapshot: unknown,
  fallbackTonnes?: NumericValue,
  fallbackKilograms?: NumericValue,
): number {
  const values = objectValues(snapshot);
  const snapshotTonnes = finiteNumber(values?.balanceTonnes);
  if (snapshotTonnes !== null) return snapshotTonnes;

  const snapshotKilograms = finiteNumber(values?.balance);
  if (snapshotKilograms !== null) {
    return kilogramsToTonnes(snapshotKilograms);
  }

  const explicitFallbackTonnes = finiteNumber(fallbackTonnes);
  if (explicitFallbackTonnes !== null) return explicitFallbackTonnes;

  const legacyFallbackKilograms = finiteNumber(fallbackKilograms);
  return legacyFallbackKilograms === null
    ? 0
    : kilogramsToTonnes(legacyFallbackKilograms);
}

export function resolveWarehouseAverageCostPerTonne(
  snapshot: unknown,
  fallbackPerTonne?: NumericValue,
  fallbackPerKilogram?: NumericValue,
): number {
  const values = objectValues(snapshot);
  const snapshotPerTonne = finiteNumber(values?.averageCostPerTonne);
  if (snapshotPerTonne !== null) return snapshotPerTonne;

  const snapshotPerKilogram = finiteNumber(values?.averageCost);
  if (snapshotPerKilogram !== null) {
    return pricePerKilogramToPerTonne(snapshotPerKilogram);
  }

  const explicitFallbackPerTonne = finiteNumber(fallbackPerTonne);
  if (explicitFallbackPerTonne !== null) return explicitFallbackPerTonne;

  const legacyFallbackPerKilogram = finiteNumber(fallbackPerKilogram);
  return legacyFallbackPerKilogram === null
    ? 0
    : pricePerKilogramToPerTonne(legacyFallbackPerKilogram);
}
