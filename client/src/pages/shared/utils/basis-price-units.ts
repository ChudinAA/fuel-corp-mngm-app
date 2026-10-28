import {
  formatPricePerTonne,
  pricePerKilogramToPerTonne,
  pricePerTonneToPerKilogram,
} from "@shared/units";

type NumericValue = string | number | null | undefined;

function finiteNumber(value: NumericValue): number | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function legacyKilogramRateToFormTonnes(value: NumericValue): string {
  const rate = finiteNumber(value);
  return rate === null
    ? ""
    : pricePerKilogramToPerTonne(rate).toFixed(2);
}

export function formTonnesRateToLegacyKilograms(
  value: string,
  originalLegacyValue?: NumericValue,
): string | null {
  const ratePerTonne = finiteNumber(value);
  if (ratePerTonne === null) return null;

  const originalRatePerTonne = legacyKilogramRateToFormTonnes(
    originalLegacyValue,
  );
  if (
    originalLegacyValue != null &&
    originalRatePerTonne !== "" &&
    ratePerTonne.toFixed(2) === originalRatePerTonne
  ) {
    return String(originalLegacyValue);
  }

  return String(pricePerTonneToPerKilogram(ratePerTonne));
}

export function formatLegacyKilogramRatePerTonne(
  value: NumericValue,
): string {
  const rate = finiteNumber(value);
  return rate === null
    ? ""
    : formatPricePerTonne(pricePerKilogramToPerTonne(rate));
}

export function formatOtherBasisServiceValue(
  value: NumericValue,
  serviceType: string | null | undefined,
): string {
  const amount = finiteNumber(value);
  if (amount === null) return "";

  const formatted = formatPricePerTonne(amount);
  if (serviceType === "percent_of_amount") return `${formatted}%`;
  if (serviceType === "royalty_per_ton") return `${formatted} ₽/т`;
  return `${formatted} ₽`;
}
