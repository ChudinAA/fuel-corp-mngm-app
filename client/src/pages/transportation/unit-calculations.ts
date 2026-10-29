import {
  formatPricePerTonne,
  litresAndDensityToTonnes,
  pricePerLitreToPerTonne,
} from "@shared/units";

export type TransportationInputMode = "liters" | "tonnes";
export type TransportationPriceUnit = "liter" | "tonne";

function parseFinite(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateTransportationMassTonnes(
  inputMode: TransportationInputMode,
  quantity: number | string | null | undefined,
  density?: number | string | null,
): number | null {
  const parsedQuantity = parseFinite(quantity);
  if (parsedQuantity === null || parsedQuantity < 0) return null;
  if (inputMode === "tonnes") return parsedQuantity;
  if (parsedQuantity === 0) return 0;

  const parsedDensity = parseFinite(density);
  if (parsedDensity === null || parsedDensity <= 0) return null;
  return litresAndDensityToTonnes(parsedQuantity, parsedDensity);
}

export function calculateTransportationPricePerTonne(
  sourcePrice: number | string | null | undefined,
  sourceUnit: TransportationPriceUnit,
  density?: number | string | null,
): number | null {
  const price = parseFinite(sourcePrice);
  if (price === null || price < 0) return null;
  if (sourceUnit === "tonne") return price;

  const parsedDensity = parseFinite(density);
  if (parsedDensity === null || parsedDensity <= 0) return null;
  return pricePerLitreToPerTonne(price, parsedDensity);
}

export function calculateTransportationAmount(
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

export function formatTransportationPriceOption(
  sourcePrice: number | string,
  sourceUnit: TransportationPriceUnit,
  density?: number | string | null,
): string {
  const price = parseFinite(sourcePrice);
  const pricePerTonne = calculateTransportationPricePerTonne(
    sourcePrice,
    sourceUnit,
    density,
  );
  if (price === null || pricePerTonne === null) {
    return "Цена за тонну недоступна";
  }

  const perTonne = `${formatPricePerTonne(pricePerTonne)} ₽/т`;
  if (sourceUnit !== "liter") return perTonne;

  const sourcePriceFormatted = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
  return `${perTonne} (${sourcePriceFormatted} ₽/л)`;
}
