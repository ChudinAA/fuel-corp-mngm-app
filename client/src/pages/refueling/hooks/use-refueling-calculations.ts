import { useMemo } from "react";
import type { Supplier, Warehouse, Price } from "@shared/schema";
import { EQUIPMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { useQuantityCalculation } from "../../shared/hooks/use-quantity-calculation";
import { usePriceExtraction } from "../../shared/hooks/use-price-extraction";
import { parsePriceCompositeId } from "@/pages/shared/utils/price-utils";
import { useContractVolume } from "@/pages/shared/hooks/use-contract-volume";
import { useWarehouseBalance } from "@/hooks/use-warehouse-balance";
import { useEquipmentBalance } from "@/hooks/use-equipment-balance";
import { formatNumber } from "../utils";

interface UseRefuelingCalculationsProps {
  inputMode: "liters" | "kg";
  quantityLiters: string;
  density: string;
  quantityKg: string;
  isWarehouseSupplier: boolean;
  supplierWarehouse: Warehouse | undefined;
  selectedBasis: string;
  selectedBasisId?: string;
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
  equipmentType?: string;
  selectedEquipmentId?: string;
  equipmentBalance?: number;
}

export function useRefuelingCalculations({
  inputMode,
  quantityLiters,
  density,
  quantityKg,
  isWarehouseSupplier,
  supplierWarehouse,
  selectedBasis,
  selectedBasisId,
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
  equipmentType = EQUIPMENT_TYPE.COMMON,
  selectedEquipmentId,
  equipmentBalance = 0,
}: UseRefuelingCalculationsProps) {
  const { calculatedKg, finalKg } = useQuantityCalculation({
    inputMode,
    quantityLiters,
    density,
    quantityKg,
  });

  const isLikMode = equipmentType === EQUIPMENT_TYPE.LIK;

  const { data: warehouseData, isLoading: isHistoricalLoading } = useWarehouseBalance(
    isWarehouseSupplier && !isLikMode ? supplierWarehouse?.id : undefined,
    refuelingDate,
    productType
  );

  const { data: currentWarehouseData, isLoading: isCurrentLoading } = useWarehouseBalance(
    isWarehouseSupplier && !isLikMode ? supplierWarehouse?.id : undefined,
    new Date(),
    productType
  );

  // For LIK mode: fetch equipment cost at refueling date
  const { data: equipmentData, isLoading: isEquipmentLoading } = useEquipmentBalance(
    isLikMode ? selectedEquipmentId : undefined,
    refuelingDate,
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
    basisId: selectedBasisId,
  });

  // Equipment (СЗ) average cost at the refueling date
  const equipmentPriceAtDate = useMemo(() => {
    if (!isLikMode || isEquipmentLoading) return null;
    return equipmentData && typeof equipmentData === "object" && "averageCost" in equipmentData
      ? (equipmentData.averageCost ? parseFloat(equipmentData.averageCost as string) : null)
      : null;
  }, [isLikMode, equipmentData, isEquipmentLoading]);

  const purchasePrice = useMemo(() => {
    // LIK mode: cost comes from the selected equipment (СЗ) average cost at refueling date
    if (isLikMode && productType !== PRODUCT_TYPE.SERVICE) {
      return equipmentPriceAtDate !== null ? equipmentPriceAtDate : extractedPurchasePrice;
    }
    if (isWarehouseSupplier && productType !== PRODUCT_TYPE.SERVICE) {
      return warehousePriceAtDate !== null ? warehousePriceAtDate : extractedPurchasePrice;
    }
    return extractedPurchasePrice;
  }, [isLikMode, isWarehouseSupplier, productType, equipmentPriceAtDate, warehousePriceAtDate, extractedPurchasePrice]);

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

  const agentFee = useMemo(() => {
    if (selectedBasisId && selectedSupplier?.basisPrices) {
      const basisPrice = selectedSupplier.basisPrices.find(
        (bp) => bp.basisId === selectedBasisId
      );
      if (basisPrice?.agentFee) return parseFloat(basisPrice.agentFee);
    }
    return 0;
  }, [selectedSupplier, selectedBasisId]);

  const otherServiceFee = useMemo(() => {
    if (selectedBasisId && selectedSupplier?.basisPrices && finalKg > 0) {
      const bp = selectedSupplier.basisPrices.find((b) => b.basisId === selectedBasisId);
      if (!bp?.otherServiceType || !bp?.otherServiceValue) return 0;
      const val = parseFloat(bp.otherServiceValue);
      if (isNaN(val) || val <= 0) return 0;
      if (bp.otherServiceType === "royalty_per_ton") return val * (finalKg / 1000);
      if (bp.otherServiceType === "percent_of_amount" && saleAmount !== null) return saleAmount * val / 100;
      if (bp.otherServiceType === "fixed") return val;
    }
    return 0;
  }, [selectedSupplier, selectedBasisId, finalKg, saleAmount]);

  const profit =
    purchaseAmount !== null && saleAmount !== null
      ? (isPriceRecharge && productType === PRODUCT_TYPE.SERVICE) ? 0 : saleAmount - purchaseAmount - agentFee - otherServiceFee
      : null;

  const getWarehouseStatus = (): {
    status: "ok" | "warning" | "error";
    message: string;
  } => {
    if (productType === PRODUCT_TYPE.SERVICE) {
      return { status: "ok", message: "—" };
    }

    if (equipmentType === EQUIPMENT_TYPE.LIK) {
      if (!selectedEquipmentId) {
        if (finalKg <= 0) {
          return { status: "ok", message: "Выберите ТЗК" };
        }
        return { status: "error", message: "Выберите ТЗК" };
      }
      const likBalance = isEditing ? equipmentBalance + initialQuantityKg : equipmentBalance;
      if (finalKg <= 0) {
        return { status: "ok", message: `${formatNumber(likBalance)} кг` };
      }
      const likRemaining = likBalance - finalKg;
      if (likRemaining >= 0) {
        return { status: "ok", message: `ОК: ${likRemaining.toFixed(2)} кг` };
      } else {
        return {
          status: "error",
          message: `Недостаточно на ТЗК! Доступно: ${likBalance.toFixed(2)} кг`,
        };
      }
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
    otherServiceFee,
    profit,
    warehouseStatus,
    contractVolumeStatus,
    supplierContractVolumeStatus,
  };
}
