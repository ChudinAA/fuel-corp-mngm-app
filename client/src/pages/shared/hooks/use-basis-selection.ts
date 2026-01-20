import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { Supplier, Base, Warehouse } from "@shared/schema";
import { BASE_TYPE } from "@shared/constants";

interface UseBasisSelectionProps {
  form: UseFormReturn<any>;
  watchSupplierId: string;
  suppliers: Supplier[] | undefined;
  allBases: Base[] | undefined;
  warehouses: Warehouse[] | undefined;
  editData: any;
  baseType: string; // e.g., BASE_TYPE.WHOLESALE or BASE_TYPE.REFUELING
  setSelectedBasis: (value: string) => void;
  basisFieldName?: string; // "basis" for refueling, but opt uses a separate state
}

export function useBasisSelection({
  form,
  watchSupplierId,
  suppliers,
  allBases,
  warehouses,
  editData,
  baseType,
  setSelectedBasis,
  basisFieldName = "basis",
}: UseBasisSelectionProps) {
  useEffect(() => {
    if (watchSupplierId && suppliers && allBases) {
      const supplier = suppliers.find((s) => s.id === watchSupplierId);
      
      // Auto-set warehouse for warehouse suppliers
      if (supplier?.isWarehouse) {
        const warehouse = warehouses?.find((w) => w.supplierId === supplier.id);
        if (warehouse) {
          form.setValue("warehouseId", warehouse.id);
        }
      } else {
        form.setValue("warehouseId", "");
      }

      // Auto-select first basis ONLY for new deals
      if (!editData && supplier?.baseIds && supplier.baseIds.length > 0) {
        const availableBases = allBases.filter(
          (b) => supplier.baseIds?.includes(b.id) && b.baseType === baseType
        );
        
        if (availableBases.length > 0) {
          const firstBase = availableBases[0];
          setSelectedBasis(firstBase.name);
          // If the form has a basis field (like in Refueling), set it
          if (form.getValues(basisFieldName) !== undefined) {
            form.setValue(basisFieldName, firstBase.name);
          }
        }
      }
    }
  }, [watchSupplierId, suppliers, allBases, warehouses, form, editData, baseType, setSelectedBasis, basisFieldName]);
}
