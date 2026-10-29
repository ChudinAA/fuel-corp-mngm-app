export class MovementApiInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MovementApiInputError";
  }
}

function parseFinite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeMovementInput(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...input };

  if (Object.prototype.hasOwnProperty.call(input, "quantityTonnes")) {
    const tonnes = parseFinite(input.quantityTonnes);
    if (input.quantityTonnes !== null && tonnes === null) {
      throw new MovementApiInputError("Некорректная масса в тоннах");
    }
    if (tonnes !== null && tonnes < 0) {
      throw new MovementApiInputError("Масса не может быть отрицательной");
    }
    normalized.quantityTonnes =
      tonnes === null ? null : Number(tonnes.toFixed(5));
  }

  for (const field of [
    "purchasePricePerTonne",
    "deliveryPricePerTonne",
    "costPerTonne",
  ] as const) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    const rate = parseFinite(input[field]);
    if (input[field] !== null && rate === null) {
      throw new MovementApiInputError(`Некорректное значение ${field}`);
    }
    normalized[field] = rate === null ? null : Number(rate.toFixed(6));
  }

  return normalized;
}
