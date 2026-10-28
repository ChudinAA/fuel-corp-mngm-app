import {
  kilogramsToTonnes,
  pricePerTonneToPerKilogram,
  tonnesToKilograms,
} from "@shared/units";

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
    normalized.quantityKg =
      tonnes === null ? null : tonnesToKilograms(tonnes).toFixed(2);
  } else if (Object.prototype.hasOwnProperty.call(input, "quantityKg")) {
    const kilograms = parseFinite(input.quantityKg);
    if (input.quantityKg !== null && kilograms === null) {
      throw new EquipmentMovementApiInputError("Некорректная масса в килограммах");
    }
    if (kilograms !== null && kilograms < 0) {
      throw new EquipmentMovementApiInputError("Масса не может быть отрицательной");
    }
    normalized.quantityTonnes =
      kilograms === null ? null : kilogramsToTonnes(kilograms).toFixed(5);
  }

  if (Object.prototype.hasOwnProperty.call(input, "costPerTonne")) {
    const rate = parseFinite(input.costPerTonne);
    if (input.costPerTonne !== null && rate === null) {
      throw new EquipmentMovementApiInputError("Некорректная стоимость за тонну");
    }
    normalized.costPerTonne = rate === null ? null : rate.toFixed(6);
    normalized.costPerKg =
      rate === null ? null : pricePerTonneToPerKilogram(rate).toFixed(6);
  } else if (Object.prototype.hasOwnProperty.call(input, "costPerKg")) {
    const rate = parseFinite(input.costPerKg);
    if (input.costPerKg !== null && rate === null) {
      throw new EquipmentMovementApiInputError("Некорректная стоимость за килограмм");
    }
    normalized.costPerTonne =
      rate === null ? null : Number((rate * 1_000).toFixed(6));
  }

  return normalized;
}

export function equipmentMovementDealToApi<T extends Record<string, any>>(
  deal: T,
): Omit<T, "quantityKg" | "costPerKg"> & {
  quantityTonnes: number | null;
  costPerTonne: number | null;
} {
  const { quantityKg, costPerKg, ...rest } = deal;
  const storedKg = parseFinite(quantityKg);
  const storedTonnes = parseFinite(deal.quantityTonnes);
  const storedRate = parseFinite(deal.costPerTonne);
  const legacyRate = parseFinite(costPerKg);
  return {
    ...rest,
    quantityTonnes:
      storedTonnes ?? (storedKg === null ? null : kilogramsToTonnes(storedKg)),
    costPerTonne:
      storedRate ??
      (legacyRate === null ? null : Number((legacyRate * 1_000).toFixed(6))),
  } as Omit<T, "quantityKg" | "costPerKg"> & {
    quantityTonnes: number | null;
    costPerTonne: number | null;
  };
}

export function equipmentMovementResultToApi(result: unknown): unknown {
  if (Array.isArray(result)) {
    return result.map((item) =>
      item && typeof item === "object"
        ? equipmentMovementDealToApi(item as Record<string, any>)
        : item,
    );
  }

  if (!result || typeof result !== "object") return result;
  const value = result as Record<string, any>;
  for (const collectionKey of ["data", "items"]) {
    if (Array.isArray(value[collectionKey])) {
      return {
        ...value,
        [collectionKey]: value[collectionKey].map((item: unknown) =>
          item && typeof item === "object"
            ? equipmentMovementDealToApi(item as Record<string, any>)
            : item,
        ),
      };
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(value, "quantityKg") ||
    Object.prototype.hasOwnProperty.call(value, "quantityTonnes") ||
    Object.prototype.hasOwnProperty.call(value, "costPerTonne")
  ) {
    return equipmentMovementDealToApi(value);
  }
  return result;
}
