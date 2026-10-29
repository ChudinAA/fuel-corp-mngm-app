export class RefuelingAbroadApiInputError extends Error {}

function optionalNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new RefuelingAbroadApiInputError(`${field} должна быть числом`);
  }
  return parsed;
}

export function normalizeRefuelingAbroadInput(
  body: unknown,
): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RefuelingAbroadApiInputError(
      "Тело зарубежной заправки должно быть объектом",
    );
  }

  const input = body as Record<string, unknown>;
  if (
    input.inputMode != null &&
    input.inputMode !== "tonnes" &&
    input.inputMode !== "liters"
  ) {
    throw new RefuelingAbroadApiInputError(
      "inputMode must be either tonnes or liters",
    );
  }

  const normalized = { ...input };
  if (Object.prototype.hasOwnProperty.call(input, "quantityTonnes")) {
    const tonnes = optionalNumber(input.quantityTonnes, "quantityTonnes");
    if (tonnes !== null && tonnes < 0) {
      throw new RefuelingAbroadApiInputError(
        "Масса в тоннах не может быть отрицательной",
      );
    }
    normalized.quantityTonnes =
      tonnes === null ? null : Number(tonnes.toFixed(5));
  }

  for (const field of [
    "purchasePriceUsdPerTonne",
    "purchasePriceRubPerTonne",
    "salePriceUsdPerTonne",
    "salePriceRubPerTonne",
  ]) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      normalized[field] = optionalNumber(input[field], field);
    }
  }
  return normalized;
}
