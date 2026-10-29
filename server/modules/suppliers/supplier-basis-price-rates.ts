export class SupplierBasisPriceRateInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupplierBasisPriceRateInputError";
  }
}

type RateRecord = Record<string, unknown>;

const tonneRateKeys = [
  ["servicePricePerTonne", "ставка услуги"],
  ["pvkjPricePerTonne", "ставка ПВКЖ"],
  ["agentFeePerTonne", "агентская ставка"],
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

export function normalizeSupplierBasisPriceRates(
  input: RateRecord,
  current?: RateRecord | null,
): RateRecord {
  const normalized = { ...input };
  for (const [key, label] of tonneRateKeys) {
    if (!hasOwn(input, key)) continue;
    const submitted = parseRate(input[key], label);
    if (submitted === null) {
      normalized[key] = null;
      continue;
    }

    const saved = parseRate(current?.[key], label);
    const preserveStoredPrecision =
      saved !== null && submitted.toFixed(2) === saved.toFixed(2);
    normalized[key] = (preserveStoredPrecision ? saved : submitted).toFixed(6);
  }
  return normalized;
}
