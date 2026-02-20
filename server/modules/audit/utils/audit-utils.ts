
/**
 * Normalize a value for consistent comparison and storage
 */
export function normalizeAuditValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  // Handle dates - convert to ISO string without milliseconds
  if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('.')[0].replace('T', ' ');
      }
    } catch {
      // If parsing fails, fall through to string conversion
    }
  }
  
  // Handle numbers - convert to string with consistent decimal places
  if (typeof value === 'number') {
    return value.toString();
  }
  
  // Handle strings that look like numbers with decimals
  if (typeof value === 'string' && /^\d+\.\d+$/.test(value)) {
    return parseFloat(value).toString();
  }
  
  return String(value);
}

/**
 * Normalize entire data object by removing technical fields and normalizing values
 */
export function normalizeAuditData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const normalized = { ...data };
  
  // Remove technical UI fields that shouldn't be tracked
  const fieldsToRemove = [
    'selectedSalePriceId',
    'selectedPurchasePriceId',
    'createdBy',
    'updatedBy',
    'deletedBy',
    'supplier',
    'buyer',
    'carrier',
    'deliveryLocation',
    'warehouse',
    'base',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'createdById',
    'updatedById',
    'deletedById',
    'fromEquipment',
    'toEquipment',
    'fromWarehouse',
    'toWarehouse',
    'transaction',
    'sourceTransaction',
    'fromEquipment',
    'toEquipment'
  ];
  
  fieldsToRemove.forEach(field => delete normalized[field]);
  
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
  return normalizedOld !== normalizedNew;
}

/**
 * Get changed fields between old and new data
 */
export function getChangedFields(oldData: any, newData: any): string[] {
  const changed: string[] = [];
  const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
  const keysArray = Array.from(allKeys);
  
  // Fields that should never be considered as changes
  const ignoredFields = [
    'id',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'createdById',
    'updatedById',
    'deletedById',
    'transactionId',
    'salePriceIndex',
    'purchasePriceIndex',
    'purchasePriceModified'
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
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return String(value);
}
