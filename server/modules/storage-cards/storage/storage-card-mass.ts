import {
  pricePerLitreToPerTonne,
} from "@shared/units";

export type StorageCardPriceUnit = "tonne" | "liter";

export function priceToPerTonne(
  price: number,
  unit: StorageCardPriceUnit | string,
  densityKilogramsPerLitre?: number | null,
): number | null {
  if (!Number.isFinite(price) || price < 0) return null;

  switch (unit) {
    case "tonne":
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
  quantityTonnes: number | string | null | undefined,
): number | null {
  const tonnes = Number.parseFloat(String(quantityTonnes ?? ""));
  return Number.isFinite(tonnes) && tonnes >= 0 ? tonnes : null;
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
