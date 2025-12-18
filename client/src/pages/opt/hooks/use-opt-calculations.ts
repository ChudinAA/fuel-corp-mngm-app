
import { useMemo } from "react";

interface UseOptCalculationsParams {
  inputMode: "liters" | "kg";
  quantityLiters?: string;
  density?: string;
  quantityKg?: string;
  selectedPurchasePriceId?: string;
  selectedSalePriceId?: string;
  purchasePrices: any[];
  salePrices: any[];
  deliveryCost: number | null;
  isWarehouseSupplier: boolean;
  warehouseAverageCost?: string | null;
}

export function useOptCalculations(params: UseOptCalculationsParams) {
  const {
    inputMode,
    quantityLiters,
    density,
    quantityKg,
    selectedPurchasePriceId,
    selectedSalePriceId,
    purchasePrices,
    salePrices,
    deliveryCost,
    isWarehouseSupplier,
    warehouseAverageCost,
  } = params;

  const calculatedKg = useMemo(() => {
    if (inputMode === "liters" && quantityLiters && density) {
      return (parseFloat(quantityLiters) * parseFloat(density)).toFixed(2);
    }
    return quantityKg || "0";
  }, [inputMode, quantityLiters, density, quantityKg]);

  const finalKg = parseFloat(calculatedKg || "0");

  const purchasePrice = useMemo(() => {
    if (isWarehouseSupplier && warehouseAverageCost) {
      return parseFloat(warehouseAverageCost);
    }

    if (!selectedPurchasePriceId || purchasePrices.length === 0) {
      return null;
    }

    for (const priceGroup of purchasePrices) {
      const found = priceGroup.values?.find((v: any) => v.compositeId === selectedPurchasePriceId);
      if (found) {
        return parseFloat(found.price);
      }
    }

    return null;
  }, [isWarehouseSupplier, warehouseAverageCost, selectedPurchasePriceId, purchasePrices]);

  const salePrice = useMemo(() => {
    if (!selectedSalePriceId || salePrices.length === 0) {
      return null;
    }

    for (const priceGroup of salePrices) {
      const found = priceGroup.values?.find((v: any) => v.compositeId === selectedSalePriceId);
      if (found) {
        return parseFloat(found.price);
      }
    }

    return null;
  }, [selectedSalePriceId, salePrices]);

  const purchaseAmount = useMemo(() => {
    if (purchasePrice !== null && finalKg > 0) {
      return purchasePrice * finalKg;
    }
    return null;
  }, [purchasePrice, finalKg]);

  const saleAmount = useMemo(() => {
    if (salePrice !== null && finalKg > 0) {
      return salePrice * finalKg;
    }
    return null;
  }, [salePrice, finalKg]);

  const profit = useMemo(() => {
    if (purchaseAmount !== null && saleAmount !== null) {
      const baseProfit = saleAmount - purchaseAmount;
      return deliveryCost !== null ? baseProfit - deliveryCost : baseProfit;
    }
    return null;
  }, [purchaseAmount, saleAmount, deliveryCost]);

  const deliveryTariff = useMemo(() => {
    if (deliveryCost !== null && finalKg > 0) {
      return deliveryCost / finalKg;
    }
    return null;
  }, [deliveryCost, finalKg]);

  return {
    calculatedKg,
    finalKg,
    purchasePrice,
    salePrice,
    purchaseAmount,
    saleAmount,
    deliveryCost,
    deliveryTariff,
    profit,
  };
}
