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

type StoredPriceShape = {
  priceUnit?: string | null;
  volumeUnit?: string | null;
  priceValues?: string[] | null;
  volume?: string | number | null;
  soldVolume?: string | number | null;
  needsRecalculation?: boolean | null;
  oldPriceValues?: string[] | null;
};

function numericOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizePriceValuesForStorage(
  values: unknown,
): string[] | undefined {
  if (values === undefined || values === null) return undefined;
  if (!Array.isArray(values)) {
    throw new z.ZodError([{
      code: z.ZodIssueCode.custom,
      path: ["priceValues"],
      message: "Ставки цены должны быть списком",
    }]);
  }

  return values.map((value, index) => {
    let candidate = value;
    if (typeof value === "string") {
      try {
        candidate = JSON.parse(value);
      } catch {
        candidate = null;
      }
    }
    const price = candidate && typeof candidate === "object" && !Array.isArray(candidate)
      ? numericOrNull((candidate as Record<string, unknown>).price)
      : null;
    if (price === null) {
      throw new z.ZodError([{
        code: z.ZodIssueCode.custom,
        path: ["priceValues", index, "price"],
        message: "Укажите корректную ставку цены",
      }]);
    }
    return JSON.stringify({ price });
  });
}

function normalizeVolumeUnit(value: unknown): "tonne" {
  const unit = value ?? "tonne";
  if (unit === "tonne") return unit;
  throw new TypeError(`Неизвестная единица массы лимита цены: ${unit}`);
}

export function normalizePriceStoredVolume(
  tonnes: number,
  volumeUnit: unknown,
): number {
  if (!Number.isFinite(tonnes)) {
    throw new TypeError("Некорректный тоннаж использованного объёма");
  }
  normalizeVolumeUnit(volumeUnit);
  return Number(tonnes.toFixed(5));
}

function storedRateOrNull(value: string): number | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === "number") return numericOrNull(parsed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return numericOrNull((parsed as { price?: unknown }).price);
  } catch {
    return null;
  }
}

export function priceToApi<T extends StoredPriceShape>(price: T) {
  const {
    needsRecalculation: _needsRecalculation,
    oldPriceValues: _oldPriceValues,
    ...priceForApi
  } = price;
  const storedUnit = price.priceUnit ?? "tonne";
  if (!["tonne", "liter"].includes(storedUnit)) {
    throw new TypeError(`Неизвестная сохранённая единица цены: ${storedUnit}`);
  }
  const unit = storedUnit;
  normalizeVolumeUnit(price.volumeUnit);
  const rates = (price.priceValues ?? []).map((value) => {
    return storedRateOrNull(value);
  });
  const volumeLimit = numericOrNull(price.volume);
  const volumeUsed = numericOrNull(price.soldVolume);

  return {
    ...priceForApi,
    priceUnit: unit,
    volumeUnit: "tonne",
    priceRate: { unit, values: rates },
    contractVolume: {
      limitUnit: "tonne",
      limit: volumeLimit,
      usedUnit: "tonne",
      used: volumeUsed,
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
    return priceToApi(record as StoredPriceShape);
  }

  const adapted = { ...record };
  for (const key of ["data", "prices", "items"] as const) {
    if (Array.isArray(record[key])) {
      adapted[key] = priceResponseToApi(record[key]);
    }
  }
  return adapted;
}

export function priceUnitFilterToStorage(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === "tonne") return ["tonne"];
  if (value === "liter") return ["liter"];
  throw new TypeError("Неизвестная единица цены");
}

export function priceSelectionVolumeToApi(totalVolumeTonnes: number): {
  value: string;
  unit: "tonne";
} {
  if (!Number.isFinite(totalVolumeTonnes) || totalVolumeTonnes < 0) {
    throw new TypeError("Некорректный тоннаж выборки");
  }

  return {
    value: totalVolumeTonnes.toFixed(5),
    unit: "tonne",
  };
}

export function priceWriteFromApi<T extends Record<string, unknown>>(
  input: T,
): T {
  const hasRate = Object.prototype.hasOwnProperty.call(input, "priceRate");
  const hasContractVolume = Object.prototype.hasOwnProperty.call(
    input,
    "contractVolume",
  );
  const {
    volumeUnit: _untrustedVolumeUnit,
    soldVolume: _computedSoldVolume,
    ...safeInput
  } = input;
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
  const {
    priceRate: _priceRate,
    contractVolume: _contractVolume,
    volume: _legacyVolume,
    ...legacy
  } = safeInput;
  return {
    ...legacy,
    priceUnit: rate.unit,
    volumeUnit: "tonne",
    priceValues: rate.values.map((price) => JSON.stringify({ price })),
    ...(volume
      ? {
          volume: volume.limit === null ? null : volume.limit.toFixed(5),
        }
      : {}),
  } as unknown as T;
}
