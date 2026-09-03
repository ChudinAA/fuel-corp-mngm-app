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
  isPvkjRecharge?: boolean;
  setSalePriceZero?: boolean;
  equipmentType?: string;
  selectedEquipmentId?: string;
  equipmentBalance?: number;
  /** Включено ли агентское вознаграждение в экономику сделки */
  isAgentFeeEnabled?: boolean;
  /** Включена ли прочая услуга в экономику сделки */
  isOtherServiceEnabled?: boolean;
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
  isPvkjRecharge = false,
  setSalePriceZero = false,
  equipmentType = EQUIPMENT_TYPE.COMMON,
  selectedEquipmentId,
  equipmentBalance = 0,
  isAgentFeeEnabled = true,
  isOtherServiceEnabled = true,
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

  // Если поставщик задал basis-specific pvkjPrice, используем его напрямую (как для SERVICE)
  const hasBasisPvkjPrice = useMemo(() => {
    if (productType !== PRODUCT_TYPE.PVKJ || !selectedBasisId || !selectedSupplier?.basisPrices) return false;
    const bp = selectedSupplier.basisPrices.find((b) => b.basisId === selectedBasisId);
    return !!(bp?.pvkjPrice);
  }, [productType, selectedBasisId, selectedSupplier]);

  const purchasePrice = useMemo(() => {
    // LIK mode: cost comes from the selected equipment (СЗ) average cost at refueling date
    // (не применяется для SERVICE и для PVKJ с basis price)
    if (isLikMode && productType !== PRODUCT_TYPE.SERVICE && !hasBasisPvkjPrice) {
      return equipmentPriceAtDate !== null ? equipmentPriceAtDate : extractedPurchasePrice;
    }
    // Warehouse supplier override (не применяется для SERVICE и PVKJ с basis price)
    if (isWarehouseSupplier && productType !== PRODUCT_TYPE.SERVICE && !hasBasisPvkjPrice) {
      return warehousePriceAtDate !== null ? warehousePriceAtDate : extractedPurchasePrice;
    }
    return extractedPurchasePrice;
  }, [isLikMode, isWarehouseSupplier, productType, hasBasisPvkjPrice, equipmentPriceAtDate, warehousePriceAtDate, extractedPurchasePrice]);

  const salePrice = useMemo(() => {
    if (setSalePriceZero && productType === PRODUCT_TYPE.SERVICE) {
      return 0;
    }
    if (isPriceRecharge && productType === PRODUCT_TYPE.SERVICE) {
      return purchasePrice;
    }
    if (isPvkjRecharge && productType === PRODUCT_TYPE.PVKJ) {
      return purchasePrice;
    }
    return extractedSalePrice;
  }, [setSalePriceZero, isPriceRecharge, isPvkjRecharge, productType, purchasePrice, extractedSalePrice]);

  const purchaseAmount =
    purchasePrice !== null && finalKg > 0 ? purchasePrice * finalKg : null;
  const saleAmount =
    salePrice !== null && finalKg > 0 ? salePrice * finalKg : null;

  // agentFeeRate — ставка ₽/кг из настроек базиса (для отображения и сохранения в сделку)
  const agentFeeRate = useMemo(() => {
    if (selectedBasisId && selectedSupplier?.basisPrices) {
      const basisPrice = selectedSupplier.basisPrices.find(
        (bp) => bp.basisId === selectedBasisId
      );
      if (basisPrice?.agentFee) return parseFloat(basisPrice.agentFee);
    }
    return 0;
  }, [selectedSupplier, selectedBasisId]);

  // agentFee — итоговая сумма агентского вознаграждения (ставка × кг)
  const agentFee = useMemo(() => {
    return agentFeeRate > 0 && finalKg > 0 ? agentFeeRate * finalKg : 0;
  }, [agentFeeRate, finalKg]);

  // Флаг: настроена ли "Прочая услуга" для выбранного базиса (для немедленного отображения)
  const hasOtherService = useMemo(() => {
    if (!selectedBasisId || !selectedSupplier?.basisPrices) return false;
    const bp = selectedSupplier.basisPrices.find((b) => b.basisId === selectedBasisId);
    return !!(bp?.otherServiceType && bp?.otherServiceValue);
  }, [selectedSupplier, selectedBasisId]);

  // Данные прочей услуги из настроек базиса поставщика
  const otherServiceBasisData = useMemo(() => {
    if (!selectedBasisId || !selectedSupplier?.basisPrices) return null;
    const bp = selectedSupplier.basisPrices.find((b) => b.basisId === selectedBasisId);
    if (!bp?.otherServiceType || !bp?.otherServiceValue) return null;
    return bp;
  }, [selectedSupplier, selectedBasisId]);

  const otherServiceName = useMemo(() => {
    return (otherServiceBasisData as any)?.otherServiceName || null;
  }, [otherServiceBasisData]);

  const otherServiceType = useMemo(() => {
    return otherServiceBasisData?.otherServiceType || null;
  }, [otherServiceBasisData]);

  const otherServiceQuantity = useMemo(() => {
    return (otherServiceBasisData as any)?.otherServiceQuantity || null;
  }, [otherServiceBasisData]);

  const otherServiceFee = useMemo(() => {
    if (!otherServiceBasisData) return 0;
    const val = parseFloat(otherServiceBasisData.otherServiceValue!);
    if (isNaN(val) || val <= 0) return 0;
    if (otherServiceBasisData.otherServiceType === "royalty_per_ton") return finalKg > 0 ? val * (finalKg / 1000) : 0;
    if (otherServiceBasisData.otherServiceType === "percent_of_amount") return (saleAmount !== null && saleAmount > 0) ? saleAmount * val / 100 : 0;
    if (otherServiceBasisData.otherServiceType === "fixed") {
      const qty = otherServiceQuantity ? parseFloat(otherServiceQuantity) : 1;
      return val * (isNaN(qty) || qty <= 0 ? 1 : qty);
    }
    return 0;
  }, [otherServiceBasisData, otherServiceQuantity, finalKg, saleAmount]);

  const isRechargeActive = (isPriceRecharge && productType === PRODUCT_TYPE.SERVICE) ||
    (isPvkjRecharge && productType === PRODUCT_TYPE.PVKJ);

  // Эффективные суммы с учётом чекбоксов включения
  const effectiveAgentFee = isRechargeActive ? 0 : (isAgentFeeEnabled ? agentFee : 0);
  const effectiveOtherServiceFee = isRechargeActive ? 0 : (isOtherServiceEnabled ? otherServiceFee : 0);

  const profit =
    purchaseAmount !== null && saleAmount !== null
      ? isRechargeActive
        ? 0
        : saleAmount - purchaseAmount - effectiveAgentFee - effectiveOtherServiceFee
      : null;

  const getWarehouseStatus = (): {
    status: "ok" | "warning" | "error";
    message: string;
  } => {
    if (productType === PRODUCT_TYPE.SERVICE) {
      return { status: "ok", message: "—" };
    }

    // Если для ПВКЖ задана цена поставщика — склад не используется как источник
    if (productType === PRODUCT_TYPE.PVKJ && hasBasisPvkjPrice) {
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
    currentDealAmount: saleAmount ?? 0,
    initialDealAmount: (salePrice ?? 0) * initialQuantityKg,
  });

  // Логика проверки объема по договору поставщика
  const supplierContractVolumeStatus = useContractVolume({
    priceId: parsePriceCompositeId(selectedPurchasePriceId).priceId,
    currentQuantityKg: finalKg,
    initialQuantityKg: initialQuantityKg,
    mode: "refueling",
    currentDealAmount: purchaseAmount ?? 0,
    initialDealAmount: (purchasePrice ?? 0) * initialQuantityKg,
  });

  return {
    calculatedKg,
    finalKg,
    purchasePrice,
    salePrice,
    purchaseAmount,
    saleAmount,
    agentFee,
    agentFeeRate,
    otherServiceFee,
    hasOtherService,
    otherServiceName,
    otherServiceType,
    otherServiceQuantity,
    profit,
    warehouseStatus,
    contractVolumeStatus,
    supplierContractVolumeStatus,
  };
}
