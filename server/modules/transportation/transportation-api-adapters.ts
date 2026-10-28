import {
  kilogramsToTonnes,
  pricePerKilogramToPerTonne,
  pricePerLitreToPerTonne,
  pricePerTonneToPerKilogram,
  tonnesToKilograms,
} from "@shared/units";

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

function toLegacyPerUnitRate(
  pricePerTonne: unknown,
  input: Record<string, unknown>,
): number | null {
  if (pricePerTonne === null || pricePerTonne === undefined) return null;
  const rate = toFiniteNumber(pricePerTonne);
  if (rate === null) {
    throw new TransportationApiInputError("Некорректная цена за тонну");
  }
  if (rate < 0) throw new TransportationApiInputError("Цена не может быть отрицательной");

  if (input.inputMode === "liters") {
    const density = toFiniteNumber(input.density);
    if (density === null || density <= 0) {
      throw new TransportationApiInputError(
        "Для цены за тонну при вводе в литрах укажите положительную плотность",
      );
    }
    return Number(((rate * density) / 1_000).toFixed(6));
  }

  return Number(pricePerTonneToPerKilogram(rate).toFixed(6));
}

function legacyRateToPerTonne(
  legacyRate: unknown,
  input: Record<string, unknown>,
): number | null {
  const rate = toFiniteNumber(legacyRate);
  if (rate === null) return null;
  if (
    input.inputMode === "liters" ||
    (input.inputMode === null || input.inputMode === undefined) &&
      toFiniteNumber(input.quantityLiters) !== null &&
      toFiniteNumber(input.quantityLiters)! > 0
  ) {
    const density = toFiniteNumber(input.density);
    return density !== null && density > 0
      ? pricePerLitreToPerTonne(rate, density)
      : null;
  }
  return pricePerKilogramToPerTonne(rate);
}

export function normalizeTransportationInput(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...input };

  if (Object.prototype.hasOwnProperty.call(input, "quantityTonnes")) {
    const tonnes = toFiniteNumber(input.quantityTonnes);
    if (input.quantityTonnes !== null && tonnes === null) {
      throw new TransportationApiInputError("Некорректная масса в тоннах");
    }
    if (tonnes !== null && tonnes < 0) {
      throw new TransportationApiInputError("Масса не может быть отрицательной");
    }
    normalized.quantityTonnes =
      tonnes === null ? null : Number(tonnes.toFixed(5));
    normalized.quantityKg =
      tonnes === null ? null : Number(tonnesToKilograms(tonnes).toFixed(2));
  } else if (Object.prototype.hasOwnProperty.call(input, "quantityKg")) {
    const kilograms = toFiniteNumber(input.quantityKg);
    if (input.quantityKg !== null && kilograms === null) {
      throw new TransportationApiInputError("Некорректная масса в килограммах");
    }
    if (kilograms !== null && kilograms < 0) {
      throw new TransportationApiInputError("Масса не может быть отрицательной");
    }
    normalized.quantityTonnes =
      kilograms === null ? null : Number(kilogramsToTonnes(kilograms).toFixed(5));
  }

  for (const [apiField, legacyField] of [
    ["purchasePricePerTonne", "purchasePrice"],
    ["salePricePerTonne", "salePrice"],
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(input, apiField)) {
      const rate = toFiniteNumber(input[apiField]);
      if (input[apiField] !== null && rate === null) {
        throw new TransportationApiInputError("Некорректная цена за тонну");
      }
      if (rate !== null && rate < 0) {
        throw new TransportationApiInputError("Цена не может быть отрицательной");
      }
      normalized[apiField] = rate === null ? null : Number(rate.toFixed(6));
      normalized[legacyField] =
        rate === null ? null : toLegacyPerUnitRate(rate, input);
    } else if (Object.prototype.hasOwnProperty.call(input, legacyField)) {
      const rate = toFiniteNumber(input[legacyField]);
      if (input[legacyField] !== null && rate === null) {
        throw new TransportationApiInputError("Некорректная ставка");
      }
      if (rate !== null && rate < 0) {
        throw new TransportationApiInputError("Цена не может быть отрицательной");
      }
      const convertedRate = rate === null ? null : legacyRateToPerTonne(rate, input);
      if (rate !== null && convertedRate === null) {
        throw new TransportationApiInputError(
          "Для цены за литр укажите положительную плотность",
        );
      }
      normalized[apiField] =
        convertedRate === null ? null : Number(convertedRate.toFixed(6));
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(input, "deliveryTariffPerTonne")
  ) {
    const rate = toFiniteNumber(input.deliveryTariffPerTonne);
    if (input.deliveryTariffPerTonne !== null && rate === null) {
      throw new TransportationApiInputError("Некорректный тариф за тонну");
    }
    if (rate !== null && rate < 0) {
      throw new TransportationApiInputError("Тариф не может быть отрицательным");
    }
    normalized.deliveryTariffPerTonne =
      rate === null ? null : Number(rate.toFixed(6));
    normalized.deliveryTariff =
      rate === null ? null : Number(pricePerTonneToPerKilogram(rate).toFixed(6));
  } else if (Object.prototype.hasOwnProperty.call(input, "deliveryTariff")) {
    const rate = toFiniteNumber(input.deliveryTariff);
    if (input.deliveryTariff !== null && rate === null) {
      throw new TransportationApiInputError("Некорректный тариф за килограмм");
    }
    if (rate !== null && rate < 0) {
      throw new TransportationApiInputError("Тариф не может быть отрицательным");
    }
    normalized.deliveryTariffPerTonne =
      rate === null ? null : Number(pricePerKilogramToPerTonne(rate).toFixed(6));
  }

  return normalized;
}

export function transportationDealToApi<T extends Record<string, any>>(
  deal: T,
): Omit<T, "quantityKg" | "purchasePrice" | "salePrice" | "deliveryTariff"> & {
  quantityTonnes: number | null;
  purchasePricePerTonne: number | null;
  salePricePerTonne: number | null;
  deliveryTariffPerTonne: number | null;
} {
  const {
    quantityKg,
    purchasePrice,
    salePrice,
    deliveryTariff,
    ...rest
  } = deal;
  const quantityLiters = toFiniteNumber(deal.quantityLiters);
  const density = toFiniteNumber(deal.density);
  const storedKilograms = toFiniteNumber(quantityKg);
  const quantityTonnes =
    toFiniteNumber(deal.quantityTonnes) ??
    (storedKilograms === null
      ? null
      : kilogramsToTonnes(storedKilograms));

  const ratePerTonne = (
    legacyRate: unknown,
    savedTonneRate: unknown,
  ): number | null => {
    const savedRate = toFiniteNumber(savedTonneRate);
    if (savedRate !== null) return savedRate;
    const rate = toFiniteNumber(legacyRate);
    return rate === null
      ? null
      : legacyRateToPerTonne(rate, {
          inputMode: deal.inputMode,
          quantityLiters,
          density,
        });
  };

  const deliveryRate =
    toFiniteNumber(deal.deliveryTariffPerTonne) ??
    (toFiniteNumber(deliveryTariff) === null
      ? null
      : pricePerKilogramToPerTonne(toFiniteNumber(deliveryTariff)!));

  return {
    ...rest,
    quantityTonnes,
    purchasePricePerTonne: ratePerTonne(
      purchasePrice,
      deal.purchasePricePerTonne,
    ),
    salePricePerTonne: ratePerTonne(salePrice, deal.salePricePerTonne),
    deliveryTariffPerTonne: deliveryRate,
  } as Omit<
    T,
    "quantityKg" | "purchasePrice" | "salePrice" | "deliveryTariff"
  > & {
    quantityTonnes: number | null;
    purchasePricePerTonne: number | null;
    salePricePerTonne: number | null;
    deliveryTariffPerTonne: number | null;
  };
}

export function transportationResultToApi(result: unknown): unknown {
  if (Array.isArray(result)) {
    return result.map((item) =>
      item && typeof item === "object"
        ? transportationDealToApi(item as Record<string, any>)
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
          ? transportationDealToApi(item as Record<string, any>)
          : item,
      ),
    };
  }
  if (
    Object.prototype.hasOwnProperty.call(value, "quantityKg") ||
    Object.prototype.hasOwnProperty.call(value, "quantityTonnes")
  ) {
    return transportationDealToApi(value);
  }
  return result;
}
