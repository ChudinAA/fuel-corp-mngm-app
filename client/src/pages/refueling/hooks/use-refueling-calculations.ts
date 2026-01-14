
import { useMemo } from "react";
import type { Supplier, Warehouse, Price } from "@shared/schema";
import { PRODUCT_TYPE } from "@shared/constants";
import { useQuantityCalculation } from "../../shared/hooks/use-quantity-calculation";
import { usePriceExtraction } from "../../shared/hooks/use-price-extraction";
import { parsePriceCompositeId } from "@/pages/shared/utils/price-utils";
import { useContractVolume } from "@/pages/shared/hooks/use-contract-volume";

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
  const { calculatedKg, finalKg } = useQuantityCalculation({
    inputMode,
    quantityLiters,
    density,
    quantityKg,
  });

  const { purchasePrice, salePrice } = usePriceExtraction({
    purchasePrices,
    salePrices,
    selectedPurchasePriceId,
    selectedSalePriceId,
    isWarehouseSupplier,
    supplierWarehouse,
    selectedSupplier,
    productType,
  });

  const purchaseAmount = purchasePrice !== null && finalKg > 0 ? purchasePrice * finalKg : null;
  const saleAmount = salePrice !== null && finalKg > 0 ? salePrice * finalKg : null;

  const agentFee = selectedSupplier?.agentFee ? parseFloat(selectedSupplier.agentFee) : 0;

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

  // Логика проверки объема по договору
  const contractVolumeStatus = useContractVolume({
    priceId: parsePriceCompositeId(selectedSalePriceId).priceId,
    currentQuantityKg: finalKg,
    isEditing: isEditing,
    mode: "refueling",
  });
  
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
    contractVolumeStatus,
  };
}
