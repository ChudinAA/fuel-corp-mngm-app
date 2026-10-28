import {
  formatPricePerTonne,
  pricePerKilogramToPerTonne,
  pricePerTonneToPerKilogram,
} from "@shared/units";

export type NumericValue = string | number | null | undefined;
export type StoredBasisPriceRate = {
  value: number;
  unit: "tonne" | "kg";
};

function finiteNumber(value: NumericValue): number | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getStoredBasisPriceRate(
  tonneValue: NumericValue,
  legacyKilogramValue: NumericValue,
): StoredBasisPriceRate | null {
  const tonneRate = finiteNumber(tonneValue);
  if (tonneRate !== null) return { value: tonneRate, unit: "tonne" };
  const legacyRate = finiteNumber(legacyKilogramValue);
  return legacyRate === null ? null : { value: legacyRate, unit: "kg" };
}

export function formTonnesRateToNumber(value: string): number | null {
  return finiteNumber(value);
}

export function legacyKilogramRateToFormTonnes(value: NumericValue): string {
  const rate = finiteNumber(value);
  return rate === null
    ? ""
    : pricePerKilogramToPerTonne(rate).toFixed(2);
}

export function storedBasisRateToFormTonnes(
  tonneValue: NumericValue,
  legacyKilogramValue: NumericValue,
): string {
  const tonneRate = finiteNumber(tonneValue);
  return tonneRate === null
    ? legacyKilogramRateToFormTonnes(legacyKilogramValue)
    : tonneRate.toFixed(2);
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

export function formatStoredBasisRatePerTonne(
  tonneValue: NumericValue,
  legacyKilogramValue: NumericValue,
): string {
  const tonneRate = finiteNumber(tonneValue);
  if (tonneRate !== null) return formatPricePerTonne(tonneRate);
  return formatLegacyKilogramRatePerTonne(legacyKilogramValue);
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
