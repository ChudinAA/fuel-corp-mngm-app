import { useMemo } from "react";
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
  // Фильтрация поставщиков с wholesale базисами
  const wholesaleSuppliers = useMemo(() => {
    return (
      suppliers?.filter((supplier) => {
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

  // Фильтрация базисов типа wholesale или abroad
  const wholesaleBases = useMemo(() => {
    return allBases?.filter((b) => b.baseType === BASE_TYPE.WHOLESALE) || [];
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

  // Вспомогательная функция: проверяет есть ли у перевозчика тариф от источника (базис/склад)
  // к любому из возможных назначений
  const carrierHasAnyValidTariff = useMemo(() => {
    return (carrierId: string): boolean => {
      if (!deliveryCosts) return false;

      const baseId = basisId;
      const warehouse = supplierWarehouse;

      return deliveryCosts.some((dc) => {
        if (dc.carrierId !== carrierId || !dc.isActive) return false;

        const fromBase =
          baseId &&
          dc.fromEntityType === DELIVERY_ENTITY_TYPE.BASE &&
          dc.fromEntityId === baseId;

        const fromWarehouse =
          warehouse &&
          dc.fromEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE &&
          dc.fromEntityId === warehouse.id;

        if (!fromBase && !fromWarehouse) return false;

        // к точке поставки
        if (dc.toEntityType === DELIVERY_ENTITY_TYPE.DELIVERY_LOCATION) return true;

        // к базису покупателя (base → base или warehouse → base)
        if (
          customerBasisId &&
          dc.toEntityType === DELIVERY_ENTITY_TYPE.BASE &&
          dc.toEntityId === customerBasisId
        ) return true;

        return false;
      });
    };
  }, [deliveryCosts, basisId, supplierWarehouse, customerBasisId]);

  // Авто-определение первого доступного тарифа по данным сделки
  // Возвращает { carrierId, deliveryLocationId | null, tariffType }
  const autoDetectedTariff = useMemo(() => {
    if (!deliveryCosts || (!basisId && !supplierWarehouse)) return null;

    const baseId = basisId;
    const warehouse = supplierWarehouse;

    // Приоритет 1: базис → базис покупателя
    if (baseId && customerBasisId) {
      const cost = deliveryCosts.find((dc) =>
        dc.isActive &&
        dc.fromEntityType === DELIVERY_ENTITY_TYPE.BASE &&
        dc.fromEntityId === baseId &&
        dc.toEntityType === DELIVERY_ENTITY_TYPE.BASE &&
        dc.toEntityId === customerBasisId
      );
      if (cost) {
        return { carrierId: cost.carrierId, deliveryLocationId: null, tariffType: "base_to_base" as const };
      }
    }

    // Приоритет 2: склад → базис покупателя
    if (warehouse && customerBasisId) {
      const cost = deliveryCosts.find((dc) =>
        dc.isActive &&
        dc.fromEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE &&
        dc.fromEntityId === warehouse.id &&
        dc.toEntityType === DELIVERY_ENTITY_TYPE.BASE &&
        dc.toEntityId === customerBasisId
      );
      if (cost) {
        return { carrierId: cost.carrierId, deliveryLocationId: null, tariffType: "warehouse_to_base" as const };
      }
    }

    // Приоритет 3: базис/склад → первая найденная точка поставки
    const costViaLocation = deliveryCosts.find((dc) => {
      if (!dc.isActive) return false;
      if (dc.toEntityType !== DELIVERY_ENTITY_TYPE.DELIVERY_LOCATION) return false;

      const fromBase =
        baseId &&
        dc.fromEntityType === DELIVERY_ENTITY_TYPE.BASE &&
        dc.fromEntityId === baseId;

      const fromWarehouse =
        warehouse &&
        dc.fromEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE &&
        dc.fromEntityId === warehouse.id;

      return fromBase || fromWarehouse;
    });

    if (costViaLocation) {
      return {
        carrierId: costViaLocation.carrierId,
        deliveryLocationId: costViaLocation.toEntityId,
        tariffType: "via_location" as const,
      };
    }

    return null;
  }, [deliveryCosts, basisId, customerBasisId, supplierWarehouse]);

  // Фильтрация доступных мест доставки:
  // показываем точки, у которых есть тариф от текущего источника,
  // либо привязанные к базису покупателя, либо уже выбранную точку
  const availableLocations = useMemo(() => {
    return (
      deliveryLocations?.filter((location) => {
        // Всегда показываем уже выбранную точку
        if (location.id === deliveryLocationId) return true;

        if (!buyerId || !dealDate) return true;

        // Если не заданы ни базис покупателя, ни источник — показываем всё
        if (!customerBasisId && !basisId && !supplierWarehouse) return true;

        const baseId = basisId;
        const warehouse = supplierWarehouse;

        // Проверяем: есть ли тариф от нашего источника к этой точке поставки
        const hasTariffToLocation = deliveryCosts?.some((dc) => {
          if (!dc.isActive) return false;
          if (dc.toEntityType !== DELIVERY_ENTITY_TYPE.DELIVERY_LOCATION) return false;
          if (dc.toEntityId !== location.id) return false;

          const fromBase =
            baseId &&
            dc.fromEntityType === DELIVERY_ENTITY_TYPE.BASE &&
            dc.fromEntityId === baseId;

          const fromWarehouse =
            warehouse &&
            dc.fromEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE &&
            dc.fromEntityId === warehouse.id;

          return fromBase || fromWarehouse;
        });

        if (hasTariffToLocation) return true;

        // Если тарифа нет, показываем точки привязанные к базису покупателя
        if (customerBasisId && location.baseId === customerBasisId) return true;

        // Если не задан базис покупателя — не фильтруем строго
        if (!customerBasisId) return true;

        return false;
      }) || []
    );
  }, [
    buyerId,
    dealDate,
    deliveryLocationId,
    deliveryLocations,
    deliveryCosts,
    customerBasisId,
    basisId,
    supplierWarehouse,
  ]);

  // Фильтрация доступных перевозчиков:
  // показываем перевозчиков, у которых есть тариф от базиса/склада поставщика
  // к любому назначению (точка, базис покупателя) — или к конкретной точке если выбрана
  const availableCarriers = useMemo(() => {
    return (
      carriers?.filter((carrier) => {
        // Если это перевозчик, которого мы только что выбрали/создали — всегда показываем
        if (carrier.id === carrierId) return true;

        if (!deliveryCosts) return true;

        const baseId = basisId;
        const warehouse = supplierWarehouse;

        // Если не задан источник — показываем всех перевозчиков
        if (!baseId && !warehouse) return true;

        // Проверяем наличие тарифа от источника к любому назначению
        const hasAnyTariff = deliveryCosts.some((dc) => {
          if (dc.carrierId !== carrier.id || !dc.isActive) return false;

          const fromBase =
            baseId &&
            dc.fromEntityType === DELIVERY_ENTITY_TYPE.BASE &&
            dc.fromEntityId === baseId;

          const fromWarehouse =
            warehouse &&
            dc.fromEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE &&
            dc.fromEntityId === warehouse.id;

          if (!fromBase && !fromWarehouse) return false;

          // К точке поставки
          if (dc.toEntityType === DELIVERY_ENTITY_TYPE.DELIVERY_LOCATION) return true;

          // К базису покупателя
          if (
            customerBasisId &&
            dc.toEntityType === DELIVERY_ENTITY_TYPE.BASE &&
            dc.toEntityId === customerBasisId
          ) return true;

          // К любому базису (если базис покупателя не задан)
          if (!customerBasisId && dc.toEntityType === DELIVERY_ENTITY_TYPE.BASE) return true;

          return false;
        });

        if (!hasAnyTariff) return false;

        // Если выбрана конкретная точка поставки — фильтруем строже
        if (deliveryLocationId) {
          const hasTariffToDestination = deliveryCosts.some(
            (dc) =>
              dc.carrierId === carrier.id &&
              dc.isActive &&
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
    customerBasisId,
    deliveryCosts,
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
    autoDetectedTariff,
  };
}
