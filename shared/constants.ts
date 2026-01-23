
// Product types used across the application
export const PRODUCT_TYPE = {
  KEROSENE: 'kerosene',
  PVKJ: 'pvkj',
  SERVICE: 'service',
  STORAGE: 'storage',
  AGENT: 'agent',
} as const;

// Transaction types for warehouse operations
export const TRANSACTION_TYPE = {
  SALE: 'sale',
  RECEIPT: 'receipt',
  TRANSFER_IN: 'transfer_in',
  TRANSFER_OUT: 'transfer_out',
} as const;

// Transaction source types for warehouse operations
export const SOURCE_TYPE = {
  MOVEMENT: 'movement',
  OPT: 'opt',
  REFUELING: 'refueling',
} as const;

// Movement types
export const MOVEMENT_TYPE = {
  SUPPLY: 'supply',
  INTERNAL: 'internal',
} as const;

// Entity types for delivery cost
export const DELIVERY_ENTITY_TYPE = {
  BASE: 'base',
  WAREHOUSE: 'warehouse',
  DELIVERY_LOCATION: 'delivery_location',
} as const;

// Counterparty types
export const COUNTERPARTY_TYPE = {
  WHOLESALE: 'wholesale',
  REFUELING: 'refueling',
} as const;

// Counterparty roles
export const COUNTERPARTY_ROLE = {
  SUPPLIER: 'supplier',
  BUYER: 'buyer',
} as const;

// Base types
export const BASE_TYPE = {
  WHOLESALE: 'wholesale',
  REFUELING: 'refueling',
} as const;

// Customer modules
export const CUSTOMER_MODULE = {
  WHOLESALE: 'wholesale',
  REFUELING: 'refueling',
  BOTH: 'both',
} as const;

// Recalculation queue status
export const RECALCULATION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

// Type exports for TypeScript
export type ProductType = typeof PRODUCT_TYPE[keyof typeof PRODUCT_TYPE];
export type TransactionType = typeof TRANSACTION_TYPE[keyof typeof TRANSACTION_TYPE];
export type MovementType = typeof MOVEMENT_TYPE[keyof typeof MOVEMENT_TYPE];
export type DeliveryEntityType = typeof DELIVERY_ENTITY_TYPE[keyof typeof DELIVERY_ENTITY_TYPE];
export type CounterpartyType = typeof COUNTERPARTY_TYPE[keyof typeof COUNTERPARTY_TYPE];
export type CounterpartyRole = typeof COUNTERPARTY_ROLE[keyof typeof COUNTERPARTY_ROLE];
export type BaseType = typeof BASE_TYPE[keyof typeof BASE_TYPE];
export type CustomerModule = typeof CUSTOMER_MODULE[keyof typeof CUSTOMER_MODULE];
export type RecalculationStatus = typeof RECALCULATION_STATUS[keyof typeof RECALCULATION_STATUS];
