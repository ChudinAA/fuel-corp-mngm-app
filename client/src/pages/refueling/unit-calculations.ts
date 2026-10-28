import {
  kilogramsToTonnes,
  formatPricePerTonne,
  pricePerKilogramToPerTonne,
  pricePerLitreToPerTonne,
  tonnesToKilograms,
} from "@shared/units";

export type RefuelingInputMode = "liters" | "tonnes";
export type RefuelingPriceUnit = "kg" | "liter" | "tonne";

export function formatRefuelingPriceOption(
  sourcePrice: number | string,
  inputMode: RefuelingInputMode,
  density: number | string | null | undefined,
  currency = "₽",
  sourceUnit?: RefuelingPriceUnit,
): string {
  const price = parseFinite(sourcePrice);
  const unit = sourceUnit ?? (inputMode === "liters" ? "liter" : "kg");
  const pricePerTonne = calculateRefuelingPricePerTonne(
    sourcePrice,
    inputMode,
    density,
    unit,
  );
  if (price === null || pricePerTonne === null) {
    return "Цена за тонну недоступна";
  }
  const perTonne = `${formatPricePerTonne(pricePerTonne)} ${currency}/т`;
  if (unit === "liter") {
    const sourcePriceFormatted = new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
    return `${perTonne} (${sourcePriceFormatted} ${currency}/л)`;
  }
  return perTonne;
}

function parseFinite(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateRefuelingMassTonnes(
  inputMode: RefuelingInputMode,
  quantity: number | string | null | undefined,
  density?: number | string | null,
): number | null {
  const parsedQuantity = parseFinite(quantity);
  if (parsedQuantity === null || parsedQuantity < 0) return null;
  if (inputMode === "tonnes") return parsedQuantity;
  if (parsedQuantity === 0) return 0;

  const parsedDensity = parseFinite(density);
  if (parsedDensity === null || parsedDensity <= 0) return null;
  return kilogramsToTonnes(parsedQuantity * parsedDensity);
}

export function calculateRefuelingPricePerTonne(
  sourcePrice: number | string | null | undefined,
  inputMode: RefuelingInputMode,
  density?: number | string | null,
  sourceUnit?: RefuelingPriceUnit,
): number | null {
  const price = parseFinite(sourcePrice);
  if (price === null || price < 0) return null;

  const unit = sourceUnit ?? (inputMode === "liters" ? "liter" : "kg");
  if (unit === "tonne") return price;
  if (unit === "kg") return pricePerKilogramToPerTonne(price);

  const parsedDensity = parseFinite(density);
  if (parsedDensity === null || parsedDensity <= 0) return null;
  return pricePerLitreToPerTonne(price, parsedDensity);
}

export function calculateRefuelingAmount(
  pricePerTonne: number | null,
  quantityTonnes: number,
): number | null {
  if (
    pricePerTonne === null ||
    !Number.isFinite(pricePerTonne) ||
    !Number.isFinite(quantityTonnes) ||
    pricePerTonne < 0 ||
    quantityTonnes <= 0
  ) {
    return null;
  }
  return pricePerTonne * quantityTonnes;
}

export function calculateStoredRefuelingMassTonnes(
  quantityKg: number | string | null | undefined,
  _quantityLiters: number | string | null | undefined,
  _density: number | string | null | undefined,
): number | null {
  const kilograms = parseFinite(quantityKg);
  return kilograms === null || kilograms < 0
    ? null
    : kilogramsToTonnes(kilograms);
}

export function refuelingTonnesToLegacyKg(tonnes: number): number {
  return tonnesToKilograms(tonnes);
}
