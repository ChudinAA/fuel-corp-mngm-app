import { formatTonnes } from "@shared/units";

export function fmtTonnes(
  tonnes: string | number | null | undefined,
): string {
  if (tonnes === null || tonnes === undefined || tonnes === "") return "—";
  const val = Number(tonnes);
  if (!Number.isFinite(val)) return "—";
  return `${formatTonnes(val)} т`;
}

// Sum allocated volumes for months overlapping with a period
export function sumAllocatedForPeriod(
  allocations: {
    periodFrom: string;
    periodTo: string;
    volumeTonnes: string;
    supplierId?: string;
  }[],
  periodFrom: Date,
  periodTo: Date,
  supplierId?: string,
): number {
  return allocations
    .filter((a) => {
      if (supplierId && (a.supplierId !== supplierId)) return false;
      const af = new Date(a.periodFrom);
      const at = new Date(a.periodTo);
      return af <= periodTo && at >= periodFrom;
    })
    .reduce((sum, a) => sum + Number(a.volumeTonnes), 0);
}

// Get month start and end from a date string
export function getMonthBounds(dateStr: string): { from: string; to: string } {
  const d = new Date(dateStr + "T00:00:00");
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    from: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-01`,
    to: `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}-${String(to.getDate()).padStart(2, "0")}`,
  };
}
