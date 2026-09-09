/**
 * Normalize a value for consistent comparison and storage
 */
export function normalizeAuditValue(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }

  // Handle dates - normalize to date-only YYYY-MM-DD for consistent comparison.
  // This avoids false positives from timestamps stored with a time part
  // (e.g. DB stores "2026-09-08 14:05:56" while the form sends "2026-09-08").
  if (
    value instanceof Date ||
    (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value))
  ) {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    // Take the first 10 chars (YYYY-MM-DD) regardless of time/timezone suffix
    return (value as string).slice(0, 10);
  }

  // Handle numbers - round to 5 decimal places to eliminate floating-point drift
  // e.g. 79497.60500000001 and 79497.61 should not be treated as different values
  if (typeof value === "number") {
    return parseFloat(value.toFixed(5)).toString();
  }

  // Handle strings that look like numbers with decimals
  if (typeof value === "string" && /^-?\d+\.?\d*$/.test(value)) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return parseFloat(num.toFixed(5)).toString();
    }
  }

  return String(value);
}

/**
 * Normalize entire data object by removing technical fields and normalizing values
 */
export function normalizeAuditData(data: any): any {
  if (!data || typeof data !== "object") return data;

  const normalized = { ...data };

  // Remove technical UI fields that shouldn't be tracked
  const fieldsToRemove = [
    "selectedSalePriceId",
    "selectedPurchasePriceId",
    "createdBy",
    "updatedBy",
    "deletedBy",
    "supplier",
    "buyer",
    "carrier",
    "deliveryLocation",
    "warehouse",
    "base",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "createdById",
    "updatedById",
    "deletedById",
    "fromEquipment",
    "toEquipment",
    "fromWarehouse",
    "toWarehouse",
    "transaction",
    "sourceTransaction",
  ];

  fieldsToRemove.forEach((field) => delete normalized[field]);

  // Normalize all remaining values
  for (const key in normalized) {
    normalized[key] = normalizeAuditValue(normalized[key]);
  }

  return normalized;
}

/**
 * Compare two values and determine if they are actually different
 */
export function areValuesDifferent(oldValue: any, newValue: any): boolean {
  const normalizedOld = normalizeAuditValue(oldValue);
  const normalizedNew = normalizeAuditValue(newValue);
  if (normalizedOld === normalizedNew) return false;
  // Treat null/undefined (→ "") as equivalent to false for boolean fields
  // to prevent false-positive changes like "false → null" or "null → false"
  const absentOrFalse = (v: string) => v === "" || v === "false";
  if (absentOrFalse(normalizedOld) && absentOrFalse(normalizedNew)) return false;
  return true;
}

/**
 * Get changed fields between old and new data
 */
export function getChangedFields(oldData: any, newData: any): string[] {
  const changed: string[] = [];
  const allKeys = new Set([
    ...Object.keys(oldData || {}),
    ...Object.keys(newData || {}),
  ]);
  const keysArray = Array.from(allKeys);

  // Fields that should never be considered as changes
  const ignoredFields = [
    "id",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "createdById",
    "updatedById",
    "deletedById",
    "transactionId",
    "salePriceIndex",
    "purchasePriceIndex",
    "purchasePriceModified",
  ];

  for (const key of keysArray) {
    if (ignoredFields.includes(key)) continue;

    const oldValue = oldData?.[key];
    const newValue = newData?.[key];

    if (areValuesDifferent(oldValue, newValue)) {
      changed.push(key);
    }
  }

  return changed;
}

/**
 * Format value for display in audit panel
 */
export function formatAuditValueForDisplay(value: any): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
}
