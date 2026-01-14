
import { useMemo } from "react";
import { format } from "date-fns";
import type { Price, Supplier, Base, LogisticsCarrier, LogisticsDeliveryLocation, DeliveryCost } from "@shared/schema";
import { COUNTERPARTY_TYPE, COUNTERPARTY_ROLE, PRODUCT_TYPE, BASE_TYPE, DELIVERY_ENTITY_TYPE } from "@shared/constants";

interface UseOptFiltersProps {
  supplierId: string;
  buyerId: string;
  dealDate: Date;
  selectedBasis: string;
  carrierId: string;
  deliveryLocationId: string;
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
  deliveryLocationId,
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

  // Фильтрация доступных мест доставки
  const availableLocations = useMemo(() => {
    return deliveryLocations?.filter(location => {
      // Фильтр 1: По привязке к базисам из цен продажи покупателя
      // Ищем цены продажи для этого покупателя на эту дату
      if (!buyerId || !dealDate || !allPrices) return true;
      const dateStr = format(dealDate, "yyyy-MM-dd");

      const buyerSalePrices = allPrices.filter(p =>
        p.counterpartyId === buyerId &&
        p.counterpartyType === COUNTERPARTY_TYPE.WHOLESALE &&
        p.counterpartyRole === COUNTERPARTY_ROLE.BUYER &&
        p.productType === PRODUCT_TYPE.KEROSENE &&
        p.dateFrom <= dateStr &&
        p.dateTo >= dateStr &&
        p.isActive
      );

      if (buyerSalePrices.length > 0) {
        const activeSaleBasises = new Set(buyerSalePrices.map(p => p.basis));
        if (location.baseId) {
          const locBase = allBases?.find(b => b.id === location.baseId);
          if (locBase && !activeSaleBasises.has(locBase.name)) {
            return false;
          }
        }
      }

      // Фильтр 2: По наличию тарифов у перевозчика (убрано ограничение точек поставки по перевозчику для приоритета выбора юзером)
      // if (!carrierId || !deliveryCosts) return true;
      return true;
    }) || [];
  }, [deliveryLocations, carrierId, deliveryCosts, selectedBasis, wholesaleBases, supplierWarehouse, buyerId, dealDate, allPrices, allBases]);
  
  // Фильтрация доступных перевозчиков
  const availableCarriers = useMemo(() => {
    return carriers?.filter(carrier => {
      if (!deliveryCosts) return true;

      const base = wholesaleBases?.find(b => b.name === selectedBasis);
      const warehouse = supplierWarehouse;

      // Фильтр 1: По Базису поставщика / Складу
      const hasTariffFromSource = deliveryCosts.some(dc => 
        dc.carrierId === carrier.id &&
        (
          (base && dc.fromEntityType === DELIVERY_ENTITY_TYPE.BASE && dc.fromEntityId === base.id) ||
          (warehouse && dc.fromEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE && dc.fromEntityId === warehouse.id)
        )
      );

      if (!hasTariffFromSource && (base || warehouse)) return false;

      // Фильтр 2: По Точке поставки (если выбрана)
      if (deliveryLocationId) {
        const hasTariffToDestination = deliveryCosts.some(dc =>
          dc.carrierId === carrier.id &&
          dc.toEntityType === DELIVERY_ENTITY_TYPE.DELIVERY_LOCATION &&
          dc.toEntityId === deliveryLocationId &&
          (
            (base && dc.fromEntityType === DELIVERY_ENTITY_TYPE.BASE && dc.fromEntityId === base.id) ||
            (warehouse && dc.fromEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE && dc.fromEntityId === warehouse.id)
          )
        );
        if (!hasTariffToDestination) return false;
      }

      return true;
    }) || [];
  }, [carriers, selectedBasis, deliveryCosts, wholesaleBases, supplierWarehouse, deliveryLocationId]);

  // Фильтрация цен продажи
  // Используем baseId из выбранного места доставки, если оно есть
  const salePrices = useMemo(() => {
    if (!buyerId || !dealDate) return [];

    const dateStr = format(dealDate, "yyyy-MM-dd");

    // Определяем базис для фильтрации цен продажи
    let saleBasisName = selectedBasis;

    // Если выбрано место доставки с привязанным базисом, используем его
    if (deliveryLocationId && deliveryLocations && allBases) {
      const selectedLocation = deliveryLocations.find(loc => loc.id === deliveryLocationId);
      if (selectedLocation?.baseId) {
        const locationBase = allBases.find(b => b.id === selectedLocation.baseId);
        if (locationBase) {
          saleBasisName = locationBase.name;
        }
      }
    }

    if (!saleBasisName) return [];

    return allPrices?.filter(p =>
      p.counterpartyId === buyerId &&
      p.counterpartyType === COUNTERPARTY_TYPE.WHOLESALE &&
      p.counterpartyRole === COUNTERPARTY_ROLE.BUYER &&
      p.productType === PRODUCT_TYPE.KEROSENE &&
      p.basis === saleBasisName &&
      p.dateFrom <= dateStr &&
      p.dateTo >= dateStr &&
      p.isActive
    ) || [];
  }, [buyerId, dealDate, allPrices, selectedBasis, deliveryLocationId, deliveryLocations, allBases]);
  
  return {
    purchasePrices,
    salePrices,
    wholesaleSuppliers,
    wholesaleBases,
    availableCarriers,
    availableLocations,
  };
}
