import { useMemo } from "react";
import { format } from "date-fns";
import type { Supplier, Base, Price } from "@shared/schema";
import {
  BASE_TYPE,
  COUNTERPARTY_TYPE,
  COUNTERPARTY_ROLE,
  PRODUCT_TYPE,
  ProductType,
} from "@shared/constants";
import { usePriceLookup } from "@/pages/shared/hooks/use-price-lookup";

interface UseRefuelingFiltersProps {
  supplierId: string;
  buyerId: string;
  refuelingDate: Date;
  basisId?: string;
  customerBasisId?: string;
  productType: string;
  suppliers: Supplier[] | undefined;
  allBases: Base[] | undefined;
}

export function useRefuelingFilters({
  supplierId,
  buyerId,
  refuelingDate,
  basisId,
  customerBasisId,
  productType,
  suppliers,
  allBases,
}: UseRefuelingFiltersProps) {
  const refuelingSuppliers = useMemo(() => {
    return (
      suppliers?.filter((supplier) => {
        if (!supplier.baseIds || supplier.baseIds.length === 0) return false;
        return allBases?.some(
          (base) =>
            supplier.baseIds.includes(base.id) &&
            (base.baseType === BASE_TYPE.REFUELING || base.baseType === BASE_TYPE.ABROAD),
        );
      }) || []
    );
  }, [suppliers, allBases]);

  const availableBases = useMemo(() => {
    if (!supplierId || !suppliers || !allBases) return [];

    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier?.baseIds) return [];

    return allBases.filter(
      (b) =>
        (b.baseType === BASE_TYPE.REFUELING || b.baseType === BASE_TYPE.ABROAD) && 
        supplier.baseIds.includes(b.id),
    );
  }, [supplierId, suppliers, allBases]);

  const purchaseLookup = usePriceLookup({
    counterpartyId: supplierId,
    counterpartyRole: COUNTERPARTY_ROLE.SUPPLIER,
    counterpartyType: COUNTERPARTY_TYPE.REFUELING,
    basisId: basisId,
    productType: productType,
    date: refuelingDate,
    enabled: !!supplierId && !!basisId && !!refuelingDate,
  });

  const saleLookup = usePriceLookup({
    counterpartyId: buyerId,
    counterpartyRole: COUNTERPARTY_ROLE.BUYER,
    counterpartyType: COUNTERPARTY_TYPE.REFUELING,
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
