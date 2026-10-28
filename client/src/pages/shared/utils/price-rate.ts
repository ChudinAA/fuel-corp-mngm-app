import type { Price } from "@shared/schema";

export type PriceRateUnit = "kg" | "tonne" | "liter";

export interface PriceWithApiRate extends Price {
  priceRate?: {
    unit: "tonne" | "liter";
    values: Array<number | null>;
  };
  contractVolume?: {
    limitUnit: "tonne";
    limit: number | null;
    usedUnit: "tonne" | "liter";
    used: number | null;
  };
}

export interface SelectedPriceRate {
  value: number | null;
  unit: PriceRateUnit;
}

export function warehouseAverageCostRate(
  perTonne: string | number | null | undefined,
  perKilogram: string | number | null | undefined,
): SelectedPriceRate {
  const explicitPerTonne = parseNumericRate(perTonne);
  if (explicitPerTonne !== null) {
    return { value: explicitPerTonne, unit: "tonne" };
  }

  const legacyPerKilogram = parseNumericRate(perKilogram);
  if (legacyPerKilogram !== null) {
    return { value: legacyPerKilogram, unit: "kg" };
  }

  return { value: 0, unit: "tonne" };
}

function parseNumericRate(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function legacyPriceRateUnit(price: Price): PriceRateUnit {
  return price.priceUnit === "liter"
    ? "liter"
    : price.priceUnit === "tonne"
      ? "tonne"
      : "kg";
}

export function getPriceRateOptions(price: Price): SelectedPriceRate[] {
  const apiPrice = price as PriceWithApiRate;
  if (apiPrice.priceRate) {
    return apiPrice.priceRate.values.map((value) => ({
      value: typeof value === "number" && Number.isFinite(value) ? value : null,
      unit: apiPrice.priceRate!.unit,
    }));
  }

  return (price.priceValues ?? []).map((legacyValue) => {
    try {
      const parsed = JSON.parse(legacyValue) as { price?: unknown };
      const numericValue =
        typeof parsed.price === "number" ? parsed.price : Number(parsed.price);
      return {
        value: Number.isFinite(numericValue) ? numericValue : null,
        unit: legacyPriceRateUnit(price),
      };
    } catch {
      return { value: null, unit: legacyPriceRateUnit(price) };
    }
  });
}

export function extractPriceRate(
  prices: Price[],
  selectedId: string,
): SelectedPriceRate {
  const [selectedPrice = prices[0], selectedIndex = 0] = (() => {
    if (!selectedId) return [];
    const parts = selectedId.split("-");
    if (parts.length < 5) return [];
    const priceId = parts.slice(0, -1).join("-");
    const index = Number.parseInt(parts[parts.length - 1], 10);
    const found = prices.find((price) => price.id === priceId);
    return found && Number.isInteger(index) && index >= 0
      ? [found, index] as const
      : [];
  })();

  const price = selectedPrice as PriceWithApiRate | undefined;
  if (!price) return { value: null, unit: "tonne" };

  if (price.priceRate) {
    return (
      getPriceRateOptions(price)[selectedIndex] ?? {
        value: null,
        unit: price.priceRate.unit,
      }
    );
  }

  return (
    getPriceRateOptions(price)[selectedIndex] ?? {
      value: null,
      unit: legacyPriceRateUnit(price),
    }
  );
}
