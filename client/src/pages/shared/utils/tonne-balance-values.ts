type NumericValue = string | number | null | undefined;

interface TonneBalanceValues {
  balanceTonnes?: NumericValue;
  averageCostPerTonne?: NumericValue;
}

function snapshotValues(snapshot: unknown): TonneBalanceValues | null {
  return snapshot !== null && typeof snapshot === "object"
    ? (snapshot as TonneBalanceValues)
    : null;
}

function finiteNumber(value: NumericValue): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function readBalanceTonnes(snapshot: unknown): number | null {
  return finiteNumber(snapshotValues(snapshot)?.balanceTonnes);
}

export function readAverageCostPerTonne(snapshot: unknown): number | null {
  return finiteNumber(snapshotValues(snapshot)?.averageCostPerTonne);
}
