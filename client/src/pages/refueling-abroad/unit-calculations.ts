import {
  litresAndDensityToTonnes,
  pricePerLitreToPerTonne,
} from "@shared/units";

export type RefuelingInputMode = "liters" | "tonnes";
export type RefuelingPriceUnit = "tonne" | "liter";

function parseUnitValue(value: number | string | null | undefined): number | null {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateRefuelingMassTonnes(
  inputMode: RefuelingInputMode,
  quantity: number | string | null | undefined,
  densityKilogramsPerLitre?: number | string | null,
): number | null {
  const amount = parseUnitValue(quantity);
  if (amount === null || amount < 0) return null;
  if (inputMode === "tonnes") return amount;
  if (amount === 0) return 0;

  const density = parseUnitValue(densityKilogramsPerLitre);
  if (density === null || density <= 0) return null;
  return litresAndDensityToTonnes(amount, density);
}

export function calculateRefuelingPricePerTonne(
  sourcePrice: number | string | null | undefined,
  inputMode: RefuelingInputMode,
  densityKilogramsPerLitre?: number | string | null,
  sourceUnit?: RefuelingPriceUnit,
): number | null {
  const price = parseUnitValue(sourcePrice);
  if (price === null || price < 0) return null;
  const unit = sourceUnit ?? (inputMode === "tonnes" ? "tonne" : "liter");
  if (unit === "tonne") return price;

  const density = parseUnitValue(densityKilogramsPerLitre);
  if (density === null || density <= 0) return null;
  return pricePerLitreToPerTonne(price, density);
}

export function calculateRefuelingAmount(
  pricePerTonne: number | null,
  quantityTonnes: number | null,
): number | null {
  if (
    pricePerTonne === null ||
    quantityTonnes === null ||
    !Number.isFinite(pricePerTonne) ||
    !Number.isFinite(quantityTonnes) ||
    pricePerTonne < 0 ||
    quantityTonnes <= 0
  ) {
    return null;
  }
  return pricePerTonne * quantityTonnes;
}
