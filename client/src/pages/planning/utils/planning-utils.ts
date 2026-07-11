// Convert kg to tonnes for display
export function kgToTons(kg: string | number | null | undefined): string {
  if (kg === null || kg === undefined || kg === "") return "0";
  const val = parseFloat(String(kg));
  if (isNaN(val)) return "0";
  return (val / 1000).toFixed(3).replace(/\.?0+$/, "") || "0";
}

// Convert tonnes to kg for storage (DB stores kg)
export function tonsToKg(tons: string | number | null | undefined): string {
  if (tons === null || tons === undefined || tons === "") return "0";
  const val = parseFloat(String(tons));
  if (isNaN(val)) return "0";
  return (val * 1000).toFixed(2);
}

// Format tonnes for display with unit
export function fmtTons(kg: string | number | null | undefined): string {
  if (kg === null || kg === undefined || kg === "") return "—";
  const val = parseFloat(String(kg));
  if (isNaN(val)) return "—";
  const t = val / 1000;
  if (t === 0) return "0 т";
  return `${t.toFixed(3).replace(/\.?0+$/, "")} т`;
}

// Sum allocated volumes for months overlapping with a period
export function sumAllocatedForPeriod(
  allocations: { periodFrom: string; periodTo: string; volume: string; supplierId?: string }[],
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
    .reduce((sum, a) => sum + parseFloat(a.volume), 0);
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
