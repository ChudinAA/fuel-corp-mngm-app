
import { useMemo } from "react";
import type { Price, Warehouse, DeliveryCost, Base } from "@shared/schema";
import { ENTITY_TYPE } from "@shared/constants";

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
}: UseOptCalculationsProps) {
  // Вычисление КГ
  const calculatedKg = useMemo(() => {
    if (inputMode === "liters" && quantityLiters && density) {
      return (parseFloat(quantityLiters) * parseFloat(density)).toFixed(2);
    }
    return quantityKg || "0";
  }, [inputMode, quantityLiters, density, quantityKg]);

  const finalKg = parseFloat(calculatedKg || "0");

  // Получение цены покупки
  const purchasePrice = useMemo((): number | null => {
    if (isWarehouseSupplier && supplierWarehouse) {
      return parseFloat(supplierWarehouse.averageCost || "0");
    }

    if (purchasePrices.length === 0) return null;

    let selectedPrice = purchasePrices[0];
    let selectedIndex = 0;

    if (selectedPurchasePriceId) {
      const parts = selectedPurchasePriceId.split('-');
      if (parts.length >= 5) {
        const priceId = parts.slice(0, -1).join('-');
        selectedIndex = parseInt(parts[parts.length - 1]);
        const found = purchasePrices.find(p => p.id === priceId);
        if (found) selectedPrice = found;
      }
    }

    if (selectedPrice?.priceValues && selectedPrice.priceValues.length > selectedIndex) {
      try {
        const priceObj = JSON.parse(selectedPrice.priceValues[selectedIndex]);
        return parseFloat(priceObj.price || "0");
      } catch {
        return null;
      }
    }

    return null;
  }, [isWarehouseSupplier, supplierWarehouse, purchasePrices, selectedPurchasePriceId]);

  // Получение цены продажи
  const salePrice = useMemo((): number | null => {
    if (salePrices.length === 0) return null;

    let selectedPrice = salePrices[0];
    let selectedIndex = 0;

    if (selectedSalePriceId) {
      const parts = selectedSalePriceId.split('-');
      if (parts.length >= 5) {
        const priceId = parts.slice(0, -1).join('-');
        selectedIndex = parseInt(parts[parts.length - 1]);
        const found = salePrices.find(p => p.id === priceId);
        if (found) selectedPrice = found;
      }
    }

    if (selectedPrice?.priceValues && selectedPrice.priceValues.length > selectedIndex) {
      try {
        const priceObj = JSON.parse(selectedPrice.priceValues[selectedIndex]);
        return parseFloat(priceObj.price || "0");
      } catch {
        return null;
      }
    }
    return null;
  }, [salePrices, selectedSalePriceId]);

  // Получение стоимости доставки
  const deliveryCost = useMemo((): number | null => {
    if (!deliveryLocationId || !carrierId || !deliveryCosts || !finalKg || finalKg <= 0) {
      return null;
    }

    const base = bases?.find(b => b.name === selectedBasis);
    const warehouse = supplierWarehouse;

    const cost = deliveryCosts.find(dc => {
      const matchesCarrier = dc.carrierId === carrierId;
      const matchesDestination = dc.toEntityType === ENTITY_TYPE.DELIVERY_LOCATION && dc.toEntityId === deliveryLocationId;

      let matchesSource = false;
      if (warehouse && dc.fromEntityType === ENTITY_TYPE.WAREHOUSE && dc.fromEntityId === warehouse.id) {
        matchesSource = true;
      } else if (base && dc.fromEntityType === ENTITY_TYPE.BASE && dc.fromEntityId === base.id) {
        matchesSource = true;
      }

      return matchesCarrier && matchesDestination && matchesSource && dc.isActive;
    });

    if (cost?.costPerKg) {
      return parseFloat(cost.costPerKg) * finalKg;
    }

    return null;
  }, [deliveryLocationId, carrierId, deliveryCosts, finalKg, bases, selectedBasis, supplierWarehouse]);

  const purchaseAmount = purchasePrice !== null && finalKg > 0 ? purchasePrice * finalKg : null;
  const saleAmount = salePrice !== null && finalKg > 0 ? salePrice * finalKg : null;

  const profit = useMemo(() => {
    if (purchaseAmount !== null && saleAmount !== null && deliveryCost !== null) {
      return saleAmount - purchaseAmount - deliveryCost;
    }
    if (purchaseAmount !== null && saleAmount !== null) {
      return saleAmount - purchaseAmount;
    }
    return null;
  }, [purchaseAmount, saleAmount, deliveryCost]);

  const deliveryTariff = deliveryCost && finalKg > 0 ? deliveryCost / finalKg : null;

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
  };
}
