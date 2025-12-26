
import { useMemo } from "react";
import type { Price, Supplier, Warehouse } from "@shared/schema";

interface UsePriceExtractionProps {
  purchasePrices: Price[];
  salePrices: Price[];
  selectedPurchasePriceId: string;
  selectedSalePriceId: string;
  isWarehouseSupplier: boolean;
  supplierWarehouse?: Warehouse;
  selectedSupplier?: Supplier;
  productType?: string;
}

export function usePriceExtraction({
  purchasePrices,
  salePrices,
  selectedPurchasePriceId,
  selectedSalePriceId,
  isWarehouseSupplier,
  supplierWarehouse,
  selectedSupplier,
  productType,
}: UsePriceExtractionProps) {
  const purchasePrice = useMemo((): number | null => {
    // Для услуги заправки - сначала проверяем service_price у поставщика
    if (productType === "service") {
      if (selectedSupplier?.servicePrice) {
        return parseFloat(selectedSupplier.servicePrice);
      }
    }

    // Для ПВКЖ со склада
    if (productType === "pvkj" && isWarehouseSupplier && supplierWarehouse) {
      return parseFloat(supplierWarehouse.pvkjAverageCost || "0");
    }

    // Для керосина со склада
    if (isWarehouseSupplier && supplierWarehouse && productType !== "service") {
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
  }, [purchasePrices, selectedPurchasePriceId, isWarehouseSupplier, supplierWarehouse, selectedSupplier, productType]);

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

  return {
    purchasePrice,
    salePrice,
  };
}
