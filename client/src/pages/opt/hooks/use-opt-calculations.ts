import { useMemo } from "react";
import type { Price, Warehouse, Base, Supplier } from "@shared/schema";
import type { DeliveryCostApiRecord } from "@/pages/delivery/types";
import { DELIVERY_ENTITY_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { usePriceExtraction } from "../../shared/hooks/use-price-extraction";
import { useContractVolume } from "@/pages/shared/hooks/use-contract-volume";
import { parsePriceCompositeId } from "@/pages/shared/utils/price-utils";
import { useOptWarehouseBalance } from "./use-opt-warehouse-balance";
import {
  pricePerKilogramToPerTonne,
  pricePerTonneToPerKilogram,
} from "@shared/units";
import {
  calculateOptTonnes,
  contractPricePerTonne,
  optTonnesToLegacyKilograms,
  type OptInputMode,
} from "../unit-calculations";

interface UseOptCalculationsProps {
  inputMode: OptInputMode;
  quantityLiters: string;
  density: string;
  quantityTonnes: string;
  isWarehouseSupplier: boolean;
  supplierWarehouse: Warehouse | undefined;
  basisId: string;
  customerBasisId: string;
  purchasePrices: Price[];
  salePrices: Price[];
  selectedPurchasePriceId: string;
  selectedSalePriceId: string;
  deliveryCosts: DeliveryCostApiRecord[] | undefined;
  carrierId: string;
  deliveryLocationId: string;
  isEditing: boolean;
  initialQuantityKg?: number;
  dealDate?: Date;
  productType: string;
  selectedSupplier?: Supplier;
  noDeliveryRequired?: boolean;
}

export function useOptCalculations({
  inputMode,
  quantityLiters,
  density,
  quantityTonnes,
  isWarehouseSupplier,
  supplierWarehouse,
  basisId,
  customerBasisId,
  purchasePrices,
  salePrices,
  selectedPurchasePriceId,
  selectedSalePriceId,
  deliveryCosts,
  carrierId,
  deliveryLocationId,
  isEditing,
  initialQuantityKg = 0,
  dealDate,
  productType,
  selectedSupplier,
  noDeliveryRequired = false,
}: UseOptCalculationsProps) {
  const finalTonnes = calculateOptTonnes({
    inputMode,
    quantityTonnes,
    quantityLiters,
    density,
  });
  const calculatedTonnes = finalTonnes > 0 ? finalTonnes.toFixed(5) : "";
  const finalKg = optTonnesToLegacyKilograms(finalTonnes);

  const { 
    availableBalance: warehouseBalanceAtDate, 
    availableBalanceTonnes: warehouseBalanceAtDateTonnes,
    warehousePrice: warehousePriceAtDate,
    warehousePricePerTonne: warehousePricePerTonneAtDate,
    isLoading: isWarehouseBalanceLoading 
  } = useOptWarehouseBalance({
    productType,
    warehouseId: isWarehouseSupplier ? supplierWarehouse?.id : undefined,
    dealDate,
    isEditing,
    editQuantityKg: initialQuantityKg.toString(),
    initialCurrentBalance: productType === "pvkj" ? (supplierWarehouse as any)?.pvkjBalance : supplierWarehouse?.currentBalance,
    initialCurrentBalanceTonnes: productType === "pvkj"
      ? (supplierWarehouse as any)?.pvkjBalanceTonnes
      : (supplierWarehouse as any)?.currentBalanceTonnes,
  });

  const {
    purchasePrice: extractedPurchasePrice,
    purchasePriceUnit: extractedPurchasePriceUnit,
    salePrice: extractedSalePrice,
    salePriceUnit: extractedSalePriceUnit,
  } = usePriceExtraction({
    purchasePrices,
    salePrices,
    selectedPurchasePriceId,
    selectedSalePriceId,
    isWarehouseSupplier,
    supplierWarehouse,
    productType,
  });

  const basisPrice = selectedSupplier?.basisPrices?.find(
    (price) => price.basisId === basisId,
  );
  const purchasePriceUnit =
    isWarehouseSupplier && warehousePricePerTonneAtDate !== null
      ? "tonne"
      : isWarehouseSupplier && warehousePriceAtDate !== null
        ? "kg"
        : extractedPurchasePriceUnit;
  const salePriceUnit = extractedSalePriceUnit;

  const rawPurchasePrice =
    isWarehouseSupplier && warehousePriceAtDate !== null
      ? warehousePriceAtDate
      : extractedPurchasePrice;
  const purchasePricePerTonne =
    isWarehouseSupplier && warehousePricePerTonneAtDate !== null
      ? warehousePricePerTonneAtDate
      : purchasePriceUnit === "kg"
        ? rawPurchasePrice === null
          ? null
          : pricePerKilogramToPerTonne(rawPurchasePrice)
        : contractPricePerTonne(rawPurchasePrice, purchasePriceUnit, density);
  const salePricePerTonne = contractPricePerTonne(
    extractedSalePrice,
    salePriceUnit,
    density,
  );
  const purchasePricePerKilogram =
    purchasePricePerTonne === null
      ? null
      : pricePerTonneToPerKilogram(purchasePricePerTonne);
  const salePricePerKilogram =
    salePricePerTonne === null
      ? null
      : pricePerTonneToPerKilogram(salePricePerTonne);
  const densityValue = parseFloat(density);
  const validDensity = Number.isFinite(densityValue) && densityValue > 0;
  const purchasePriceRequiresDensity =
    purchasePriceUnit === "liter" && !validDensity;
  const salePriceRequiresDensity = salePriceUnit === "liter" && !validDensity;
  const priceRequiresDensity =
    purchasePriceRequiresDensity || salePriceRequiresDensity;

  // Получение стоимости доставки с гибким поиском тарифа по приоритету:
  // 1. Самовывоз (noDeliveryRequired) → 0
  // 2. Точка поставки → delivery_location (если выбрана)
  // 3. Базис поставщика → базис покупателя (base → base)
  // 4. Склад поставщика → базис покупателя (warehouse → base)
  const matchedDeliveryCost = useMemo(() => {
    if (noDeliveryRequired) {
      return null;
    }
    if (!carrierId || !deliveryCosts) {
      return null;
    }

    const baseId = basisId;
    const warehouse = supplierWarehouse;

    // Приоритет 1: тариф через конкретную точку поставки
    if (deliveryLocationId) {
      const cost = deliveryCosts.find((dc) => {
        const matchesCarrier = dc.carrierId === carrierId;
        const matchesDestination =
          dc.toEntityType === DELIVERY_ENTITY_TYPE.DELIVERY_LOCATION &&
          dc.toEntityId === deliveryLocationId;

        let matchesSource = false;
        if (
          warehouse &&
          dc.fromEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE &&
          dc.fromEntityId === warehouse.id
        ) {
          matchesSource = true;
        } else if (
          baseId &&
          dc.fromEntityType === DELIVERY_ENTITY_TYPE.BASE &&
          dc.fromEntityId === baseId
        ) {
          matchesSource = true;
        }

        return matchesCarrier && matchesDestination && matchesSource && dc.isActive;
      });

      if (cost?.costPerTonne) {
        return cost;
      }
    }

    // Приоритет 2: тариф базис поставщика → базис покупателя
    if (baseId && customerBasisId) {
      const cost = deliveryCosts.find((dc) =>
        dc.carrierId === carrierId &&
        dc.isActive &&
        dc.fromEntityType === DELIVERY_ENTITY_TYPE.BASE &&
        dc.fromEntityId === baseId &&
        dc.toEntityType === DELIVERY_ENTITY_TYPE.BASE &&
        dc.toEntityId === customerBasisId
      );

      if (cost?.costPerTonne) {
        return cost;
      }
    }

    // Приоритет 3: тариф склад поставщика → базис покупателя
    if (warehouse && customerBasisId) {
      const cost = deliveryCosts.find((dc) =>
        dc.carrierId === carrierId &&
        dc.isActive &&
        dc.fromEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE &&
        dc.fromEntityId === warehouse.id &&
        dc.toEntityType === DELIVERY_ENTITY_TYPE.BASE &&
        dc.toEntityId === customerBasisId
      );

      if (cost?.costPerTonne) {
        return cost;
      }
    }

    return null;
  }, [
    noDeliveryRequired,
    deliveryLocationId,
    carrierId,
    deliveryCosts,
    basisId,
    customerBasisId,
    supplierWarehouse,
  ]);
  const deliveryCost =
    noDeliveryRequired
      ? 0
      : matchedDeliveryCost && finalTonnes > 0
        ? Number(matchedDeliveryCost.costPerTonne) * finalTonnes
        : null;

  const purchaseAmount =
    purchasePricePerTonne !== null && finalTonnes > 0
      ? purchasePricePerTonne * finalTonnes
      : null;
  const saleAmount =
    salePricePerTonne !== null && finalTonnes > 0
      ? salePricePerTonne * finalTonnes
      : null;

  const otherServiceFee = useMemo(() => {
    if (basisId && selectedSupplier?.basisPrices && finalTonnes > 0) {
      const bp = selectedSupplier.basisPrices.find((b) => b.basisId === basisId);
      if (!bp?.otherServiceType || !bp?.otherServiceValue) return 0;
      const val = parseFloat(bp.otherServiceValue);
      if (isNaN(val) || val <= 0) return 0;
      if (bp.otherServiceType === "royalty_per_ton") return val * finalTonnes;
      if (bp.otherServiceType === "percent_of_amount" && saleAmount !== null) return saleAmount * val / 100;
      if (bp.otherServiceType === "fixed") return val;
    }
    return 0;
  }, [selectedSupplier, basisId, finalTonnes, saleAmount]);

  const profit = useMemo(() => {
    if (
      purchaseAmount !== null &&
      saleAmount !== null &&
      deliveryCost !== null
    ) {
      return saleAmount - purchaseAmount - deliveryCost - otherServiceFee;
    }
    if (purchaseAmount !== null && saleAmount !== null) {
      return saleAmount - purchaseAmount - otherServiceFee;
    }
    return null;
  }, [purchaseAmount, saleAmount, deliveryCost, otherServiceFee]);

  const deliveryTariffPerTonne =
    deliveryCost !== null && finalTonnes > 0
      ? deliveryCost / finalTonnes
      : null;
  const deliveryTariffPerKilogram =
    deliveryTariffPerTonne === null
      ? null
      : pricePerTonneToPerKilogram(deliveryTariffPerTonne);

  // Логика проверки объема по договору
  const contractVolumeStatus = useContractVolume({
    priceId: parsePriceCompositeId(selectedSalePriceId).priceId,
    currentQuantityTonnes: finalTonnes,
    initialQuantityTonnes: initialQuantityKg / 1_000,
    mode: "opt",
    currentDealAmount: saleAmount ?? 0,
    initialDealAmount:
      (salePricePerTonne ?? 0) * (initialQuantityKg / 1000),
  });

  // Логика проверки объема по договору поставщика
  const supplierContractVolumeStatus = useContractVolume({
    priceId: parsePriceCompositeId(selectedPurchasePriceId).priceId,
    currentQuantityTonnes: finalTonnes,
    initialQuantityTonnes: initialQuantityKg / 1_000,
    mode: "opt",
    currentDealAmount: purchaseAmount ?? 0,
    initialDealAmount:
      (purchasePricePerTonne ?? 0) * (initialQuantityKg / 1000),
  });

  return {
    calculatedTonnes,
    finalTonnes,
    finalKg,
    purchasePricePerTonne,
    salePricePerTonne,
    purchasePricePerKilogram,
    salePricePerKilogram,
    purchasePriceUnit,
    salePriceUnit,
    purchasePriceRequiresDensity,
    salePriceRequiresDensity,
    priceRequiresDensity,
    deliveryCost,
    matchedDeliveryCost,
    purchaseAmount,
    saleAmount,
    profit,
    otherServiceFee,
    deliveryTariffPerTonne,
    deliveryTariffPerKilogram,
    contractVolumeStatus,
    supplierContractVolumeStatus,
    warehouseBalanceAtDate: (typeof warehouseBalanceAtDate === 'number' ? warehouseBalanceAtDate : (typeof warehouseBalanceAtDate === 'string' ? parseFloat(warehouseBalanceAtDate) : 0)) as number,
    warehouseBalanceAtDateTonnes,
    isWarehouseBalanceLoading,
    warehousePriceAtDate,
  };
}
