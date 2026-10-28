import {
  pricePerTonneToPerKilogram,
  tonnesToKilograms,
} from "@shared/units";

export function exchangeDealMovementUnitFields(
  quantityTonnes: number,
  pricePerTonne: number,
) {
  if (!Number.isFinite(quantityTonnes) || !Number.isFinite(pricePerTonne)) {
    throw new RangeError("Movement mass and price must be finite numbers");
  }

  const storedTonnes = Number(quantityTonnes.toFixed(5));
  const storedPricePerTonne = Number(pricePerTonne.toFixed(6));
  const storedKilograms = tonnesToKilograms(storedTonnes);
  const storedPricePerKilogram =
    pricePerTonneToPerKilogram(storedPricePerTonne);

  return {
    quantityTonnes: storedTonnes.toFixed(5),
    quantityKg: storedKilograms.toFixed(2),
    purchasePricePerTonne: storedPricePerTonne.toFixed(6),
    purchasePrice: storedPricePerKilogram.toFixed(6),
    costPerTonne: storedPricePerTonne.toFixed(6),
    costPerKg: storedPricePerKilogram.toFixed(6),
  };
}
