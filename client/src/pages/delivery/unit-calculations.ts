import {
  pricePerKilogramToPerTonne,
  pricePerTonneToPerKilogram,
} from "@shared/units";

function parseRate(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function deliveryRatePerTonneInputValue(
  costPerKg: string | number | null | undefined,
): string {
  const parsed = parseRate(costPerKg);
  return parsed === null
    ? ""
    : pricePerKilogramToPerTonne(parsed).toFixed(2);
}

export function deliveryRatePerKgForSave(
  costPerTonneInput: string | number,
  originalCostPerKg?: string | number | null,
): number {
  const costPerTonne = parseRate(costPerTonneInput);
  if (costPerTonne === null) {
    throw new TypeError("A valid delivery price per tonne is required");
  }

  const originalPerKg = parseRate(originalCostPerKg);
  if (
    originalPerKg !== null &&
    Number(costPerTonne.toFixed(2)) ===
      Number(pricePerKilogramToPerTonne(originalPerKg).toFixed(2))
  ) {
    // Preserve legacy precision when the user changes unrelated route fields.
    return originalPerKg;
  }

  return pricePerTonneToPerKilogram(costPerTonne);
}
