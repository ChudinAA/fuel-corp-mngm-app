
import { useMemo } from "react";
import type { Supplier, Warehouse, Price } from "@shared/schema";
import { PRODUCT_TYPE } from "@shared/constants";

interface UseRefuelingCalculationsProps {
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
  selectedSupplier: Supplier | undefined;
  productType: string;
  isEditing: boolean;
  initialWarehouseBalance: number;
}

export function useRefuelingCalculations({
  inputMode,
  quantityLiters,
  density,
  quantityKg,
  isWarehouseSupplier,
  supplierWarehouse,
  purchasePrices,
  salePrices,
  selectedPurchasePriceId,
  selectedSalePriceId,
  selectedSupplier,
  productType,
  isEditing,
  initialWarehouseBalance,
}: UseRefuelingCalculationsProps) {
  const calculatedKg = useMemo(() => {
    if (inputMode === "liters" && quantityLiters && density) {
      return (parseFloat(quantityLiters) * parseFloat(density)).toFixed(2);
    }
    return quantityKg || "0";
  }, [inputMode, quantityLiters, density, quantityKg]);

  const finalKg = parseFloat(calculatedKg || "0");

  const purchasePrice = useMemo((): number | null => {
    // Для услуги заправки - сначала проверяем service_price у поставщика
    if (productType === PRODUCT_TYPE.SERVICE) {
      if (selectedSupplier?.servicePrice) {
        return parseFloat(selectedSupplier.servicePrice);
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

      if (selectedPrice?.priceValues?.[selectedIndex]) {
        try {
          const priceObj = JSON.parse(selectedPrice.priceValues[selectedIndex]);
          return parseFloat(priceObj.price || "0");
        } catch {
          return null;
        }
      }
      return null;
    }

    // Для ПВКЖ
    if (productType === PRODUCT_TYPE.PVKJ) {
      if (isWarehouseSupplier && supplierWarehouse) {
        return parseFloat(supplierWarehouse.pvkjAverageCost || "0");
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

      if (selectedPrice?.priceValues?.[selectedIndex]) {
        try {
          const priceObj = JSON.parse(selectedPrice.priceValues[selectedIndex]);
          return parseFloat(priceObj.price || "0");
        } catch {
          return null;
        }
      }
      return null;
    }

    // Для керосина
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

    if (selectedPrice && selectedPrice.priceValues && selectedPrice.priceValues.length > selectedIndex) {
      try {
        const priceObj = JSON.parse(selectedPrice.priceValues[selectedIndex]);
        return parseFloat(priceObj.price || "0");
      } catch {
        return null;
      }
    }

    return null;
  }, [
    productType,
    selectedSupplier,
    purchasePrices,
    selectedPurchasePriceId,
    isWarehouseSupplier,
    supplierWarehouse,
  ]);

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

    if (selectedPrice && selectedPrice.priceValues && selectedPrice.priceValues.length > selectedIndex) {
      try {
        const priceObj = JSON.parse(selectedPrice.priceValues[selectedIndex]);
        return parseFloat(priceObj.price || "0");
      } catch {
        return null;
      }
    }
    return null;
  }, [salePrices, selectedSalePriceId]);

  const purchaseAmount = purchasePrice !== null && finalKg > 0 ? purchasePrice * finalKg : null;
  const saleAmount = salePrice !== null && finalKg > 0 ? salePrice * finalKg : null;

  const agentFee = selectedSupplier?.agentFee ? parseFloat(selectedSupplier.agentFee) * finalKg : 0;

  const profit = purchaseAmount !== null && saleAmount !== null 
    ? saleAmount - purchaseAmount - agentFee
    : null;

  const getWarehouseStatus = (): { status: "ok" | "warning" | "error"; message: string } => {
    // Для услуги заправки склад не проверяем
    if (productType === PRODUCT_TYPE.SERVICE) {
      return { status: "ok", message: "—" };
    }

    if (!isWarehouseSupplier) {
      return { status: "ok", message: "Объем не со склада" };
    }

    if (!supplierWarehouse || finalKg <= 0) {
      return { status: "ok", message: "—" };
    }

    // Для ПВКЖ проверяем баланс ПВКЖ
    if (productType === PRODUCT_TYPE.PVKJ) {
      const availableBalance = isEditing ? initialWarehouseBalance : parseFloat(supplierWarehouse.pvkjBalance || "0");
      const remaining = availableBalance - finalKg;

      if (remaining >= 0) {
        return { status: "ok", message: `ОК: ${remaining.toFixed(2)} кг` };
      } else {
        return { status: "error", message: `Недостаточно! Доступно: ${availableBalance.toFixed(2)} кг` };
      }
    }

    // Для керосина проверяем обычный баланс
    const availableBalance = isEditing ? initialWarehouseBalance : parseFloat(supplierWarehouse.currentBalance || "0");
    const remaining = availableBalance - finalKg;

    if (remaining >= 0) {
      return { status: "ok", message: `ОК: ${remaining.toFixed(2)} кг` };
    } else {
      return { status: "error", message: `Недостаточно! Доступно: ${availableBalance.toFixed(2)} кг` };
    }
  };

  const warehouseStatus = getWarehouseStatus();

  return {
    calculatedKg,
    finalKg,
    purchasePrice,
    salePrice,
    purchaseAmount,
    saleAmount,
    agentFee,
    profit,
    warehouseStatus,
  };
}
