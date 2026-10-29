import type { Warehouse } from "@shared/schema";

export type WarehouseWithTonnes = Omit<
  Warehouse,
  | "currentBalanceTonnes"
  | "pvkjBalanceTonnes"
  | "averageCostPerTonne"
  | "pvkjAverageCostPerTonne"
  | "limitVolumeTonnes"
> & {
  currentBalanceTonnes: string | null;
  pvkjBalanceTonnes: string | null;
  averageCostPerTonne: string | null;
  pvkjAverageCostPerTonne: string | null;
  limitVolumeTonnes: string | null;
};

export interface WarehouseTransaction {
  id: string;
  warehouseId: string;
  transactionType: string;
  sourceType?: string;
  productType?: string;
  quantityTonnes: string;
  balanceBeforeTonnes: string;
  balanceAfterTonnes: string;
  averageCostBeforePerTonne?: string | null;
  averageCostAfterPerTonne?: string | null;
  sum?: string;
  pricePerTonne?: string | null;
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
