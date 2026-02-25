import { useMemo } from "react";
import type { Supplier, Base, Warehouse } from "@shared/schema";
import { COUNTERPARTY_ROLE, EQUIPMENT_TYPE } from "@shared/constants";
import { usePriceLookup } from "@/pages/shared/hooks/use-price-lookup";

interface UseRefuelingFiltersProps {
  supplierId: string;
  buyerId: string;
  refuelingDate: Date;
  basisId?: string;
  customerBasisId?: string;
  productType: string;
  baseType: string;
  counterpartyType: string;
  suppliers: Supplier[];
  allBases: Base[];
  equipmentType?: string;
  warehouses?: Warehouse[];
}

export function useRefuelingFilters({
  supplierId,
  buyerId,
  refuelingDate,
  basisId,
  customerBasisId,
  productType,
  baseType,
  counterpartyType,
  suppliers,
  allBases,
  equipmentType = EQUIPMENT_TYPE.COMMON,
  warehouses,
}: UseRefuelingFiltersProps) {
  const refuelingSuppliers = useMemo(() => {
    let filteredSuppliers = suppliers || [];

    if (equipmentType === EQUIPMENT_TYPE.LIK) {
      filteredSuppliers = filteredSuppliers.filter((s) => {
        const warehouse = warehouses?.find((w) => w.supplierId === s.id);
        return warehouse?.equipmentType === EQUIPMENT_TYPE.LIK;
      });
    }

    return (
      filteredSuppliers.filter((supplier) => {
        if (!supplier.baseIds || supplier.baseIds.length === 0) return false;
        return allBases?.some(
          (base) =>
            supplier.baseIds?.includes(base.id) && base.baseType === baseType,
        );
      }) || []
    );
  }, [suppliers, allBases, equipmentType, warehouses, baseType]);

  const availableBases = useMemo(() => {
    if (!supplierId || !suppliers || !allBases) return [];

    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier?.baseIds) return [];

    return allBases.filter(
      (b) => b.baseType === baseType && supplier.baseIds?.includes(b.id),
    );
  }, [supplierId, suppliers, allBases]);

  const purchaseLookup = usePriceLookup({
    counterpartyId: supplierId,
    counterpartyRole: COUNTERPARTY_ROLE.SUPPLIER,
    counterpartyType: counterpartyType,
    basisId: basisId,
    productType: productType,
    date: refuelingDate,
    enabled: !!supplierId && !!basisId && !!refuelingDate,
  });

  const saleLookup = usePriceLookup({
    counterpartyId: buyerId,
    counterpartyRole: COUNTERPARTY_ROLE.BUYER,
    counterpartyType: counterpartyType,
    basisId: customerBasisId,
    productType: productType,
    date: refuelingDate,
    enabled: !!buyerId && !!customerBasisId && !!refuelingDate,
  });

  // Фильтрация цен покупки
  const purchasePrices = useMemo(() => {
    return purchaseLookup.data || [];
  }, [purchaseLookup.data]);

  // Фильтрация цен продажи
  const salePrices = useMemo(() => {
    return saleLookup.data || [];
  }, [saleLookup.data]);

  return {
    refuelingSuppliers,
    availableBases,
    purchasePrices,
    salePrices,
  };
}
