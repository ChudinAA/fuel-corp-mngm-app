export interface WarehouseTransaction {
  id: string;
  warehouseId: string;
  transactionType: string;
  sourceType?: string;
  productType?: string;
  quantityKg: string;
  balanceBefore: string;
  balanceAfter: string;
  averageCostBefore: string;
  averageCostAfter: string;
  sum?: string;
  price?: string;
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
