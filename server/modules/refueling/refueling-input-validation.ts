export class RefuelingApiInputError extends Error {}

function optionalNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new RefuelingApiInputError(`${field} должна быть числом`);
  }
  return parsed;
}

export function normalizeRefuelingInput(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RefuelingApiInputError("Тело заправки должно быть объектом");
  }

  const input = body as Record<string, unknown>;
  const normalized = { ...input };
  if (Object.prototype.hasOwnProperty.call(input, "quantityTonnes")) {
    const tonnes = optionalNumber(input.quantityTonnes, "Масса в тоннах");
    if (tonnes !== null && tonnes < 0) {
      throw new RefuelingApiInputError("Масса в тоннах не может быть отрицательной");
    }
    normalized.quantityTonnes = tonnes === null ? null : Number(tonnes.toFixed(5));
  }

  for (const field of [
    "purchasePricePerTonne",
    "salePricePerTonne",
    "agentFeeRatePerTonne",
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      normalized[field] = optionalNumber(input[field], field);
    }
  }
  return normalized;
}
