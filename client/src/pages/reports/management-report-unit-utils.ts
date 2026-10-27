import { formatTonnes, kilogramsToTonnes } from "@shared/units";

export function getManagementReportMassTonnes(
  tonnesValue: string | number | null | undefined,
  legacyKilogramsValue: string | number | null | undefined,
): number {
  if (tonnesValue !== null && tonnesValue !== undefined) {
    const tonnes = Number(tonnesValue);
    if (!Number.isFinite(tonnes)) {
      throw new TypeError("Management report tonnes must be a finite number");
    }
    return tonnes;
  }

  return kilogramsToTonnes(Number(legacyKilogramsValue ?? 0));
}

export function formatManagementReportMassTonnes(
  tonnesValue: string | number | null | undefined,
  legacyKilogramsValue: string | number | null | undefined,
): string {
  return formatTonnes(
    getManagementReportMassTonnes(tonnesValue, legacyKilogramsValue),
  );
}
