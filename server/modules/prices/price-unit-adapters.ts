import {
  kilogramsToTonnes,
  pricePerKilogramToPerTonne,
  pricePerTonneToPerKilogram,
  tonnesToKilograms,
} from "@shared/units";
import { z } from "zod";

const rateInputSchema = z
  .object({
    unit: z.enum(["tonne", "liter"]),
    values: z.array(z.number().finite()).min(1),
  })
  .strict();

const volumeInputSchema = z
  .object({
    limitUnit: z.literal("tonne"),
    limit: z.number().finite().nullable(),
  })
  .strict();

type LegacyPriceShape = {
  priceUnit?: string | null;
  priceValues?: string[] | null;
  volume?: string | number | null;
  soldVolume?: string | number | null;
};

function numericOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function storedRateOrNull(value: string): number | null {
  try {
    const parsed = JSON.parse(value) as { price?: unknown };
    const price = numericOrNull(parsed?.price);
    return price;
  } catch {
    return null;
  }
}

export function priceToApi<T extends LegacyPriceShape>(price: T) {
  const unit = price.priceUnit === "liter" ? "liter" : "tonne";
  const massBased = unit === "tonne";
  const rates = (price.priceValues ?? []).map((value) => {
    const storedRate = storedRateOrNull(value);
    return storedRate === null || !massBased
      ? storedRate
      : pricePerKilogramToPerTonne(storedRate);
  });
  const volumeLimit = numericOrNull(price.volume);
  const volumeUsed = numericOrNull(price.soldVolume);

  return {
    ...price,
    priceRate: { unit, values: rates },
    contractVolume: {
      limitUnit: "tonne",
      limit: volumeLimit === null ? null : kilogramsToTonnes(volumeLimit),
      usedUnit: massBased ? "tonne" : "liter",
      used:
        volumeUsed === null || !massBased
          ? volumeUsed
          : kilogramsToTonnes(volumeUsed),
    },
  };
}

export function priceResponseToApi(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => priceResponseToApi(item));
  }
  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  if ("priceValues" in record || "priceUnit" in record) {
    return priceToApi(record as LegacyPriceShape);
  }

  const adapted = { ...record };
  for (const key of ["data", "prices", "items"] as const) {
    if (Array.isArray(record[key])) {
      adapted[key] = priceResponseToApi(record[key]);
    }
  }
  return adapted;
}

export function priceUnitFilterToStorage(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === "tonne" || value === "kg") return "kg";
  if (value === "liter") return "liter";
  throw new TypeError("Неизвестная единица цены");
}

export function priceWriteFromApi<T extends Record<string, unknown>>(
  input: T,
): T {
  const hasRate = Object.prototype.hasOwnProperty.call(input, "priceRate");
  const hasContractVolume = Object.prototype.hasOwnProperty.call(
    input,
    "contractVolume",
  );
  if (!hasRate && !hasContractVolume) return input;
  if (!hasRate) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["priceRate"],
        message: "Укажите единицу и ставки цены вместе с объёмом договора",
      },
    ]);
  }

  const requiresVolume =
    input.contractLimitEnabled !== false &&
    (input.limitType === undefined || input.limitType === "volume");
  if (requiresVolume && !hasContractVolume) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["contractVolume"],
        message: "Передайте договорный объём с указанием единицы измерения",
      },
    ]);
  }

  const rate = rateInputSchema.parse(input.priceRate);
  const volume = hasContractVolume
    ? volumeInputSchema.parse(input.contractVolume)
    : undefined;
  const { priceRate: _priceRate, contractVolume: _contractVolume, ...legacy } =
    input;
  const massBased = rate.unit === "tonne";
  return {
    ...legacy,
    priceUnit: massBased ? "kg" : "liter",
    priceValues: rate.values.map((price) =>
      JSON.stringify({
        price: massBased ? pricePerTonneToPerKilogram(price) : price,
      }),
    ),
    ...(volume
      ? {
          volume:
            volume.limit === null
              ? null
              : String(
                  Number(tonnesToKilograms(volume.limit).toFixed(2)),
                ),
        }
      : {}),
  } as unknown as T;
}
