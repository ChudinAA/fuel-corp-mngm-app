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
  current?: { costPerKg?: string | number | null } | null,
): Record<string, unknown> {
  const legacy: Record<string, unknown> = { ...input };

  if (Object.prototype.hasOwnProperty.call(input, "costPerTonne")) {
    const rate = parseRate(input.costPerTonne);
    if (rate === null) {
      if (input.costPerTonne === "" || input.costPerTonne === undefined) {
        legacy.costPerKg = undefined;
      } else {
        throw new DeliveryApiInputError("Некорректная ставка за тонну");
      }
    } else if (rate < 0) {
      throw new DeliveryApiInputError("Ставка не может быть отрицательной");
    } else {
      const currentRate = parseRate(current?.costPerKg);
      const unchangedAtDisplayPrecision =
        currentRate !== null &&
        Number(rate.toFixed(2)) ===
          Number(pricePerKilogramToPerTonne(currentRate).toFixed(2));
      legacy.costPerKg = unchangedAtDisplayPrecision
        ? String(current!.costPerKg)
        : pricePerTonneToPerKilogram(rate).toFixed(6);
    }
  }

  delete legacy.costPerTonne;
  return legacy;
}

export function deliveryCostToApi<T extends Record<string, any>>(
  cost: T,
): Omit<T, "costPerKg"> & { costPerTonne: number | null } {
  const { costPerKg, ...rest } = cost;
  const rate = parseRate(costPerKg);
  return {
    ...rest,
    costPerTonne:
      rate === null ? null : pricePerKilogramToPerTonne(rate),
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
