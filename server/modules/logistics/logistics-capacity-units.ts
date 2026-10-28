import { kilogramsToTonnes, tonnesToKilograms } from "@shared/units";

type CapacityValue = string | number | null;

export interface LogisticsCapacityInput {
  capacityKg?: CapacityValue;
  capacityTonnes?: CapacityValue;
}

export interface NormalizedLogisticsCapacity {
  capacityKg?: string | null;
  capacityTonnes?: string | null;
}

function parseNonNegativeDecimal(
  value: CapacityValue,
  scale: number,
  fieldName: string,
): number | null {
  if (value === null || value === "") return null;
  const raw = String(value).trim();
  const match = /^\d+(?:\.(\d+))?$/.exec(raw);
  if (!match || (match[1]?.length ?? 0) > scale) {
    throw new TypeError(`${fieldName} must be a non-negative decimal with at most ${scale} places`);
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`${fieldName} must be finite`);
  }
  return parsed;
}

/**
 * Accepts tonne-native values, while keeping the legacy kg column synchronized
 * during the compatibility period. Old API clients that send only kg remain
 * supported and are converted to the authoritative tonne value.
 */
export function normalizeLogisticsCapacity(
  input: LogisticsCapacityInput,
): NormalizedLogisticsCapacity {
  if (input.capacityTonnes !== undefined) {
    const tonnes = parseNonNegativeDecimal(
      input.capacityTonnes,
      5,
      "capacityTonnes",
    );
    return {
      capacityTonnes: tonnes === null ? null : tonnes.toFixed(5),
      capacityKg:
        tonnes === null ? null : tonnesToKilograms(tonnes).toFixed(2),
    };
  }

  if (input.capacityKg !== undefined) {
    const kilograms = parseNonNegativeDecimal(
      input.capacityKg,
      2,
      "capacityKg",
    );
    return {
      capacityKg: kilograms === null ? null : kilograms.toFixed(2),
      capacityTonnes:
        kilograms === null
          ? null
          : kilogramsToTonnes(kilograms).toFixed(5),
    };
  }

  return {};
}
