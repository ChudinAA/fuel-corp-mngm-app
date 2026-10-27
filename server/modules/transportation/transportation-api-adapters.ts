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

export function toLegacyTransportationInput(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const legacy: Record<string, unknown> = { ...input };

  if (Object.prototype.hasOwnProperty.call(input, "quantityTonnes")) {
    const tonnes = toFiniteNumber(input.quantityTonnes);
    if (input.quantityTonnes !== null && tonnes === null) {
      throw new TransportationApiInputError("Некорректная масса в тоннах");
    }
    if (tonnes !== null && tonnes < 0) {
      throw new TransportationApiInputError("Масса не может быть отрицательной");
    }
    legacy.quantityKg =
      tonnes === null ? null : Number(tonnesToKilograms(tonnes).toFixed(2));
  }

  for (const [apiField, legacyField] of [
    ["purchasePricePerTonne", "purchasePrice"],
    ["salePricePerTonne", "salePrice"],
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(input, apiField)) {
      legacy[legacyField] =
        input[apiField] === null
          ? null
          : toLegacyPerUnitRate(input[apiField], input);
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
    legacy.deliveryTariff =
      rate === null ? null : Number(pricePerTonneToPerKilogram(rate).toFixed(6));
  }

  delete legacy.quantityTonnes;
  delete legacy.purchasePricePerTonne;
  delete legacy.salePricePerTonne;
  delete legacy.deliveryTariffPerTonne;
  return legacy;
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
  const massFromLiters =
    quantityLiters !== null &&
    quantityLiters > 0 &&
    density !== null &&
    density > 0
      ? kilogramsToTonnes(quantityLiters * density)
      : null;
  const legacyTonnes =
    massFromLiters ??
    (toFiniteNumber(quantityKg) === null
      ? null
      : kilogramsToTonnes(toFiniteNumber(quantityKg)!));

  const ratePerTonne = (
    legacyRate: unknown,
    savedAmount: unknown,
  ): number | null => {
    const amount = toFiniteNumber(savedAmount);
    if (legacyTonnes !== null && legacyTonnes > 0 && amount !== null) {
      return amount / legacyTonnes;
    }

    const rate = toFiniteNumber(legacyRate);
    if (rate === null) return null;
    if (
      deal.inputMode === "liters" ||
      (quantityLiters !== null && quantityLiters > 0)
    ) {
      return density !== null && density > 0
        ? pricePerLitreToPerTonne(rate, density)
        : null;
    }
    return pricePerKilogramToPerTonne(rate);
  };

  const deliveryAmount = toFiniteNumber(deal.deliveryCost);
  const deliveryRate =
    legacyTonnes !== null && legacyTonnes > 0 && deliveryAmount !== null
      ? deliveryAmount / legacyTonnes
      : (() => {
          const legacy = toFiniteNumber(deliveryTariff);
          return legacy === null ? null : pricePerKilogramToPerTonne(legacy);
        })();

  return {
    ...rest,
    quantityTonnes: legacyTonnes,
    purchasePricePerTonne: ratePerTonne(purchasePrice, deal.purchaseAmount),
    salePricePerTonne: ratePerTonne(salePrice, deal.saleAmount),
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
