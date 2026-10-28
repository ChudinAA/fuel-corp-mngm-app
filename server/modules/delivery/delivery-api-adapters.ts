import {
  pricePerKilogramToPerTonne,
  pricePerTonneToPerKilogram,
} from "@shared/units";

export class DeliveryApiInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeliveryApiInputError";
  }
}

function parseRate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toLegacyDeliveryCostInput(
  input: Record<string, unknown>,
  current?: {
    costPerKg?: string | number | null;
    costPerTonne?: string | number | null;
  } | null,
): Record<string, unknown> {
  const legacy: Record<string, unknown> = { ...input };
  const hasTonneRate = Object.prototype.hasOwnProperty.call(input, "costPerTonne");
  const hasKilogramRate = Object.prototype.hasOwnProperty.call(input, "costPerKg");
  const currentKilogramRate = parseRate(current?.costPerKg);
  const currentTonneRate =
    parseRate(current?.costPerTonne) ??
    (currentKilogramRate === null
      ? null
      : pricePerKilogramToPerTonne(currentKilogramRate));

  if (hasTonneRate) {
    const rate = parseRate(input.costPerTonne);
    if (rate === null) {
      if (input.costPerTonne === "" || input.costPerTonne === undefined) {
        legacy.costPerKg = undefined;
        legacy.costPerTonne = undefined;
      } else {
        throw new DeliveryApiInputError("Некорректная ставка за тонну");
      }
    } else if (rate < 0) {
      throw new DeliveryApiInputError("Ставка не может быть отрицательной");
    } else {
      const submittedKilogramRate = hasKilogramRate
        ? parseRate(input.costPerKg)
        : null;
      if (hasKilogramRate && submittedKilogramRate === null) {
        throw new DeliveryApiInputError("Некорректная ставка за килограмм");
      }
      const kilogramRateChanged =
        hasKilogramRate &&
        currentKilogramRate !== null &&
        submittedKilogramRate !== currentKilogramRate;
      const unchangedAtDisplayPrecision =
        currentTonneRate !== null &&
        Number(rate.toFixed(2)) ===
          Number(currentTonneRate.toFixed(2));
      const useChangedKilogramValue =
        kilogramRateChanged && unchangedAtDisplayPrecision;
      const effectiveTonneRate = useChangedKilogramValue
        ? pricePerKilogramToPerTonne(submittedKilogramRate!)
        : unchangedAtDisplayPrecision
          ? currentTonneRate
          : rate;

      legacy.costPerTonne =
        unchangedAtDisplayPrecision && !useChangedKilogramValue && current?.costPerTonne != null
          ? String(current.costPerTonne)
          : String(effectiveTonneRate);
      legacy.costPerKg =
        unchangedAtDisplayPrecision && !useChangedKilogramValue && current?.costPerKg != null
          ? String(current.costPerKg)
          : pricePerTonneToPerKilogram(effectiveTonneRate).toFixed(6);
    }
  } else if (hasKilogramRate) {
    const rate = parseRate(input.costPerKg);
    if (rate === null) {
      if (input.costPerKg === "" || input.costPerKg === undefined || input.costPerKg === null) {
        legacy.costPerTonne = undefined;
      } else {
        throw new DeliveryApiInputError("Некорректная ставка за килограмм");
      }
    } else if (rate < 0) {
      throw new DeliveryApiInputError("Ставка не может быть отрицательной");
    } else {
      legacy.costPerKg = String(input.costPerKg);
      legacy.costPerTonne = String(pricePerKilogramToPerTonne(rate));
    }
  }

  return legacy;
}

export function deliveryCostToApi<T extends Record<string, any>>(
  cost: T,
): Omit<T, "costPerKg"> & { costPerTonne: number | null } {
  const { costPerKg, costPerTonne, ...rest } = cost;
  const rate =
    parseRate(costPerTonne) ??
    (() => {
      const legacyRate = parseRate(costPerKg);
      return legacyRate === null ? null : pricePerKilogramToPerTonne(legacyRate);
    })();
  return {
    ...rest,
    costPerTonne: rate,
  } as Omit<T, "costPerKg"> & { costPerTonne: number | null };
}

export function deliveryCostsToApi(result: unknown): unknown {
  return Array.isArray(result)
    ? result.map((item) =>
        item && typeof item === "object"
          ? deliveryCostToApi(item as Record<string, any>)
          : item,
      )
    : result && typeof result === "object"
      ? deliveryCostToApi(result as Record<string, any>)
      : result;
}
