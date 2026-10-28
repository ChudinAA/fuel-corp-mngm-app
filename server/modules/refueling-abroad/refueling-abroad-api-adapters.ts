import {
  kilogramsToTonnes,
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
  const normalized = { ...input };
  for (const field of [
    "quantityTonnes",
    "quantityKg",
    "purchasePriceUsdPerTonne",
    "purchasePriceRubPerTonne",
    "salePriceUsdPerTonne",
    "salePriceRubPerTonne",
    "purchasePriceUsd",
    "purchasePriceRub",
    "salePriceUsd",
    "salePriceRub",
  ]) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      normalized[field] = optionalNumber(input[field], field);
    }
  }
  return normalized;
}

function hasOwn(record: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function finiteOrNull(
  record: Record<string, unknown> | undefined,
  field: string,
): number | null {
  return record ? optionalNumber(record[field], field) : null;
}

function valuesEqualAtPrecision(
  left: number | null,
  right: number | null,
  digits: number,
): boolean {
  if (left === null || right === null) return left === right;
  const factor = 10 ** digits;
  return Math.round(left * factor) === Math.round(right * factor);
}

function legacyRateToPerTonne(
  rate: number,
  inputMode: unknown,
  density: number | null,
  field: string,
): number {
  if (inputMode === "liters") {
    if (density === null || density <= 0) {
      throw new RefuelingAbroadApiInputError(
        `Для пересчёта ${field} из цены за литр в цену за тонну нужна положительная плотность`,
      );
    }
    return pricePerLitreToPerTonne(rate, density);
  }
  return pricePerKilogramToPerTonne(rate);
}

function perTonneRateToLegacy(
  rate: number | null,
  inputMode: unknown,
  density: number | null,
): number | null {
  if (rate === null) return null;
  if (inputMode === "liters") {
    return density !== null && density > 0
      ? Number(((rate * density) / 1_000).toFixed(6))
      : null;
  }
  return Number(pricePerTonneToPerKilogram(rate).toFixed(6));
}

/**
 * Writes both unit representations during the staged rollout. New tonne values
 * are authoritative; legacy-only edits remain supported by comparing against
 * the saved row before resolving conflicting kg/tonne inputs.
 */
export function normalizeRefuelingAbroadUnitInput(
  input: Record<string, unknown>,
  current?: Record<string, unknown> | null,
): Record<string, unknown> {
  const normalized = { ...input };

  const hasTonnes = hasOwn(input, "quantityTonnes");
  const hasKilograms = hasOwn(input, "quantityKg");
  if (hasTonnes || hasKilograms) {
    const inputTonnes = hasTonnes
      ? finiteOrNull(input, "quantityTonnes")
      : null;
    const inputKilograms = hasKilograms
      ? finiteOrNull(input, "quantityKg")
      : null;
    const savedKilograms = finiteOrNull(current ?? undefined, "quantityKg");
    const savedTonnes =
      finiteOrNull(current ?? undefined, "quantityTonnes") ??
      (savedKilograms === null ? null : kilogramsToTonnes(savedKilograms));

    const tonnesChanged =
      hasTonnes && !valuesEqualAtPrecision(inputTonnes, savedTonnes, 5);
    const kilogramsChanged =
      hasKilograms &&
      !valuesEqualAtPrecision(inputKilograms, savedKilograms, 2);
    const legacyOnlyChanged =
      hasTonnes &&
      hasKilograms &&
      current !== undefined &&
      current !== null &&
      !tonnesChanged &&
      kilogramsChanged;

    if (hasKilograms && (!hasTonnes || legacyOnlyChanged)) {
      normalized.quantityKg = inputKilograms;
      normalized.quantityTonnes =
        inputKilograms === null ? null : kilogramsToTonnes(inputKilograms);
    } else {
      normalized.quantityTonnes = inputTonnes;
      normalized.quantityKg =
        inputTonnes === null
          ? null
          : Number(tonnesToKilograms(inputTonnes).toFixed(2));
    }
  }

  const effectiveInputMode = input.inputMode ?? current?.inputMode ?? "kg";
  const effectiveDensity =
    input.density !== undefined
      ? finiteOrNull(input, "density")
      : finiteOrNull(current ?? undefined, "density");
  const ratePairs = [
    ["purchasePriceUsdPerTonne", "purchasePriceUsd"],
    ["purchasePriceRubPerTonne", "purchasePriceRub"],
    ["salePriceUsdPerTonne", "salePriceUsd"],
    ["salePriceRubPerTonne", "salePriceRub"],
  ] as const;

  for (const [tonneField, legacyField] of ratePairs) {
    const hasTonneRate = hasOwn(input, tonneField);
    const hasLegacyRate = hasOwn(input, legacyField);
    if (!hasTonneRate && !hasLegacyRate) continue;

    const inputTonneRate = hasTonneRate
      ? finiteOrNull(input, tonneField)
      : null;
    const inputLegacyRate = hasLegacyRate
      ? finiteOrNull(input, legacyField)
      : null;
    const savedTonneRate = finiteOrNull(current ?? undefined, tonneField);
    const savedLegacyRate = finiteOrNull(current ?? undefined, legacyField);
    const tonneRateChanged =
      hasTonneRate &&
      !valuesEqualAtPrecision(inputTonneRate, savedTonneRate, 2);
    const legacyRateChanged =
      hasLegacyRate &&
      !valuesEqualAtPrecision(inputLegacyRate, savedLegacyRate, 6);
    const legacyOnlyChanged =
      hasTonneRate &&
      hasLegacyRate &&
      current !== undefined &&
      current !== null &&
      !tonneRateChanged &&
      legacyRateChanged;

    if (hasLegacyRate && (!hasTonneRate || legacyOnlyChanged)) {
      const unchangedLegacy =
        current !== undefined &&
        current !== null &&
        !legacyRateChanged &&
        savedTonneRate !== null &&
        input.inputMode === undefined &&
        input.density === undefined;
      normalized[legacyField] = inputLegacyRate;
      normalized[tonneField] = unchangedLegacy
        ? savedTonneRate
        : inputLegacyRate === null
          ? null
          : legacyRateToPerTonne(
              inputLegacyRate,
              effectiveInputMode,
              effectiveDensity,
              legacyField,
            );
      continue;
    }

    const unchangedAtDisplayPrecision =
      current !== undefined &&
      current !== null &&
      hasTonneRate &&
      !tonneRateChanged &&
      savedTonneRate !== null;
    const resolvedRate = unchangedAtDisplayPrecision
      ? savedTonneRate
      : inputTonneRate;
    normalized[tonneField] = resolvedRate;
    normalized[legacyField] = unchangedAtDisplayPrecision
      ? savedLegacyRate
      : perTonneRateToLegacy(
          resolvedRate,
          effectiveInputMode,
          effectiveDensity,
        );
  }

  return normalized;
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
    quantityTonnes?: unknown;
    quantityLiters?: unknown;
    density?: unknown;
    inputMode?: unknown;
    purchasePriceUsd?: unknown;
    purchasePriceUsdPerTonne?: unknown;
    purchasePriceRub?: unknown;
    purchasePriceRubPerTonne?: unknown;
    salePriceUsd?: unknown;
    salePriceUsdPerTonne?: unknown;
    salePriceRub?: unknown;
    salePriceRubPerTonne?: unknown;
    purchaseAmountUsd?: unknown;
    purchaseAmountRub?: unknown;
    saleAmountUsd?: unknown;
    saleAmountRub?: unknown;
  },
>(deal: T) {
  const {
    quantityKg,
    quantityTonnes: storedQuantityTonnes,
    inputMode: storedInputMode,
    purchasePriceUsd,
    purchasePriceUsdPerTonne: storedPurchasePriceUsdPerTonne,
    purchasePriceRub,
    purchasePriceRubPerTonne: storedPurchasePriceRubPerTonne,
    salePriceUsd,
    salePriceUsdPerTonne: storedSalePriceUsdPerTonne,
    salePriceRub,
    salePriceRubPerTonne: storedSalePriceRubPerTonne,
    ...fields
  } = deal;
  const quantityTonnes =
    optionalNumber(storedQuantityTonnes, "quantityTonnes") ??
    legacyDealMassToTonnes(
      quantityKg as number | string | null | undefined,
      deal.quantityLiters as number | string | null | undefined,
      deal.density as number | string | null | undefined,
    );
  const hasLitres = (optionalNumber(deal.quantityLiters, "quantityLiters") ?? 0) > 0;

  const storedRateOrFallback = (
    storedRate: unknown,
    amount: unknown,
    legacyRate: unknown,
    amountField: string,
    rateField: string,
  ) =>
    optionalNumber(storedRate, `${rateField}PerTonne`) ??
    rateFromStoredAmountOrLegacyRate(
      amount,
      legacyRate,
      quantityTonnes,
      storedInputMode,
      deal.density,
      amountField,
      rateField,
    );

  return {
    ...fields,
    inputMode:
      storedInputMode === "liters" || hasLitres ? "liters" : "tonnes",
    quantityTonnes,
    purchasePriceUsdPerTonne: storedRateOrFallback(
      storedPurchasePriceUsdPerTonne,
      deal.purchaseAmountUsd,
      purchasePriceUsd,
      "purchaseAmountUsd",
      "purchasePriceUsd",
    ),
    purchasePriceRubPerTonne: storedRateOrFallback(
      storedPurchasePriceRubPerTonne,
      deal.purchaseAmountRub,
      purchasePriceRub,
      "purchaseAmountRub",
      "purchasePriceRub",
    ),
    salePriceUsdPerTonne: storedRateOrFallback(
      storedSalePriceUsdPerTonne,
      deal.saleAmountUsd,
      salePriceUsd,
      "saleAmountUsd",
      "salePriceUsd",
    ),
    salePriceRubPerTonne: storedRateOrFallback(
      storedSalePriceRubPerTonne,
      deal.saleAmountRub,
      salePriceRub,
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
  return Object.prototype.hasOwnProperty.call(record, "quantityKg") ||
    Object.prototype.hasOwnProperty.call(record, "quantityTonnes")
    ? refuelingAbroadDealToApi(result as any)
    : result;
}
