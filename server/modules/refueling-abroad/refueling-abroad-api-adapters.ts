import {
  legacyDealMassToTonnes,
  pricePerKilogramToPerTonne,
  pricePerLitreToPerTonne,
  pricePerTonneToPerKilogram,
  tonnesToKilograms,
} from "@shared/units";

export class RefuelingAbroadApiInputError extends Error {}

function optionalNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new RefuelingAbroadApiInputError(`${field} должна быть числом`);
  }
  return parsed;
}

export function toLegacyRefuelingAbroadInput(
  body: unknown,
): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RefuelingAbroadApiInputError(
      "Тело зарубежной заправки должно быть объектом",
    );
  }

  const input = body as Record<string, unknown>;
  const legacy = { ...input };

  if (Object.prototype.hasOwnProperty.call(input, "quantityTonnes")) {
    const tonnes = optionalNumber(input.quantityTonnes, "Масса в тоннах");
    legacy.quantityKg =
      tonnes === null ? null : Number(tonnesToKilograms(tonnes).toFixed(2));
    delete legacy.quantityTonnes;
  }

  for (const [apiField, legacyField] of [
    ["purchasePriceUsdPerTonne", "purchasePriceUsd"],
    ["purchasePriceRubPerTonne", "purchasePriceRub"],
    ["salePriceUsdPerTonne", "salePriceUsd"],
    ["salePriceRubPerTonne", "salePriceRub"],
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(input, apiField)) {
      const rate = optionalNumber(input[apiField], apiField);
      legacy[legacyField] =
        rate === null ? null : pricePerTonneToPerKilogram(rate);
      delete legacy[apiField];
    }
  }

  return legacy;
}

export function refuelingAbroadInputUsesNormalizedRates(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const input = body as Record<string, unknown>;
  return (
    input.inputMode === "tonnes" ||
    [
      "purchasePriceUsdPerTonne",
      "purchasePriceRubPerTonne",
      "salePriceUsdPerTonne",
      "salePriceRubPerTonne",
    ].some((field) => Object.prototype.hasOwnProperty.call(input, field))
  );
}

function rateFromStoredAmountOrLegacyRate(
  amount: unknown,
  legacyRate: unknown,
  quantityTonnes: number | null,
  storedInputMode: unknown,
  density: unknown,
  amountField: string,
  rateField: string,
): number | null {
  const total = optionalNumber(amount, amountField);
  if (total !== null && quantityTonnes !== null && quantityTonnes > 0) {
    return total / quantityTonnes;
  }

  const rate = optionalNumber(legacyRate, rateField);
  if (rate === null) return null;
  if (storedInputMode === "liters") {
    const densityValue = optionalNumber(density, "density");
    return densityValue === null || densityValue <= 0
      ? null
      : pricePerLitreToPerTonne(rate, densityValue);
  }
  return pricePerKilogramToPerTonne(rate);
}

export function refuelingAbroadDealToApi<
  T extends {
    quantityKg: unknown;
    quantityLiters?: unknown;
    density?: unknown;
    inputMode?: unknown;
    purchasePriceUsd?: unknown;
    purchasePriceRub?: unknown;
    salePriceUsd?: unknown;
    salePriceRub?: unknown;
    purchaseAmountUsd?: unknown;
    purchaseAmountRub?: unknown;
    saleAmountUsd?: unknown;
    saleAmountRub?: unknown;
  },
>(deal: T) {
  const {
    quantityKg,
    inputMode: storedInputMode,
    purchasePriceUsd,
    purchasePriceRub,
    salePriceUsd,
    salePriceRub,
    ...fields
  } = deal;
  const quantityTonnes = legacyDealMassToTonnes(
    quantityKg as number | string | null | undefined,
    deal.quantityLiters as number | string | null | undefined,
    deal.density as number | string | null | undefined,
  );
  const hasLitres = (optionalNumber(deal.quantityLiters, "quantityLiters") ?? 0) > 0;

  return {
    ...fields,
    inputMode:
      storedInputMode === "liters" || hasLitres ? "liters" : "tonnes",
    quantityTonnes,
    purchasePriceUsdPerTonne: rateFromStoredAmountOrLegacyRate(
      deal.purchaseAmountUsd,
      purchasePriceUsd,
      quantityTonnes,
      storedInputMode,
      deal.density,
      "purchaseAmountUsd",
      "purchasePriceUsd",
    ),
    purchasePriceRubPerTonne: rateFromStoredAmountOrLegacyRate(
      deal.purchaseAmountRub,
      purchasePriceRub,
      quantityTonnes,
      storedInputMode,
      deal.density,
      "purchaseAmountRub",
      "purchasePriceRub",
    ),
    salePriceUsdPerTonne: rateFromStoredAmountOrLegacyRate(
      deal.saleAmountUsd,
      salePriceUsd,
      quantityTonnes,
      storedInputMode,
      deal.density,
      "saleAmountUsd",
      "salePriceUsd",
    ),
    salePriceRubPerTonne: rateFromStoredAmountOrLegacyRate(
      deal.saleAmountRub,
      salePriceRub,
      quantityTonnes,
      storedInputMode,
      deal.density,
      "saleAmountRub",
      "salePriceRub",
    ),
  };
}

export function refuelingAbroadResultToApi(result: unknown): unknown {
  if (Array.isArray(result)) {
    return result.map((item) =>
      item && typeof item === "object"
        ? refuelingAbroadDealToApi(item as any)
        : item,
    );
  }
  if (!result || typeof result !== "object") return result;

  const record = result as Record<string, unknown>;
  if (Array.isArray(record.data)) {
    return {
      ...record,
      data: record.data.map((item) =>
        item && typeof item === "object"
          ? refuelingAbroadDealToApi(item as any)
          : item,
      ),
    };
  }
  return Object.prototype.hasOwnProperty.call(record, "quantityKg")
    ? refuelingAbroadDealToApi(result as any)
    : result;
}
