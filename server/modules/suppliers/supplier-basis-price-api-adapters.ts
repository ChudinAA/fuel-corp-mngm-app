import {
  pricePerKilogramToPerTonne,
  pricePerTonneToPerKilogram,
} from "@shared/units";

export class SupplierBasisPriceRateInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupplierBasisPriceRateInputError";
  }
}

type RateRecord = Record<string, unknown>;

const ratePairs = [
  ["servicePrice", "servicePricePerTonne", "ставка услуги"],
  ["pvkjPrice", "pvkjPricePerTonne", "ставка ПВКЖ"],
  ["agentFee", "agentFeePerTonne", "агентская ставка"],
] as const;

function hasOwn(record: RateRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function parseRate(value: unknown, label: string): number | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new SupplierBasisPriceRateInputError(`Некорректное значение: ${label}`);
  }
  return parsed;
}

function sameAtDisplayPrecision(left: number, right: number): boolean {
  return left.toFixed(2) === right.toFixed(2);
}

function tonneColumnValue(value: number): string {
  return value.toFixed(6);
}

export function normalizeSupplierBasisPriceRates(
  input: RateRecord,
  current?: RateRecord | null,
): RateRecord {
  const normalized = { ...input };

  for (const [legacyKey, tonneKey, label] of ratePairs) {
    const hasTonneValue = hasOwn(input, tonneKey);
    const hasLegacyValue = hasOwn(input, legacyKey);
    const currentLegacy = parseRate(current?.[legacyKey], label);
    const storedTonne = parseRate(current?.[tonneKey], label);
    const currentTonne =
      storedTonne ??
      (currentLegacy === null
        ? null
        : pricePerKilogramToPerTonne(currentLegacy));
    const submittedTonne = hasTonneValue
      ? parseRate(input[tonneKey], label)
      : null;
    const submittedLegacy = hasLegacyValue
      ? parseRate(input[legacyKey], label)
      : null;

    if (hasTonneValue && submittedTonne !== null) {
      const tonneUnchangedAtDisplayPrecision =
        currentTonne !== null &&
        sameAtDisplayPrecision(submittedTonne, currentTonne);
      const legacyDoesNotConflict =
        !hasLegacyValue ||
        currentLegacy === null ||
        submittedLegacy === currentLegacy;
      const preserveExistingPrecision =
        tonneUnchangedAtDisplayPrecision && legacyDoesNotConflict;
      const effectiveTonne = preserveExistingPrecision
        ? currentTonne
        : submittedTonne;
      const preserveStoredTonne =
        preserveExistingPrecision &&
        current?.[tonneKey] != null;
      const preserveStoredLegacy =
        preserveExistingPrecision &&
        current?.[legacyKey] != null;

      normalized[tonneKey] = preserveStoredTonne
        ? String(current![tonneKey])
        : tonneColumnValue(effectiveTonne);
      normalized[legacyKey] = preserveStoredLegacy
        ? String(current![legacyKey])
        : pricePerTonneToPerKilogram(effectiveTonne).toFixed(6);
    } else if (hasLegacyValue && submittedLegacy !== null) {
      normalized[legacyKey] = String(input[legacyKey]);
      normalized[tonneKey] = tonneColumnValue(
        pricePerKilogramToPerTonne(submittedLegacy),
      );
    } else if (hasTonneValue || hasLegacyValue) {
      normalized[legacyKey] = null;
      normalized[tonneKey] = null;
    }
  }

  return normalized;
}
