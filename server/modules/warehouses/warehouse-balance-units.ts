import { kilogramsToTonnes, tonnesToKilograms } from "@shared/units";

type BalanceValue = string | number | null;

export interface WarehouseBalanceUnitInput {
  currentBalance?: BalanceValue;
  currentBalanceTonnes?: BalanceValue;
  pvkjBalance?: BalanceValue;
  pvkjBalanceTonnes?: BalanceValue;
}

export interface NormalizedWarehouseBalanceUnits {
  currentBalance?: string | null;
  currentBalanceTonnes?: string | null;
  pvkjBalance?: string | null;
  pvkjBalanceTonnes?: string | null;
}

function parseDecimal(
  value: BalanceValue,
  scale: number,
  fieldName: string,
): number | null {
  if (value === null || value === "") return null;
  const raw = String(value).trim();
  const match = /^-?\d+(?:\.(\d+))?$/.exec(raw);
  if (!match || (match[1]?.length ?? 0) > scale) {
    throw new TypeError(
      `${fieldName} must be a decimal with at most ${scale} places`,
    );
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`${fieldName} must be finite`);
  }
  return parsed;
}

/**
 * Keeps the kg balance fields synchronized while tonnes become authoritative.
 * Signed values are intentionally allowed so this adapter never changes the
 * direction of a historical or corrective stock movement.
 */
export function normalizeWarehouseBalanceUnits(
  input: WarehouseBalanceUnitInput,
): NormalizedWarehouseBalanceUnits {
  const result: NormalizedWarehouseBalanceUnits = {};

  for (const [kgKey, tonnesKey] of [
    ["currentBalance", "currentBalanceTonnes"],
    ["pvkjBalance", "pvkjBalanceTonnes"],
  ] as const) {
    const tonnesValue = input[tonnesKey];
    if (tonnesValue !== undefined) {
      const tonnes = parseDecimal(tonnesValue, 5, tonnesKey);
      result[tonnesKey] = tonnes === null ? null : tonnes.toFixed(5);
      result[kgKey] =
        tonnes === null ? null : tonnesToKilograms(tonnes).toFixed(2);
      continue;
    }

    const kgValue = input[kgKey];
    if (kgValue !== undefined) {
      const kilograms = parseDecimal(kgValue, 2, kgKey);
      result[kgKey] = kilograms === null ? null : kilograms.toFixed(2);
      result[tonnesKey] =
        kilograms === null ? null : kilogramsToTonnes(kilograms).toFixed(5);
    }
  }

  return result;
}
