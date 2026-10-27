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

export function toLegacyEquipmentMovementInput(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const legacy: Record<string, unknown> = { ...input };

  if (Object.prototype.hasOwnProperty.call(input, "quantityTonnes")) {
    const tonnes = parseFinite(input.quantityTonnes);
    if (input.quantityTonnes !== null && tonnes === null) {
      throw new EquipmentMovementApiInputError("Некорректная масса в тоннах");
    }
    if (tonnes !== null && tonnes < 0) {
      throw new EquipmentMovementApiInputError("Масса не может быть отрицательной");
    }
    legacy.quantityKg =
      tonnes === null ? null : tonnesToKilograms(tonnes).toFixed(2);
  }

  if (Object.prototype.hasOwnProperty.call(input, "costPerTonne")) {
    const rate = parseFinite(input.costPerTonne);
    if (input.costPerTonne !== null && rate === null) {
      throw new EquipmentMovementApiInputError("Некорректная стоимость за тонну");
    }
    legacy.costPerKg =
      rate === null ? null : pricePerTonneToPerKilogram(rate).toFixed(6);
  }

  delete legacy.quantityTonnes;
  delete legacy.costPerTonne;
  return legacy;
}

export function equipmentMovementDealToApi<T extends Record<string, any>>(
  deal: T,
): Omit<T, "quantityKg" | "costPerKg"> & {
  quantityTonnes: number | null;
  costPerTonne: number | null;
} {
  const { quantityKg, costPerKg, ...rest } = deal;
  const liters = parseFinite(deal.quantityLiters);
  const density = parseFinite(deal.density);
  const tonnesFromLiters =
    liters !== null && liters > 0 && density !== null && density > 0
      ? kilogramsToTonnes(liters * density)
      : null;
  const storedKg = parseFinite(quantityKg);
  return {
    ...rest,
    quantityTonnes:
      tonnesFromLiters ??
      (storedKg === null ? null : kilogramsToTonnes(storedKg)),
    costPerTonne:
      parseFinite(costPerKg) === null
        ? null
        : Number((parseFinite(costPerKg)! * 1_000).toFixed(6)),
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
  if (Array.isArray(value.data)) {
    return {
      ...value,
      data: value.data.map((item: unknown) =>
        item && typeof item === "object"
          ? equipmentMovementDealToApi(item as Record<string, any>)
          : item,
      ),
    };
  }
  if (
    Object.prototype.hasOwnProperty.call(value, "quantityKg") ||
    Object.prototype.hasOwnProperty.call(value, "quantityTonnes")
  ) {
    return equipmentMovementDealToApi(value);
  }
  return result;
}
