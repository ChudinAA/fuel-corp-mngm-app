
import { useMemo } from "react";
import { format } from "date-fns";
import type { Price, Supplier, Base, LogisticsCarrier, LogisticsDeliveryLocation, DeliveryCost } from "@shared/schema";
import { COUNTERPARTY_TYPE, COUNTERPARTY_ROLE, PRODUCT_TYPE, BASE_TYPE, ENTITY_TYPE } from "@shared/constants";

interface UseOptFiltersProps {
  supplierId: string;
  buyerId: string;
  dealDate: Date;
  selectedBasis: string;
  carrierId: string;
  allPrices: Price[] | undefined;
  suppliers: Supplier[] | undefined;
  allBases: Base[] | undefined;
  carriers: LogisticsCarrier[] | undefined;
  deliveryLocations: LogisticsDeliveryLocation[] | undefined;
  deliveryCosts: DeliveryCost[] | undefined;
  supplierWarehouse: any;
}

export function useOptFilters({
  supplierId,
  buyerId,
  dealDate,
  selectedBasis,
  carrierId,
  allPrices,
  suppliers,
  allBases,
  carriers,
  deliveryLocations,
  deliveryCosts,
  supplierWarehouse,
}: UseOptFiltersProps) {
  // Фильтрация цен покупки
  const purchasePrices = useMemo(() => {
    if (!supplierId || !selectedBasis || !dealDate) return [];

    const dateStr = format(dealDate, "yyyy-MM-dd");
    const supplier = suppliers?.find(s => s.id === supplierId);
    if (!supplier) return [];

    return allPrices?.filter(p =>
      p.counterpartyId === supplierId &&
      p.counterpartyType === COUNTERPARTY_TYPE.WHOLESALE &&
      p.counterpartyRole === COUNTERPARTY_ROLE.SUPPLIER &&
      p.productType === PRODUCT_TYPE.KEROSENE &&
      p.basis === selectedBasis &&
      p.dateFrom <= dateStr &&
      p.dateTo >= dateStr &&
      p.isActive
    ) || [];
  }, [supplierId, selectedBasis, dealDate, suppliers, allPrices]);

  // Фильтрация цен продажи
  const salePrices = useMemo(() => {
    if (!buyerId || !selectedBasis || !dealDate) return [];

    const dateStr = format(dealDate, "yyyy-MM-dd");

    return allPrices?.filter(p =>
      p.counterpartyId === buyerId &&
      p.counterpartyType === COUNTERPARTY_TYPE.WHOLESALE &&
      p.counterpartyRole === COUNTERPARTY_ROLE.BUYER &&
      p.productType === PRODUCT_TYPE.KEROSENE &&
      p.dateFrom <= dateStr &&
      p.dateTo >= dateStr &&
      p.isActive
    ) || [];
  }, [buyerId, selectedBasis, dealDate, allPrices]);

  // Фильтрация поставщиков с wholesale базисами
  const wholesaleSuppliers = useMemo(() => {
    return suppliers?.filter(supplier => {
      if (!supplier.baseIds || supplier.baseIds.length === 0) return false;
      return allBases?.some(base => 
        supplier.baseIds.includes(base.id) && base.baseType === BASE_TYPE.WHOLESALE
      );
    }) || [];
  }, [suppliers, allBases]);

  // Фильтрация базисов типа wholesale
  const wholesaleBases = useMemo(() => {
    return allBases?.filter(b => b.baseType === BASE_TYPE.WHOLESALE) || [];
  }, [allBases]);

  // Фильтрация доступных перевозчиков
  const availableCarriers = useMemo(() => {
    return carriers?.filter(carrier => {
      if (!selectedBasis || !deliveryCosts) return true;

      const base = wholesaleBases?.find(b => b.name === selectedBasis);
      if (!base) return true;

      const warehouse = supplierWarehouse;

      return deliveryCosts.some(dc => 
        dc.carrierId === carrier.id &&
        (
          (dc.fromEntityType === ENTITY_TYPE.BASE && dc.fromEntityId === base.id) ||
          (warehouse && dc.fromEntityType === ENTITY_TYPE.WAREHOUSE && dc.fromEntityId === warehouse.id)
        )
      );
    }) || [];
  }, [carriers, selectedBasis, deliveryCosts, wholesaleBases, supplierWarehouse]);

  // Фильтрация доступных мест доставки
  const availableLocations = useMemo(() => {
    return deliveryLocations?.filter(location => {
      if (!carrierId || !deliveryCosts) return true;

      const base = wholesaleBases?.find(b => b.name === selectedBasis);
      const warehouse = supplierWarehouse;

      return deliveryCosts.some(dc => 
        dc.carrierId === carrierId &&
        dc.toEntityType === ENTITY_TYPE.DELIVERY_LOCATION &&
        dc.toEntityId === location.id &&
        (
          (base && dc.fromEntityType === ENTITY_TYPE.BASE && dc.fromEntityId === base.id) ||
          (warehouse && dc.fromEntityType === ENTITY_TYPE.WAREHOUSE && dc.fromEntityId === warehouse.id)
        )
      );
    }) || [];
  }, [deliveryLocations, carrierId, deliveryCosts, selectedBasis, wholesaleBases, supplierWarehouse]);

  return {
    purchasePrices,
    salePrices,
    wholesaleSuppliers,
    wholesaleBases,
    availableCarriers,
    availableLocations,
  };
}
