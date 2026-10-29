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

const removedKilogramKeys = ["servicePrice", "pvkjPrice", "agentFee"] as const;

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
  const legacyKey = removedKilogramKeys.find((key) => hasOwn(input, key));
  if (legacyKey) {
    throw new SupplierBasisPriceRateInputError(
      `Поле ${legacyKey} больше не поддерживается; передавайте ставку в ₽/т`,
    );
  }

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

export function supplierBasisPriceToApi(value: RateRecord): RateRecord {
  const {
    servicePrice: _servicePrice,
    pvkjPrice: _pvkjPrice,
    agentFee: _agentFee,
    ...tonneRates
  } = value;
  return tonneRates;
}
