
import { useMemo } from "react";
import { format } from "date-fns";
import type { Supplier, Base, Price } from "@shared/schema";
import { BASE_TYPE, COUNTERPARTY_TYPE, COUNTERPARTY_ROLE, PRODUCT_TYPE } from "@shared/constants";

interface UseRefuelingFiltersProps {
  supplierId: string;
  buyerId: string;
  refuelingDate: Date;
  selectedBasis: string;
  productType: string;
  allPrices: Price[] | undefined;
  suppliers: Supplier[] | undefined;
  allBases: Base[] | undefined;
}

export function useRefuelingFilters({
  supplierId,
  buyerId,
  refuelingDate,
  selectedBasis,
  productType,
  allPrices,
  suppliers,
  allBases,
}: UseRefuelingFiltersProps) {
  const refuelingSuppliers = useMemo(() => {
    return suppliers?.filter(supplier => {
      if (!supplier.baseIds || supplier.baseIds.length === 0) return false;
      return allBases?.some(base => 
        supplier.baseIds.includes(base.id) && base.baseType === BASE_TYPE.REFUELING
      );
    }) || [];
  }, [suppliers, allBases]);

  const availableBases = useMemo(() => {
    if (!supplierId || !suppliers || !allBases) return [];
    
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier?.baseIds) return [];

    return allBases.filter(b => 
      b.baseType === BASE_TYPE.REFUELING && 
      supplier.baseIds.includes(b.id)
    );
  }, [supplierId, suppliers, allBases]);

  const purchasePrices = useMemo(() => {
    if (!supplierId || !refuelingDate || !selectedBasis || !allPrices) return [];

    const dateStr = format(refuelingDate, "yyyy-MM-dd");
    const supplier = suppliers?.find(s => s.id === supplierId);
    if (!supplier) return [];

    let priceProductType = PRODUCT_TYPE.KEROSENE;
    if (productType === PRODUCT_TYPE.PVKJ) {
      priceProductType = PRODUCT_TYPE.PVKJ;
    } else if (productType === PRODUCT_TYPE.SERVICE) {
      priceProductType = PRODUCT_TYPE.SERVICE;
    }

    return allPrices.filter(p => {
      const basicMatch = p.counterpartyId === supplierId &&
        p.counterpartyType === COUNTERPARTY_TYPE.REFUELING &&
        p.counterpartyRole === COUNTERPARTY_ROLE.SUPPLIER &&
        p.productType === priceProductType &&
        p.basis === selectedBasis &&
        p.dateFrom <= dateStr &&
        p.dateTo >= dateStr &&
        p.isActive;

      return basicMatch;
    });
  }, [supplierId, refuelingDate, selectedBasis, productType, allPrices, suppliers]);

  const salePrices = useMemo(() => {
    if (!buyerId || !refuelingDate || !allPrices) return [];

    const dateStr = format(refuelingDate, "yyyy-MM-dd");

    let priceProductType = PRODUCT_TYPE.KEROSENE;
    if (productType === PRODUCT_TYPE.PVKJ) {
      priceProductType = PRODUCT_TYPE.PVKJ;
    } else if (productType === PRODUCT_TYPE.SERVICE) {
      priceProductType = PRODUCT_TYPE.SERVICE;
    }

    return allPrices.filter(p => {
      const basicMatch = p.counterpartyId === buyerId &&
        p.counterpartyType === COUNTERPARTY_TYPE.REFUELING &&
        p.counterpartyRole === COUNTERPARTY_ROLE.BUYER &&
        p.productType === priceProductType &&
        p.dateFrom <= dateStr &&
        p.dateTo >= dateStr &&
        p.isActive;

      return basicMatch;
    });
  }, [buyerId, refuelingDate, productType, allPrices]);

  return {
    refuelingSuppliers,
    availableBases,
    purchasePrices,
    salePrices,
  };
}
