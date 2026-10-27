import {
  pricePerKilogramToPerTonne,
  pricePerLitreToPerTonne,
} from "@shared/units";

export type StorageCardPriceUnit = "kg" | "ton" | "tonne" | "t" | "liter";

export function priceToPerTonne(
  price: number,
  unit: StorageCardPriceUnit | string,
  densityKilogramsPerLitre?: number | null,
): number | null {
  if (!Number.isFinite(price) || price < 0) return null;

  switch (unit) {
    case "kg":
      return pricePerKilogramToPerTonne(price);
    case "ton":
    case "tonne":
    case "t":
      return price;
    case "liter":
      if (
        densityKilogramsPerLitre === undefined ||
        densityKilogramsPerLitre === null ||
        !Number.isFinite(densityKilogramsPerLitre) ||
        densityKilogramsPerLitre <= 0
      ) {
        return null;
      }
      return pricePerLitreToPerTonne(price, densityKilogramsPerLitre);
    default:
      return null;
  }
}

export function calculateBalanceMassEquivalentTonnes(
  currencyBalance: number,
  unitPrice: number,
  priceUnit: StorageCardPriceUnit | string,
  densityKilogramsPerLitre?: number | null,
): number | null {
  if (!Number.isFinite(currencyBalance)) return null;

  const pricePerTonne = priceToPerTonne(
    unitPrice,
    priceUnit,
    densityKilogramsPerLitre,
  );
  if (pricePerTonne === null || pricePerTonne <= 0) return null;

  return currencyBalance / pricePerTonne;
}

export function calculateDealMassTonnes(
  quantityKg: number | string | null | undefined,
  quantityLiters: number | string | null | undefined,
  densityKilogramsPerLitre: number | string | null | undefined,
): number | null {
  const liters = Number.parseFloat(String(quantityLiters ?? "0"));
  const density = Number.parseFloat(
    String(densityKilogramsPerLitre ?? "0"),
  );
  if (
    Number.isFinite(liters) &&
    liters > 0 &&
    Number.isFinite(density) &&
    density > 0
  ) {
    return (liters * density) / 1_000;
  }

  const kilograms = Number.parseFloat(String(quantityKg ?? "0"));
  if (Number.isFinite(kilograms) && kilograms > 0) {
    return kilograms / 1_000;
  }

  return null;
}

export function calculateDealPricePerTonne(
  amount: number | string | null | undefined,
  massTonnes: number | null,
): number | null {
  const total = Number.parseFloat(String(amount ?? "0"));
  if (
    !Number.isFinite(total) ||
    massTonnes === null ||
    !Number.isFinite(massTonnes) ||
    massTonnes <= 0
  ) {
    return null;
  }

  return total / massTonnes;
}
