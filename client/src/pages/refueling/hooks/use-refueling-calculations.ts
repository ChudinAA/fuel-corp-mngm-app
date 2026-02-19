import { useMemo } from "react";
import type { Supplier, Warehouse, Price } from "@shared/schema";
import { PRODUCT_TYPE } from "@shared/constants";
import { useQuantityCalculation } from "../../shared/hooks/use-quantity-calculation";
import { usePriceExtraction } from "../../shared/hooks/use-price-extraction";
import { parsePriceCompositeId } from "@/pages/shared/utils/price-utils";
import { useContractVolume } from "@/pages/shared/hooks/use-contract-volume";
import { useWarehouseBalance } from "@/hooks/use-warehouse-balance";
import { formatNumber } from "../utils";

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
  initialQuantityKg?: number;
  initialWarehouseBalance: number;
  refuelingDate?: Date;
  isPriceRecharge?: boolean;
}

export function useRefuelingCalculations({
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
  selectedSupplier,
  productType,
  isEditing,
  initialQuantityKg = 0,
  initialWarehouseBalance,
  refuelingDate,
  isPriceRecharge = false,
}: UseRefuelingCalculationsProps) {
  const { calculatedKg, finalKg } = useQuantityCalculation({
    inputMode,
    quantityLiters,
    density,
    quantityKg,
  });

  const { data: warehouseData, isLoading: isHistoricalLoading } = useWarehouseBalance(
    isWarehouseSupplier ? supplierWarehouse?.id : undefined,
    refuelingDate,
    productType
  );

  const { data: currentWarehouseData, isLoading: isCurrentLoading } = useWarehouseBalance(
    isWarehouseSupplier ? supplierWarehouse?.id : undefined,
    new Date(),
    productType
  );

  const warehouseBalanceAtDate = useMemo(() => {
    if (isHistoricalLoading || isCurrentLoading) return null;
    
    const hist = warehouseData && typeof warehouseData === 'object' && 'balance' in warehouseData
      ? parseFloat(warehouseData.balance)
      : parseFloat(productType === PRODUCT_TYPE.PVKJ ? supplierWarehouse?.pvkjBalance || "0" : supplierWarehouse?.currentBalance || "0");
      
    const curr = currentWarehouseData && typeof currentWarehouseData === 'object' && 'balance' in currentWarehouseData
      ? parseFloat(currentWarehouseData.balance)
      : parseFloat(productType === PRODUCT_TYPE.PVKJ ? supplierWarehouse?.pvkjBalance || "0" : supplierWarehouse?.currentBalance || "0");

    const baseBalance = Math.min(hist, curr);
    return isEditing ? baseBalance + initialQuantityKg : baseBalance;
  }, [warehouseData, currentWarehouseData, isHistoricalLoading, isCurrentLoading, isEditing, initialQuantityKg, supplierWarehouse, productType]);

  const warehousePriceAtDate = useMemo(() => {
    if (isHistoricalLoading) return null;
    return warehouseData && typeof warehouseData === 'object' && 'averageCost' in warehouseData 
      ? (warehouseData.averageCost ? parseFloat(warehouseData.averageCost) : null) 
      : null;
  }, [warehouseData, isHistoricalLoading]);

  const isBalanceLoading = isHistoricalLoading || isCurrentLoading;

  const { purchasePrice: extractedPurchasePrice, salePrice: extractedSalePrice } = usePriceExtraction({
    purchasePrices,
    salePrices,
    selectedPurchasePriceId,
    selectedSalePriceId,
    isWarehouseSupplier,
    supplierWarehouse,
    selectedSupplier,
    productType,
  });

  const purchasePrice = useMemo(() => {
    if (isWarehouseSupplier && productType !== PRODUCT_TYPE.SERVICE) {
      return warehousePriceAtDate !== null ? warehousePriceAtDate : extractedPurchasePrice;
    }
    return extractedPurchasePrice;
  }, [isWarehouseSupplier, productType, warehousePriceAtDate, extractedPurchasePrice, selectedSupplier]);

  const salePrice = useMemo(() => {
    if (isPriceRecharge && productType === PRODUCT_TYPE.SERVICE) {
      return purchasePrice;
    }
    return extractedSalePrice;
  }, [isPriceRecharge, productType, purchasePrice, extractedSalePrice]);

  const purchaseAmount =
    purchasePrice !== null && finalKg > 0 ? purchasePrice * finalKg : null;
  const saleAmount =
    salePrice !== null && finalKg > 0 ? salePrice * finalKg : null;

  const agentFee = selectedSupplier?.agentFee
    ? parseFloat(selectedSupplier.agentFee)
    : 0;

  const profit =
    purchaseAmount !== null && saleAmount !== null
      ? (isPriceRecharge && productType === PRODUCT_TYPE.SERVICE) ? 0 : saleAmount - purchaseAmount - agentFee
      : null;

  const getWarehouseStatus = (): {
    status: "ok" | "warning" | "error";
    message: string;
  } => {
    // Для услуги заправки склад не проверяем
    if (productType === PRODUCT_TYPE.SERVICE) {
      return { status: "ok", message: "—" };
    }

    if (!isWarehouseSupplier) {
      return { status: "ok", message: "Объем не со склада" };
    }

    if (!supplierWarehouse) {
      return { status: "ok", message: "—" };
    }

    if (isBalanceLoading) {
      return { status: "ok", message: "Загрузка..." };
    }

    const availableBalance = warehouseBalanceAtDate !== null ? warehouseBalanceAtDate : 0;

    if (finalKg <= 0) {
      return { status: "ok", message: `${formatNumber(availableBalance)} кг` };
    }
    
    const remaining = availableBalance - finalKg;

    if (remaining >= 0) {
      return { status: "ok", message: `ОК: ${remaining.toFixed(2)} кг` };
    } else {
      return {
        status: "error",
        message: `Недостаточно! Доступно: ${availableBalance.toFixed(2)} кг`,
      };
    }
  };

  const warehouseStatus = getWarehouseStatus();

  // Логика проверки объема по договору
  const contractVolumeStatus = useContractVolume({
    priceId: parsePriceCompositeId(selectedSalePriceId).priceId,
    currentQuantityKg: finalKg,
    initialQuantityKg: initialQuantityKg,
    mode: "refueling",
  });

  // Логика проверки объема по договору поставщика
  const supplierContractVolumeStatus = useContractVolume({
    priceId: parsePriceCompositeId(selectedPurchasePriceId).priceId,
    currentQuantityKg: finalKg,
    initialQuantityKg: initialQuantityKg,
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
    supplierContractVolumeStatus,
  };
}
