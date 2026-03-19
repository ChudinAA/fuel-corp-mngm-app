import { useMemo } from "react";
import type { DeliveryCost, Price } from "@shared/schema";
import { DELIVERY_ENTITY_TYPE } from "@shared/constants";
import { useQuantityCalculation } from "@/pages/shared/hooks/use-quantity-calculation";
import { usePriceExtraction } from "@/pages/shared/hooks/use-price-extraction";

interface UseTransportationCalculationsProps {
  inputMode: "liters" | "kg";
  quantityLiters: string;
  density: string;
  quantityKg: string;
  basisId: string;
  purchasePrices: Price[];
  salePrices: Price[];
  selectedPurchasePriceId: string;
  selectedSalePriceId: string;
  deliveryCosts: DeliveryCost[] | undefined;
  carrierId: string;
  deliveryLocationId: string;
  isAviaService: boolean;
  productType: string;
}

export function useTransportationCalculations({
  inputMode,
  quantityLiters,
  density,
  quantityKg,
  basisId,
  purchasePrices,
  salePrices,
  selectedPurchasePriceId,
  selectedSalePriceId,
  deliveryCosts,
  carrierId,
  deliveryLocationId,
  isAviaService,
  productType,
}: UseTransportationCalculationsProps) {
  const { calculatedKg, finalKg } = useQuantityCalculation({
    inputMode,
    quantityLiters,
    density,
    quantityKg,
  });

  const { purchasePrice: extractedPurchasePrice, salePrice: extractedSalePrice } =
    usePriceExtraction({
      purchasePrices,
      salePrices,
      selectedPurchasePriceId,
      selectedSalePriceId,
      isWarehouseSupplier: false,
      supplierWarehouse: undefined,
      productType,
    });

  const purchasePrice = useMemo(() => {
    if (!isAviaService) return 0;
    return extractedPurchasePrice;
  }, [isAviaService, extractedPurchasePrice]);

  const salePrice = extractedSalePrice;

  const deliveryCostFromTariff = useMemo((): number | null => {
    if (isAviaService) return null;
    if (!deliveryLocationId || !carrierId || !deliveryCosts || !finalKg || finalKg <= 0) {
      return null;
    }

    const cost = deliveryCosts.find((dc) => {
      const matchesCarrier = dc.carrierId === carrierId;
      const matchesDestination =
        dc.toEntityType === DELIVERY_ENTITY_TYPE.DELIVERY_LOCATION &&
        dc.toEntityId === deliveryLocationId;
      const matchesSource =
        basisId &&
        dc.fromEntityType === DELIVERY_ENTITY_TYPE.BASE &&
        dc.fromEntityId === basisId;
      return matchesCarrier && matchesDestination && matchesSource && dc.isActive;
    });

    if (cost?.costPerKg) {
      return parseFloat(cost.costPerKg) * finalKg;
    }
    return null;
  }, [isAviaService, deliveryLocationId, carrierId, deliveryCosts, finalKg, basisId]);

  const deliveryCost = isAviaService ? null : deliveryCostFromTariff;

  const deliveryTariff = useMemo(() => {
    if (!deliveryCost || finalKg <= 0) return null;
    return deliveryCost / finalKg;
  }, [deliveryCost, finalKg]);

  const purchaseAmount = useMemo(() => {
    if (!isAviaService) return null;
    if (purchasePrice !== null && finalKg > 0) return purchasePrice * finalKg;
    return null;
  }, [isAviaService, purchasePrice, finalKg]);

  const saleAmount = useMemo(() => {
    if (salePrice !== null && finalKg > 0) return salePrice * finalKg;
    return null;
  }, [salePrice, finalKg]);

  const profit = useMemo(() => {
    if (isAviaService) {
      if (saleAmount !== null && purchaseAmount !== null) {
        return saleAmount - purchaseAmount;
      }
      return null;
    } else {
      if (saleAmount !== null && deliveryCost !== null) {
        return saleAmount - deliveryCost;
      }
      return null;
    }
  }, [isAviaService, saleAmount, purchaseAmount, deliveryCost]);

  return {
    calculatedKg,
    finalKg,
    purchasePrice,
    salePrice,
    deliveryCost,
    deliveryTariff,
    purchaseAmount,
    saleAmount,
    profit,
  };
}
