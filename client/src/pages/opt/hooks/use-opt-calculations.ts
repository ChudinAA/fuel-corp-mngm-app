import { useMemo } from "react";
import type { Price, Warehouse, DeliveryCost, Base } from "@shared/schema";
import { DELIVERY_ENTITY_TYPE } from "@shared/constants";
import { useQuantityCalculation } from "../../shared/hooks/use-quantity-calculation";
import { usePriceExtraction } from "../../shared/hooks/use-price-extraction";
import { useContractVolume } from "@/pages/shared/hooks/use-contract-volume";
import { parsePriceCompositeId } from "@/pages/shared/utils/price-utils";
import { useWarehouseBalance } from "@/hooks/use-warehouse-balance";

interface UseOptCalculationsProps {
  inputMode: "liters" | "kg";
  quantityLiters: string;
  density: string;
  quantityKg: string;
  isWarehouseSupplier: boolean;
  supplierWarehouse: Warehouse | undefined;
  selectedBasis: string;
  purchasePrices: Price[];
  salePrices: Price[];
  selectedPurchasePriceId: string;
  selectedSalePriceId: string;
  deliveryCosts: DeliveryCost[] | undefined;
  carrierId: string;
  deliveryLocationId: string;
  bases: Base[] | undefined;
  isEditing: boolean;
  dealDate?: Date;
}

export function useOptCalculations({
  inputMode,
  quantityLiters,
  density,
  quantityKg,
  isWarehouseSupplier,
  supplierWarehouse,
  selectedBasis,
  purchasePrices,
  salePrices,
  selectedPurchasePriceId,
  selectedSalePriceId,
  deliveryCosts,
  carrierId,
  deliveryLocationId,
  bases,
  isEditing,
  dealDate,
}: UseOptCalculationsProps) {
  const { calculatedKg, finalKg } = useQuantityCalculation({
    inputMode,
    quantityLiters,
    density,
    quantityKg,
  });

  const { data: historicalBalance } = useWarehouseBalance(
    isWarehouseSupplier ? supplierWarehouse?.id : undefined,
    dealDate
  );

  const { purchasePrice, salePrice } = usePriceExtraction({
    purchasePrices,
    salePrices,
    selectedPurchasePriceId,
    selectedSalePriceId,
    isWarehouseSupplier,
    supplierWarehouse,
  });

  // Получение стоимости доставки
  const deliveryCost = useMemo((): number | null => {
    if (
      !deliveryLocationId ||
      !carrierId ||
      !deliveryCosts ||
      !finalKg ||
      finalKg <= 0
    ) {
      return null;
    }

    const base = bases?.find((b) => b.name === selectedBasis);
    const warehouse = supplierWarehouse;

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
        base &&
        dc.fromEntityType === DELIVERY_ENTITY_TYPE.BASE &&
        dc.fromEntityId === base.id
      ) {
        matchesSource = true;
      }

      return (
        matchesCarrier && matchesDestination && matchesSource && dc.isActive
      );
    });

    if (cost?.costPerKg) {
      return parseFloat(cost.costPerKg) * finalKg;
    }

    return null;
  }, [
    deliveryLocationId,
    carrierId,
    deliveryCosts,
    finalKg,
    bases,
    selectedBasis,
    supplierWarehouse,
  ]);

  const purchaseAmount =
    purchasePrice !== null && finalKg > 0 ? purchasePrice * finalKg : null;
  const saleAmount =
    salePrice !== null && finalKg > 0 ? salePrice * finalKg : null;

  const profit = useMemo(() => {
    if (
      purchaseAmount !== null &&
      saleAmount !== null &&
      deliveryCost !== null
    ) {
      return saleAmount - purchaseAmount - deliveryCost;
    }
    if (purchaseAmount !== null && saleAmount !== null) {
      return saleAmount - purchaseAmount;
    }
    return null;
  }, [purchaseAmount, saleAmount, deliveryCost]);

  const deliveryTariff =
    deliveryCost && finalKg > 0 ? deliveryCost / finalKg : null;

  // Логика проверки объема по договору
  const contractVolumeStatus = useContractVolume({
    priceId: parsePriceCompositeId(selectedSalePriceId).priceId,
    currentQuantityKg: finalKg,
    isEditing: isEditing,
    mode: "opt",
  });

  // Логика проверки объема по договору поставщика
  const supplierContractVolumeStatus = useContractVolume({
    priceId: parsePriceCompositeId(selectedPurchasePriceId).priceId,
    currentQuantityKg: finalKg,
    isEditing: isEditing,
    mode: "opt",
  });

  const warehouseBalanceAtDate = useMemo(() => {
    if (!isWarehouseSupplier || !supplierWarehouse) return null;
    return historicalBalance ? parseFloat(historicalBalance) : 0;
  }, [isWarehouseSupplier, supplierWarehouse, historicalBalance]);

  return {
    calculatedKg,
    finalKg,
    purchasePrice,
    salePrice,
    deliveryCost,
    purchaseAmount,
    saleAmount,
    profit,
    deliveryTariff,
    contractVolumeStatus,
    supplierContractVolumeStatus,
    warehouseBalanceAtDate,
  };
}
