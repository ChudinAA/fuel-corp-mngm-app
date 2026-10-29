export class SupplierBasisPriceRateInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupplierBasisPriceRateInputError";
  }
}

type RateRecord = Record<string, unknown>;

const rateFields = [
  ["servicePrice", "servicePricePerTonne", "ставка услуги"],
  ["pvkjPrice", "pvkjPricePerTonne", "ставка ПВКЖ"],
  ["agentFee", "agentFeePerTonne", "агентская ставка"],
] as const;

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

  for (const [legacyField, tonneField, label] of rateFields) {
    if (Object.prototype.hasOwnProperty.call(input, legacyField)) {
      throw new SupplierBasisPriceRateInputError(
        `${label} должна быть указана только в расчёте на тонну`,
      );
    }

    if (Object.prototype.hasOwnProperty.call(input, tonneField)) {
      const value = parseRate(input[tonneField], label);
      const saved = parseRate(current?.[tonneField], label);
      normalized[tonneField] =
        value === null
          ? null
          : saved !== null && value.toFixed(2) === saved.toFixed(2)
            ? String(current![tonneField])
            : value.toFixed(6);
    }
    delete normalized[legacyField];
  }

  return normalized;
}

export function supplierBasisPriceToApi<T extends RateRecord>(basisPrice: T) {
  const {
    servicePrice: _servicePrice,
    pvkjPrice: _pvkjPrice,
    agentFee: _agentFee,
    ...apiRate
  } = basisPrice;
  return apiRate;
}
