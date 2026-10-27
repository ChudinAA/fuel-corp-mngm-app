import {
  formatPricePerTonne,
  litresAndDensityToTonnes,
  kilogramsToTonnes,
  pricePerKilogramToPerTonne,
  pricePerLitreToPerTonne,
  pricePerTonneToPerKilogram,
  tonnesToKilograms,
} from "@shared/units";

export type MovementInputMode = "liters" | "tonnes";
export type MovementPriceUnit = "kg" | "liter" | "tonne";

function parseFinite(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateMovementMassTonnes(
  inputMode: MovementInputMode,
  quantityTonnes: string | number | null | undefined,
  quantityLiters: string | number | null | undefined,
  density: string | number | null | undefined,
): number | null {
  if (inputMode === "tonnes") {
    const tonnes = parseFinite(quantityTonnes);
    return tonnes !== null && tonnes > 0 ? tonnes : null;
  }

  const liters = parseFinite(quantityLiters);
  const densityKgPerLiter = parseFinite(density);
  if (
    liters === null ||
    liters <= 0 ||
    densityKgPerLiter === null ||
    densityKgPerLiter <= 0
  ) {
    return null;
  }
  return litresAndDensityToTonnes(liters, densityKgPerLiter);
}

export function calculateMovementPricePerTonne(
  price: string | number | null | undefined,
  priceUnit: MovementPriceUnit,
  density: string | number | null | undefined,
): number | null {
  const value = parseFinite(price);
  if (value === null) return null;

  if (priceUnit === "kg") return pricePerKilogramToPerTonne(value);
  if (priceUnit === "tonne") return value;

  const densityKgPerLiter = parseFinite(density);
  if (densityKgPerLiter === null || densityKgPerLiter <= 0) return null;
  return pricePerLitreToPerTonne(value, densityKgPerLiter);
}

export function formatMovementPriceOption(
  price: string | number | null | undefined,
  priceUnit: MovementPriceUnit,
  density: string | number | null | undefined,
): string {
  const ratePerTonne = calculateMovementPricePerTonne(
    price,
    priceUnit,
    density,
  );
  const rateLabel =
    ratePerTonne === null ? "— ₽/т" : `${formatPricePerTonne(ratePerTonne)} ₽/т`;
  const sourcePrice = parseFinite(price);
  return priceUnit === "liter" && sourcePrice !== null
    ? `${rateLabel} · ${formatPricePerTonne(sourcePrice)} ₽/л`
    : rateLabel;
}

export function movementTonnesToLegacyKg(tonnes: number): number {
  return tonnesToKilograms(tonnes);
}

export function movementTonnesRateToLegacyKgRate(ratePerTonne: number): number {
  return pricePerTonneToPerKilogram(ratePerTonne);
}

export function movementStoredKgToTonnes(
  quantityKg: string | number | null | undefined,
): number | null {
  const kilograms = parseFinite(quantityKg);
  return kilograms === null ? null : kilogramsToTonnes(kilograms);
}
