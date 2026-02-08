import { useMemo } from "react";
import { format } from "date-fns";
import type {
  Supplier,
  Base,
  LogisticsCarrier,
  LogisticsDeliveryLocation,
  DeliveryCost,
  Price,
} from "@shared/schema";
import {
  COUNTERPARTY_TYPE,
  COUNTERPARTY_ROLE,
  PRODUCT_TYPE,
  BASE_TYPE,
  DELIVERY_ENTITY_TYPE,
} from "@shared/constants";
import { usePriceLookup } from "@/pages/shared/hooks/use-price-lookup";

interface UseOptFiltersProps {
  supplierId: string;
  buyerId: string;
  dealDate: Date;
  basisId: string;
  customerBasisId: string;
  carrierId: string;
  deliveryLocationId: string;
  productType: string;
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
  basisId,
  customerBasisId,
  carrierId,
  deliveryLocationId,
  productType,
  suppliers,
  allBases,
  carriers,
  deliveryLocations,
  deliveryCosts,
  supplierWarehouse,
}: UseOptFiltersProps) {

  // Фильтрация поставщиков с wholesale или abroad базисами
  const wholesaleSuppliers = useMemo(() => {
    return (
      suppliers?.filter((supplier) => {
        if (!supplier.baseIds || supplier.baseIds.length === 0) return false;
        return allBases?.some(
          (base) =>
            supplier.baseIds &&
            supplier.baseIds.includes(base.id) &&
            (base.baseType === BASE_TYPE.WHOLESALE || base.baseType === BASE_TYPE.ABROAD),
        );
      }) || []
    );
  }, [suppliers, allBases]);

  // Фильтрация базисов типа wholesale или abroad
  const wholesaleBases = useMemo(() => {
    return allBases?.filter((b) => b.baseType === BASE_TYPE.WHOLESALE || b.baseType === BASE_TYPE.ABROAD) || [];
  }, [allBases]);

  const purchaseLookup = usePriceLookup({
    counterpartyId: supplierId,
    counterpartyRole: COUNTERPARTY_ROLE.SUPPLIER,
    counterpartyType: COUNTERPARTY_TYPE.WHOLESALE,
    basisId: basisId,
    productType: productType || PRODUCT_TYPE.KEROSENE,
    date: dealDate,
    enabled: !!supplierId && !!basisId && !!dealDate,
  });

  const saleLookup = usePriceLookup({
    counterpartyId: buyerId,
    counterpartyRole: COUNTERPARTY_ROLE.BUYER,
    counterpartyType: COUNTERPARTY_TYPE.WHOLESALE,
    basisId: customerBasisId,
    productType: productType || PRODUCT_TYPE.KEROSENE,
    date: dealDate,
    enabled: !!buyerId && !!customerBasisId && !!dealDate,
  });

  // Фильтрация цен покупки
  const purchasePrices = useMemo(() => {
    return purchaseLookup.data || [];
  }, [purchaseLookup.data]);

  // Фильтрация цен продажи
  const salePrices = useMemo(() => {
    return saleLookup.data || [];
  }, [saleLookup.data]);

  // Фильтрация доступных мест доставки
  const availableLocations = useMemo(() => {
    return (
      deliveryLocations?.filter((location) => {
        // Если это точка, которую мы только что выбрали/создали, всегда показываем её
        if (location.id === deliveryLocationId) return true;

        if (!buyerId || !dealDate) return true;

        // Фильтрация по выбранному базису покупателя
        if (customerBasisId) {
          if (location.baseId !== customerBasisId) {
            return false;
          }
        }

        return true;
      }) || []
    );
  }, [buyerId, dealDate, allBases, deliveryLocationId, deliveryLocations, customerBasisId]);
  
  // Фильтрация доступных перевозчиков
  const availableCarriers = useMemo(() => {
    return (
      carriers?.filter((carrier) => {
        // Если это превозчик, которую мы только что выбрали/создали, всегда показываем её
        if (carrier.id === carrierId) return true;
        
        if (!deliveryCosts) return true;

        const baseId = basisId;
        const warehouse = supplierWarehouse;

        const hasTariffFromSource = deliveryCosts.some(
          (dc) =>
            dc.carrierId === carrier.id &&
            ((baseId &&
              dc.fromEntityType === DELIVERY_ENTITY_TYPE.BASE &&
              dc.fromEntityId === baseId) ||
              (warehouse &&
                dc.fromEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE &&
                dc.fromEntityId === warehouse.id)),
        );

        if (!hasTariffFromSource && (baseId || warehouse)) return false;

        if (deliveryLocationId) {
          const hasTariffToDestination = deliveryCosts.some(
            (dc) =>
              dc.carrierId === carrier.id &&
              dc.toEntityType === DELIVERY_ENTITY_TYPE.DELIVERY_LOCATION &&
              dc.toEntityId === deliveryLocationId &&
              ((baseId &&
                dc.fromEntityType === DELIVERY_ENTITY_TYPE.BASE &&
                dc.fromEntityId === baseId) ||
                (warehouse &&
                  dc.fromEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE &&
                  dc.fromEntityId === warehouse.id)),
          );
          if (!hasTariffToDestination) return false;
        }

        return true;
      }) || []
    );
  }, [
    carriers,
    basisId,
    deliveryCosts,
    wholesaleBases,
    supplierWarehouse,
    deliveryLocationId,
    carrierId,
  ]);

  return {
    purchasePrices,
    salePrices,
    wholesaleSuppliers,
    wholesaleBases,
    availableCarriers,
    availableLocations,
  };
}
