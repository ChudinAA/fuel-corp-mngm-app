export class EquipmentMovementApiInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EquipmentMovementApiInputError";
  }
}

function parseFinite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeEquipmentMovementInput(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...input };

  if (Object.prototype.hasOwnProperty.call(input, "quantityTonnes")) {
    const tonnes = parseFinite(input.quantityTonnes);
    if (input.quantityTonnes !== null && tonnes === null) {
      throw new EquipmentMovementApiInputError("Некорректная масса в тоннах");
    }
    if (tonnes !== null && tonnes < 0) {
      throw new EquipmentMovementApiInputError("Масса не может быть отрицательной");
    }
    normalized.quantityTonnes = tonnes === null ? null : tonnes.toFixed(5);
  }

  if (Object.prototype.hasOwnProperty.call(input, "costPerTonne")) {
    const rate = parseFinite(input.costPerTonne);
    if (input.costPerTonne !== null && rate === null) {
      throw new EquipmentMovementApiInputError("Некорректная стоимость за тонну");
    }
    normalized.costPerTonne = rate === null ? null : rate.toFixed(6);
  }
  return normalized;
}
