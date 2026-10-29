import { formatPricePerTonne } from "@shared/units";

export type NumericValue = string | number | null | undefined;
export type StoredBasisPriceRate = {
  value: number;
  unit: "tonne";
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
): StoredBasisPriceRate | null {
  const tonneRate = finiteNumber(tonneValue);
  if (tonneRate !== null) return { value: tonneRate, unit: "tonne" };
  return null;
}

export function formTonnesRateToNumber(value: string): number | null {
  return finiteNumber(value);
}

export function storedBasisRateToFormTonnes(tonneValue: NumericValue): string {
  const tonneRate = finiteNumber(tonneValue);
  return tonneRate === null ? "" : tonneRate.toFixed(2);
}

export function formatStoredBasisRatePerTonne(tonneValue: NumericValue): string {
  const tonneRate = finiteNumber(tonneValue);
  return tonneRate === null ? "" : formatPricePerTonne(tonneRate);
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
