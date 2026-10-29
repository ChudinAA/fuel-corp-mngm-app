export class TransportationApiInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransportationApiInputError";
  }
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeNonNegativeNumber(
  input: Record<string, unknown>,
  field: string,
  precision: number,
  label: string,
): void {
  if (!Object.prototype.hasOwnProperty.call(input, field)) return;
  const value = toFiniteNumber(input[field]);
  if (input[field] !== null && value === null) {
    throw new TransportationApiInputError(`Некорректное значение: ${label}`);
  }
  if (value !== null && value < 0) {
    throw new TransportationApiInputError(`${label} не может быть отрицательным`);
  }
  input[field] = value === null ? null : Number(value.toFixed(precision));
}

export function normalizeTransportationInput(
  input: Record<string, unknown>,
): Record<string, unknown> {
  if (
    input.inputMode !== undefined &&
    input.inputMode !== null &&
    input.inputMode !== "tonnes" &&
    input.inputMode !== "liters"
  ) {
    throw new TransportationApiInputError("Некорректный режим ввода массы");
  }

  const normalized = { ...input };
  normalizeNonNegativeNumber(normalized, "quantityTonnes", 5, "Масса в тоннах");
  normalizeNonNegativeNumber(
    normalized,
    "purchasePricePerTonne",
    6,
    "Цена закупки за тонну",
  );
  normalizeNonNegativeNumber(
    normalized,
    "salePricePerTonne",
    6,
    "Цена продажи за тонну",
  );
  normalizeNonNegativeNumber(
    normalized,
    "deliveryTariffPerTonne",
    6,
    "Тариф за тонну",
  );
  return normalized;
}
