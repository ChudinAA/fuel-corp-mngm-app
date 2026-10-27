import { kilogramsToTonnes, tonnesToKilograms } from "@shared/units";

export interface PlanningBalanceEntryInput {
  id: string;
  type: string;
  volume: string | number;
  balanceAfter: string | number | null;
  isManualBalance: boolean | null;
}

export interface PlanningBalanceEntryResult {
  id: string;
  balanceAfterKg: string;
  shouldPersist: boolean;
}

function finiteNumber(
  value: string | number | null | undefined,
  label: string,
  defaultValue?: number,
): number {
  if (value === null || value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing planning ${label}`);
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid planning ${label}`);
  }
  return parsed;
}

export function legacyKilogramsToTonnes(
  value: string | number | null | undefined,
  label = "mass",
  defaultValue?: number,
): number {
  return kilogramsToTonnes(finiteNumber(value, label, defaultValue));
}

export function tonnesToLegacyKilograms(tonnes: number): string {
  return tonnesToKilograms(finiteNumber(tonnes, "tonnes")).toFixed(2);
}

export function calculateWarehouseSummaryTonnes(
  plannedIncomeTonnes: number,
  plannedExpenseTonnes: number,
  balancePlanKg: string | number,
  balanceFactKg: string | number,
) {
  return {
    plannedIncomeTonnes: finiteNumber(plannedIncomeTonnes, "planned income tonnes"),
    plannedExpenseTonnes: finiteNumber(plannedExpenseTonnes, "planned expense tonnes"),
    balancePlanTonnes: legacyKilogramsToTonnes(
      balancePlanKg,
      "planned warehouse balance",
    ),
    balanceFactTonnes: legacyKilogramsToTonnes(
      balanceFactKg,
      "actual warehouse balance",
    ),
  };
}

/**
 * Recalculate the planning balance chain in tonnes while keeping the existing
 * kg-based database contract at the persistence boundary.
 */
export function calculatePlanningBalanceChainInTonnes(
  actualBalanceKg: string | number | null | undefined,
  entries: readonly PlanningBalanceEntryInput[],
): PlanningBalanceEntryResult[] {
  const actualBalanceTonnes = legacyKilogramsToTonnes(
    actualBalanceKg,
    "actual balance",
    0,
  );
  let runningBalanceTonnes: number | null = null;

  return entries.map((entry) => {
    const hasManualBalance =
      entry.isManualBalance && entry.balanceAfter !== null;
    let balanceTonnes: number;
    let shouldPersist = false;

    if (hasManualBalance) {
      balanceTonnes = legacyKilogramsToTonnes(
        entry.balanceAfter,
        "manual balance",
      );
    } else {
      const base =
        runningBalanceTonnes === null
          ? actualBalanceTonnes
          : runningBalanceTonnes;
      const volumeTonnes = legacyKilogramsToTonnes(
        entry.volume,
        "entry volume",
      );
      balanceTonnes =
        entry.type === "income" ? base + volumeTonnes : base - volumeTonnes;
      shouldPersist = true;
    }

    const balanceAfterKg = tonnesToLegacyKilograms(balanceTonnes);
    runningBalanceTonnes = balanceTonnes;
    return { id: entry.id, balanceAfterKg, shouldPersist };
  });
}
