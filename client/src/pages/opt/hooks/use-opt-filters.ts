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
  selectedBasis: string;
  carrierId: string;
  deliveryLocationId: string;
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
  deliveryLocationId,
  suppliers,
  allBases,
  carriers,
  deliveryLocations,
  deliveryCosts,
  supplierWarehouse,
}: UseOptFiltersProps) {

  // Фильтрация поставщиков с wholesale базисами
  const wholesaleSuppliers = useMemo(() => {
    return (
      suppliers?.filter((supplier) => {
        if (!supplier.isActive) return false;
        if (!supplier.baseIds || supplier.baseIds.length === 0) return false;
        return allBases?.some(
          (base) =>
            supplier.baseIds &&
            supplier.baseIds.includes(base.id) &&
            base.baseType === BASE_TYPE.WHOLESALE,
        );
      }) || []
    );
  }, [suppliers, allBases]);

  // Фильтрация базисов типа wholesale
  const wholesaleBases = useMemo(() => {
    return allBases?.filter((b) => b.baseType === BASE_TYPE.WHOLESALE) || [];
  }, [allBases]);

  // Все возможные цены на текущую дату для выбранного Покупателя
  const locationAvailableSaleLookup = usePriceLookup({
    counterpartyId: buyerId,
    counterpartyRole: COUNTERPARTY_ROLE.BUYER,
    counterpartyType: COUNTERPARTY_TYPE.WHOLESALE,
    basis: null,
    productType: PRODUCT_TYPE.KEROSENE,
    date: dealDate,
    enabled: !!buyerId && !!dealDate,
  });

  // Фильтрация доступных мест доставки
  const availableLocations = useMemo(() => {
    return (
      deliveryLocations?.filter((location) => {
        if (!location.isActive) return false;
        if (!buyerId || !dealDate) return true;

        const buyerSalePrices = locationAvailableSaleLookup.data || [];
        if (buyerSalePrices.length > 0) {
          const activeSaleBasises = new Set(
            buyerSalePrices.map((p) => p.basis),
          );
          if (location.baseId) {
            const locBase = allBases?.find((b) => b.id === location.baseId);
            if (locBase && !activeSaleBasises.has(locBase.name)) {
              return false;
            }
          }
        }

        return true;
      }) || []
    );
  }, [buyerId, dealDate, allBases, locationAvailableSaleLookup.data]);

  const purchaseLookup = usePriceLookup({
    counterpartyId: supplierId,
    counterpartyRole: COUNTERPARTY_ROLE.SUPPLIER,
    counterpartyType: COUNTERPARTY_TYPE.WHOLESALE,
    basis: selectedBasis,
    productType: PRODUCT_TYPE.KEROSENE,
    date: dealDate,
    enabled: !!supplierId && !!selectedBasis && !!dealDate,
  });

  // Определяем базис для фильтрации цен продажи
  const saleBasisName = useMemo(() => {
    let name = selectedBasis;
    if (deliveryLocationId && deliveryLocations && allBases) {
      const selectedLocation = deliveryLocations.find(
        (loc) => loc.id === deliveryLocationId,
      );
      if (selectedLocation?.baseId) {
        const locationBase = allBases.find(
          (b) => b.id === selectedLocation.baseId,
        );
        if (locationBase) {
          name = locationBase.name;
        }
      }
    }
    return name;
  }, [selectedBasis, deliveryLocationId, deliveryLocations, allBases]);

  const saleLookup = usePriceLookup({
    counterpartyId: buyerId,
    counterpartyRole: COUNTERPARTY_ROLE.BUYER,
    counterpartyType: COUNTERPARTY_TYPE.WHOLESALE,
    basis: saleBasisName,
    productType: PRODUCT_TYPE.KEROSENE,
    date: dealDate,
    enabled: !!buyerId && !!saleBasisName && !!dealDate,
  });

  // Фильтрация цен покупки
  const purchasePrices = useMemo(() => {
    return purchaseLookup.data || [];
  }, [purchaseLookup.data]);

  // Фильтрация цен продажи
  const salePrices = useMemo(() => {
    return saleLookup.data || [];
  }, [saleLookup.data]);

  // Фильтрация доступных перевозчиков
  const availableCarriers = useMemo(() => {
    return (
      carriers?.filter((carrier) => {
        if (!deliveryCosts) return true;

        const base = wholesaleBases?.find((b) => b.name === selectedBasis);
        const warehouse = supplierWarehouse;

        const hasTariffFromSource = deliveryCosts.some(
          (dc) =>
            dc.carrierId === carrier.id &&
            ((base &&
              dc.fromEntityType === DELIVERY_ENTITY_TYPE.BASE &&
              dc.fromEntityId === base.id) ||
              (warehouse &&
                dc.fromEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE &&
                dc.fromEntityId === warehouse.id)),
        );

        if (!hasTariffFromSource && (base || warehouse)) return false;

        if (deliveryLocationId) {
          const hasTariffToDestination = deliveryCosts.some(
            (dc) =>
              dc.carrierId === carrier.id &&
              dc.toEntityType === DELIVERY_ENTITY_TYPE.DELIVERY_LOCATION &&
              dc.toEntityId === deliveryLocationId &&
              ((base &&
                dc.fromEntityType === DELIVERY_ENTITY_TYPE.BASE &&
                dc.fromEntityId === base.id) ||
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
    selectedBasis,
    deliveryCosts,
    wholesaleBases,
    supplierWarehouse,
    deliveryLocationId,
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
