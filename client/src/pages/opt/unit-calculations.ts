import {
  kilogramsToTonnes,
  litresAndDensityToTonnes,
  pricePerKilogramToPerTonne,
  pricePerLitreToPerTonne,
  pricePerTonneToPerKilogram,
  tonnesToKilograms,
} from "@shared/units";

export type OptInputMode = "liters" | "tonnes";

interface OptQuantityInput {
  inputMode: OptInputMode;
  quantityTonnes: string | number | null | undefined;
  quantityLiters: string | number | null | undefined;
  density: string | number | null | undefined;
}

function finiteNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateOptTonnes(input: OptQuantityInput): number {
  if (input.inputMode === "liters") {
    const liters = finiteNumber(input.quantityLiters);
    const density = finiteNumber(input.density);
    if (liters === null || density === null || liters <= 0 || density <= 0) {
      return 0;
    }
    return litresAndDensityToTonnes(liters, density);
  }

  const tonnes = finiteNumber(input.quantityTonnes);
  return tonnes !== null && tonnes > 0 ? tonnes : 0;
}

export function optTonnesToLegacyKilograms(tonnes: number): number {
  return Number(tonnesToKilograms(tonnes).toFixed(2));
}

export function optLegacyKilogramsToTonnes(kilograms: number): number {
  return kilogramsToTonnes(kilograms);
}

export function contractPricePerTonne(
  price: string | number | null | undefined,
  priceUnit: string | null | undefined,
  density: string | number | null | undefined,
): number | null {
  const rate = finiteNumber(price);
  if (rate === null) return null;
  if (priceUnit === "liter") {
    const dealDensity = finiteNumber(density);
    if (dealDensity === null || dealDensity <= 0) return null;
    return pricePerLitreToPerTonne(rate, dealDensity);
  }
  return pricePerKilogramToPerTonne(rate);
}

export function contractPricePerKilogram(
  price: string | number | null | undefined,
  priceUnit: string | null | undefined,
  density: string | number | null | undefined,
): number | null {
  const pricePerTonne = contractPricePerTonne(price, priceUnit, density);
  return pricePerTonne === null
    ? null
    : pricePerTonneToPerKilogram(pricePerTonne);
}

