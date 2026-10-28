import { kilogramsToTonnes, tonnesToKilograms } from "@shared/units";

type LimitValue = string | number | null;

export interface WarehouseLimitInput {
  limitVolume?: LimitValue;
  limitVolumeTonnes?: LimitValue;
}

export interface NormalizedWarehouseLimit {
  limitVolume?: string | null;
  limitVolumeTonnes?: string | null;
}

function parseNonNegativeDecimal(
  value: LimitValue,
  scale: number,
  fieldName: string,
): number | null {
  if (value === null || value === "") return null;
  const raw = String(value).trim();
  const match = /^\d+(?:\.(\d+))?$/.exec(raw);
  if (!match || (match[1]?.length ?? 0) > scale) {
    throw new TypeError(
      `${fieldName} must be a non-negative decimal with at most ${scale} places`,
    );
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`${fieldName} must be finite`);
  }
  return parsed;
}

/**
 * New clients submit the monthly limit in tonnes. The legacy kg field stays
 * synchronized during rollout; old clients that submit only kg remain valid.
 */
export function normalizeWarehouseLimit(
  input: WarehouseLimitInput,
): NormalizedWarehouseLimit {
  if (input.limitVolumeTonnes !== undefined) {
    const tonnes = parseNonNegativeDecimal(
      input.limitVolumeTonnes,
      5,
      "limitVolumeTonnes",
    );
    return {
      limitVolumeTonnes: tonnes === null ? null : tonnes.toFixed(5),
      limitVolume:
        tonnes === null ? null : tonnesToKilograms(tonnes).toFixed(2),
    };
  }

  if (input.limitVolume !== undefined) {
    const kilograms = parseNonNegativeDecimal(
      input.limitVolume,
      2,
      "limitVolume",
    );
    return {
      limitVolume: kilograms === null ? null : kilograms.toFixed(2),
      limitVolumeTonnes:
        kilograms === null ? null : kilogramsToTonnes(kilograms).toFixed(5),
    };
  }

  return {};
}
