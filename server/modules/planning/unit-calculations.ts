import { kilogramsToTonnes, tonnesToKilograms } from "@shared/units";

export interface PlanningBalanceEntryInput {
  id: string;
  type: string;
  volume: string | number;
  volumeTonnes?: string | number | null;
  balanceAfter: string | number | null;
  balanceAfterTonnes?: string | number | null;
  isManualBalance: boolean | null;
}

export interface PlanningBalanceEntryResult {
  id: string;
  balanceAfterKg: string;
  balanceAfterTonnes: string;
  shouldPersist: boolean;
}

export interface PlanningVolumeInput {
  volume?: string | number | null;
  volumeTonnes?: string | number | null;
}

export interface PlanningBalanceInput {
  balanceAfter?: string | number | null;
  balanceAfterTonnes?: string | number | null;
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

function optionalNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Invalid planning mass value");
  return parsed;
}

function numbersEqual(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
): boolean {
  const a = optionalNumber(left);
  const b = optionalNumber(right);
  return a === null || b === null ? a === b : Math.abs(a - b) < 1e-10;
}

function resolveTonnes(
  tonnes: string | number | null | undefined,
  kilograms: string | number | null | undefined,
  currentTonnes?: string | number | null,
  currentKilograms?: string | number | null,
): number | null {
  const hasTonnes = tonnes !== undefined;
  const hasKilograms = kilograms !== undefined;
  if (!hasTonnes && !hasKilograms) return null;

  if (hasTonnes && hasKilograms && currentTonnes !== undefined) {
    const tonnesChanged = !numbersEqual(tonnes, currentTonnes);
    const kilogramsChanged = !numbersEqual(kilograms, currentKilograms);
    if (kilogramsChanged && !tonnesChanged) {
      return kilograms === null ? null : legacyKilogramsToTonnes(kilograms);
    }
  }

  if (hasTonnes) return tonnes === null ? null : finiteNumber(tonnes, "tonnes");
  return kilograms === null ? null : legacyKilogramsToTonnes(kilograms);
}

export function normalizePlanningVolumeFields(
  input: PlanningVolumeInput,
  current?: PlanningVolumeInput,
): { volume: string; volumeTonnes: string } | undefined {
  const inputTonnes =
    input.volumeTonnes === null ? undefined : input.volumeTonnes;
  const hasTonnes = inputTonnes !== undefined;
  const hasKilograms = input.volume !== undefined;
  if (!hasTonnes && !hasKilograms) return undefined;

  const tonnes = resolveTonnes(
    inputTonnes,
    input.volume,
    current?.volumeTonnes,
    current?.volume,
  );
  if (tonnes === null) throw new Error("Planning volume is required");
  return {
    volume: tonnesToLegacyKilograms(tonnes),
    volumeTonnes: tonnes.toFixed(5),
  };
}

export function normalizePlanningBalanceFields(
  input: PlanningBalanceInput,
  current?: PlanningBalanceInput,
): { balanceAfter: string | null; balanceAfterTonnes: string | null } | undefined {
  const hasTonnes = input.balanceAfterTonnes !== undefined;
  const hasKilograms = input.balanceAfter !== undefined;
  if (!hasTonnes && !hasKilograms) return undefined;

  const tonnes = resolveTonnes(
    input.balanceAfterTonnes,
    input.balanceAfter,
    current?.balanceAfterTonnes,
    current?.balanceAfter,
  );
  if (tonnes === null) {
    return { balanceAfter: null, balanceAfterTonnes: null };
  }
  return {
    balanceAfter: tonnesToLegacyKilograms(tonnes),
    balanceAfterTonnes: tonnes.toFixed(5),
  };
}

export function planningVolumeTonnes(
  row: PlanningVolumeInput,
  label = "volume",
): number {
  return row.volumeTonnes !== undefined && row.volumeTonnes !== null
    ? finiteNumber(row.volumeTonnes, label)
    : legacyKilogramsToTonnes(row.volume, label);
}

export function calculateWarehouseSummaryTonnes(
  plannedIncomeTonnes: number,
  plannedExpenseTonnes: number,
  balancePlanTonnes: string | number,
  balanceFactTonnes: string | number,
) {
  return {
    plannedIncomeTonnes: finiteNumber(plannedIncomeTonnes, "planned income tonnes"),
    plannedExpenseTonnes: finiteNumber(plannedExpenseTonnes, "planned expense tonnes"),
    balancePlanTonnes: finiteNumber(balancePlanTonnes, "planned warehouse balance"),
    balanceFactTonnes: finiteNumber(
      balanceFactTonnes,
      "actual warehouse balance",
    ),
  };
}

/**
 * Recalculate the planning balance chain from the warehouse's tonne balance.
 */
export function calculatePlanningBalanceChainInTonnes(
  actualBalanceTonnes: string | number | null | undefined,
  entries: readonly PlanningBalanceEntryInput[],
): PlanningBalanceEntryResult[] {
  const initialBalanceTonnes = finiteNumber(
    actualBalanceTonnes,
    "actual balance",
    0,
  );
  let runningBalanceTonnes: number | null = null;

  return entries.map((entry) => {
    const manualBalanceTonnes =
      entry.balanceAfterTonnes ??
      (entry.balanceAfter === null
        ? null
        : legacyKilogramsToTonnes(entry.balanceAfter, "manual balance"));
    const hasManualBalance = entry.isManualBalance && manualBalanceTonnes !== null;
    let balanceTonnes: number;
    let shouldPersist = false;

    if (hasManualBalance) {
      balanceTonnes = finiteNumber(manualBalanceTonnes!, "manual balance");
    } else {
      const base =
        runningBalanceTonnes === null
          ? initialBalanceTonnes
          : runningBalanceTonnes;
      const volumeTonnes = planningVolumeTonnes(entry, "entry volume");
      balanceTonnes =
        entry.type === "income" ? base + volumeTonnes : base - volumeTonnes;
      shouldPersist = true;
    }

    const balanceAfterKg = tonnesToLegacyKilograms(balanceTonnes);
    runningBalanceTonnes = balanceTonnes;
    return {
      id: entry.id,
      balanceAfterKg,
      balanceAfterTonnes: balanceTonnes.toFixed(5),
      shouldPersist,
    };
  });
}
