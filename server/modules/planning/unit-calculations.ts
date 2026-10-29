export interface PlanningBalanceEntryInput {
  id: string;
  type: string;
  volumeTonnes: string | number | null;
  balanceAfterTonnes: string | number | null;
  isManualBalance: boolean | null;
}

export interface PlanningBalanceEntryResult {
  id: string;
  balanceAfterTonnes: string;
  shouldPersist: boolean;
}

export interface PlanningVolumeInput {
  volumeTonnes?: string | number | null;
}

export interface PlanningBalanceInput {
  balanceAfterTonnes?: string | number | null;
}

function finiteNumber(
  value: string | number | null | undefined,
  label: string,
  defaultValue?: number,
): number {
  if (value === null || value === undefined || value === "") {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing planning ${label}`);
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid planning ${label}`);
  }
  return parsed;
}

function optionalNumber(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid planning mass value");
  }
  return parsed;
}

export function normalizePlanningVolumeFields(
  input: PlanningVolumeInput,
): { volumeTonnes: string } | undefined {
  if (input.volumeTonnes === undefined) return undefined;
  if (input.volumeTonnes === null) {
    throw new Error("Planning volume is required in tonnes");
  }
  return {
    volumeTonnes: finiteNumber(input.volumeTonnes, "volume").toFixed(5),
  };
}

export function normalizePlanningBalanceFields(
  input: PlanningBalanceInput,
): { balanceAfterTonnes: string | null } | undefined {
  if (input.balanceAfterTonnes === undefined) return undefined;
  if (input.balanceAfterTonnes === null) {
    return { balanceAfterTonnes: null };
  }
  return {
    balanceAfterTonnes: finiteNumber(
      input.balanceAfterTonnes,
      "balance",
    ).toFixed(5),
  };
}

export function planningVolumeTonnes(
  row: PlanningVolumeInput,
  label = "volume",
): number {
  return finiteNumber(row.volumeTonnes, label);
}

export function calculateWarehouseSummaryTonnes(
  plannedIncomeTonnes: number,
  plannedExpenseTonnes: number,
  balancePlanTonnes: string | number,
  balanceFactTonnes: string | number,
) {
  return {
    plannedIncomeTonnes: finiteNumber(
      plannedIncomeTonnes,
      "planned income tonnes",
    ),
    plannedExpenseTonnes: finiteNumber(
      plannedExpenseTonnes,
      "planned expense tonnes",
    ),
    balancePlanTonnes: finiteNumber(
      balancePlanTonnes,
      "planned warehouse balance",
    ),
    balanceFactTonnes: finiteNumber(
      balanceFactTonnes,
      "actual warehouse balance",
    ),
  };
}

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
    const manualBalanceTonnes = optionalNumber(entry.balanceAfterTonnes);
    const hasManualBalance =
      entry.isManualBalance && manualBalanceTonnes !== null;
    let balanceTonnes: number;
    let shouldPersist = false;

    if (hasManualBalance) {
      balanceTonnes = finiteNumber(manualBalanceTonnes, "manual balance");
    } else {
      const base = runningBalanceTonnes ?? initialBalanceTonnes;
      const volumeTonnes = planningVolumeTonnes(entry, "entry volume");
      balanceTonnes =
        entry.type === "income" ? base + volumeTonnes : base - volumeTonnes;
      shouldPersist = true;
    }

    runningBalanceTonnes = balanceTonnes;
    return {
      id: entry.id,
      balanceAfterTonnes: balanceTonnes.toFixed(5),
      shouldPersist,
    };
  });
}
