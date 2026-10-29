import { formatTonnes } from "@shared/units";

export function getManagementReportMassTonnes(
  tonnesValue: string | number | null | undefined,
): number {
  const tonnes = Number(tonnesValue ?? 0);
  if (!Number.isFinite(tonnes)) {
    throw new TypeError("Management report tonnes must be a finite number");
  }
  return tonnes;
}

export function formatManagementReportMassTonnes(
  tonnesValue: string | number | null | undefined,
): string {
  return formatTonnes(getManagementReportMassTonnes(tonnesValue));
}
