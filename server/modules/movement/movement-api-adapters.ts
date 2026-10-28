import {
  kilogramsToTonnes,
  pricePerTonneToPerKilogram,
  tonnesToKilograms,
} from "@shared/units";

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

function perTonneToLegacyRate(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const rate = parseFinite(value);
  if (rate === null) {
    throw new MovementApiInputError("Некорректная ставка за тонну");
  }
  return Number(pricePerTonneToPerKilogram(rate).toFixed(6));
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
    normalized.quantityKg =
      tonnes === null ? null : Number(tonnesToKilograms(tonnes).toFixed(2));
  } else if (Object.prototype.hasOwnProperty.call(input, "quantityKg")) {
    const kilograms = parseFinite(input.quantityKg);
    if (input.quantityKg !== null && kilograms === null) {
      throw new MovementApiInputError("Некорректная масса в килограммах");
    }
    if (kilograms !== null && kilograms < 0) {
      throw new MovementApiInputError("Масса не может быть отрицательной");
    }
    normalized.quantityTonnes =
      kilograms === null ? null : Number(kilogramsToTonnes(kilograms).toFixed(5));
  }

  for (const [apiField, legacyField] of [
    ["purchasePricePerTonne", "purchasePrice"],
    ["deliveryPricePerTonne", "deliveryPrice"],
    ["costPerTonne", "costPerKg"],
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(input, apiField)) {
      const rate = parseFinite(input[apiField]);
      normalized[apiField] = rate === null ? null : Number(rate.toFixed(6));
      normalized[legacyField] = perTonneToLegacyRate(input[apiField]);
    } else if (Object.prototype.hasOwnProperty.call(input, legacyField)) {
      const rate = parseFinite(input[legacyField]);
      if (input[legacyField] !== null && rate === null) {
        throw new MovementApiInputError("Некорректная ставка за килограмм");
      }
      const tonneField =
        apiField as "purchasePricePerTonne" | "deliveryPricePerTonne" | "costPerTonne";
      normalized[tonneField] =
        rate === null ? null : Number((rate * 1_000).toFixed(6));
    }
  }

  return normalized;
}

export function movementDealToApi<T extends Record<string, any>>(
  deal: T,
): Omit<
  T,
  "quantityKg" | "purchasePrice" | "deliveryPrice" | "costPerKg"
> & {
  quantityTonnes: number | null;
  purchasePricePerTonne: number | null;
  deliveryPricePerTonne: number | null;
  costPerTonne: number | null;
} {
  const {
    quantityKg,
    purchasePrice,
    deliveryPrice,
    costPerKg,
    ...rest
  } = deal;
  const storedKg = parseFinite(quantityKg);
  const quantityTonnes =
    parseFinite(deal.quantityTonnes) ??
    (storedKg === null ? null : kilogramsToTonnes(storedKg));
  const storedPurchasePrice = parseFinite(purchasePrice);
  const purchasePricePerTonne =
    parseFinite(deal.purchasePricePerTonne) ??
    (storedPurchasePrice === null
      ? null
      : Number((storedPurchasePrice * 1_000).toFixed(6)));
  const purchaseAmount =
    quantityTonnes !== null && purchasePricePerTonne !== null
      ? quantityTonnes * purchasePricePerTonne
      : 0;

  return {
    ...rest,
    quantityTonnes,
    purchaseAmount,
    purchasePricePerTonne,
    deliveryPricePerTonne:
      parseFinite(deal.deliveryPricePerTonne) ??
      (parseFinite(deliveryPrice) === null
        ? null
        : Number((parseFinite(deliveryPrice)! * 1_000).toFixed(6))),
    costPerTonne:
      parseFinite(deal.costPerTonne) ??
      (parseFinite(costPerKg) === null
        ? null
        : Number((parseFinite(costPerKg)! * 1_000).toFixed(6))),
  } as Omit<
    T,
    "quantityKg" | "purchasePrice" | "deliveryPrice" | "costPerKg"
  > & {
    quantityTonnes: number | null;
    purchasePricePerTonne: number | null;
    deliveryPricePerTonne: number | null;
    costPerTonne: number | null;
  };
}

export function movementResultToApi(result: unknown): unknown {
  if (Array.isArray(result)) {
    return result.map((item) =>
      item && typeof item === "object"
        ? movementDealToApi(item as Record<string, any>)
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
          ? movementDealToApi(item as Record<string, any>)
          : item,
      ),
    };
  }
  if (
    Object.prototype.hasOwnProperty.call(value, "quantityKg") ||
    Object.prototype.hasOwnProperty.call(value, "quantityTonnes")
  ) {
    return movementDealToApi(value);
  }
  return result;
}
