function parseRate(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function deliveryRateInputValue(
  costPerTonne: string | number | null | undefined,
): string {
  const parsed = parseRate(costPerTonne);
  return parsed === null
    ? ""
    : parsed.toFixed(2);
}

export function deliveryRateForApi(
  costPerTonneInput: string | number,
): string {
  const costPerTonne = parseRate(costPerTonneInput);
  if (costPerTonne === null) {
    throw new TypeError("A valid delivery price per tonne is required");
  }
  return costPerTonne.toFixed(2);
}
