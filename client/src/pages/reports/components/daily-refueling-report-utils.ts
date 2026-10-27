export interface DailyRefuelingSummary {
  totalTonnes: number;
  totalLiters: number;
  totalRevenue: number;
}

function numericValue(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function summarizeDailyRefueling(
  operations: Array<Record<string, unknown>>,
): DailyRefuelingSummary {
  return operations.reduce<DailyRefuelingSummary>(
    (summary, operation) => ({
      totalTonnes: summary.totalTonnes + numericValue(operation.quantityTonnes),
      totalLiters: summary.totalLiters + numericValue(operation.quantityLiters),
      totalRevenue:
        summary.totalRevenue +
        numericValue(operation.saleAmount ?? operation.totalAmount),
    }),
    { totalTonnes: 0, totalLiters: 0, totalRevenue: 0 },
  );
}
