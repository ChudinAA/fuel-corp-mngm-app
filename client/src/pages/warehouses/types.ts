import type { Warehouse } from "@shared/schema";

export type WarehouseWithTonnes = Warehouse & {
  currentBalanceTonnes?: string | null;
  pvkjBalanceTonnes?: string | null;
  averageCostPerTonne?: string | null;
  pvkjAverageCostPerTonne?: string | null;
};

export interface WarehouseTransaction {
  id: string;
  warehouseId: string;
  transactionType: string;
  sourceType?: string;
  productType?: string;
  quantityKg: string;
  quantityTonnes?: string;
  balanceBefore: string;
  balanceAfter: string;
  balanceBeforeTonnes?: string;
  balanceAfterTonnes?: string;
  averageCostBefore: string;
  averageCostAfter: string;
  averageCostBeforePerTonne?: string;
  averageCostAfterPerTonne?: string;
  sum?: string;
  price?: string;
  pricePerTonne?: string;
  transactionDate?: string;
  createdAt: string;
}

export interface WarehouseServiceEntry {
  serviceName: string;
  serviceType: string;
  serviceValue: string;
}

export interface NewWarehouseFormValues {
  name: string;
  bases: { baseId: string }[];
  storageCost: string;
  supplierLinkMode: "none" | "existing" | "create";
  linkedSupplierId?: string;
  newSupplierName?: string;
  newSupplierFullName?: string;
  newSupplierInn?: string;
  isBase: boolean;
  isExport: boolean;
  services: WarehouseServiceEntry[];
}
