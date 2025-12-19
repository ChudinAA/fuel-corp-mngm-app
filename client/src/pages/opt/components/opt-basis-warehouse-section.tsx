
import type { Supplier, Warehouse } from "@shared/schema";

interface OptBasisWarehouseSectionProps {
  isWarehouseSupplier: boolean;
  supplierWarehouse: Warehouse | undefined;
  finalKg: number;
  isEditing: boolean;
  initialWarehouseBalance: number;
}

export function OptBasisWarehouseSection({
  isWarehouseSupplier,
  supplierWarehouse,
  finalKg,
  isEditing,
  initialWarehouseBalance,
}: OptBasisWarehouseSectionProps) {
  return null;
}
