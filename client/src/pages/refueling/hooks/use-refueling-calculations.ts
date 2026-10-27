import { useMemo } from "react";
import type { Supplier, Warehouse, Price } from "@shared/schema";
import { EQUIPMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { usePriceExtraction } from "../../shared/hooks/use-price-extraction";
import { parsePriceCompositeId } from "@/pages/shared/utils/price-utils";
import { useContractVolume } from "@/pages/shared/hooks/use-contract-volume";
import { useWarehouseBalance } from "@/hooks/use-warehouse-balance";
import { useEquipmentBalance } from "@/hooks/use-equipment-balance";
import { formatTonnes, kilogramsToTonnes } from "@shared/units";
import { normalizeCurrencyForDisplay } from "../utils";
import {
  calculateRefuelingAmount,
  calculateRefuelingMassTonnes,
  calculateRefuelingPricePerTonne,
  refuelingTonnesToLegacyKg,
  type RefuelingPriceUnit,
} from "../unit-calculations";

interface UseRefuelingCalculationsProps {
  inputMode: "liters" | "tonnes";
  quantityLiters: string;
  density: string;
  quantityTonnes: string;
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
  initialQuantityLiters?: number;
  initialPurchaseAmount?: number;
  initialSaleAmount?: number;
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
  quantityTonnes,
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
  initialQuantityLiters = 0,
  initialPurchaseAmount = 0,
  initialSaleAmount = 0,
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
  const quantityInput = inputMode === "liters" ? quantityLiters : quantityTonnes;
  const finalTonnes =
    calculateRefuelingMassTonnes(inputMode, quantityInput, density) ?? 0;
  const finalKg = refuelingTonnesToLegacyKg(finalTonnes);
  const calculatedKg = finalTonnes > 0 ? String(finalKg) : "";
  const initialQuantityTonnes = kilogramsToTonnes(
    Math.max(0, Number.isFinite(initialQuantityKg) ? initialQuantityKg : 0),
  );
  const currentContractQuantity =
    inputMode === "liters"
      ? Number.parseFloat(quantityLiters || "0") || 0
      : finalKg;
  const initialContractQuantity =
    inputMode === "liters" ? initialQuantityLiters : initialQuantityKg;

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
    
    const histKg = warehouseData && typeof warehouseData === 'object' && 'balance' in warehouseData
      ? parseFloat(warehouseData.balance)
      : parseFloat(productType === PRODUCT_TYPE.PVKJ ? supplierWarehouse?.pvkjBalance || "0" : supplierWarehouse?.currentBalance || "0");
      
    const currKg = currentWarehouseData && typeof currentWarehouseData === 'object' && 'balance' in currentWarehouseData
      ? parseFloat(currentWarehouseData.balance)
      : parseFloat(productType === PRODUCT_TYPE.PVKJ ? supplierWarehouse?.pvkjBalance || "0" : supplierWarehouse?.currentBalance || "0");

    const safeHistKg = Number.isFinite(histKg) ? Math.max(0, histKg) : 0;
    const safeCurrKg = Number.isFinite(currKg) ? Math.max(0, currKg) : 0;
    const baseBalanceTonnes = kilogramsToTonnes(
      Math.min(safeHistKg, safeCurrKg),
    );
    return isEditing
      ? baseBalanceTonnes + initialQuantityTonnes
      : baseBalanceTonnes;
  }, [warehouseData, currentWarehouseData, isHistoricalLoading, isCurrentLoading, isEditing, initialQuantityTonnes, supplierWarehouse, productType]);

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

  const isRechargeActive =
    (isPriceRecharge && productType === PRODUCT_TYPE.SERVICE) ||
    (isPvkjRecharge && productType === PRODUCT_TYPE.PVKJ);

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

  const purchasePriceUnit: RefuelingPriceUnit =
    (isLikMode && productType !== PRODUCT_TYPE.SERVICE && !hasBasisPvkjPrice) ||
    (isWarehouseSupplier &&
      productType !== PRODUCT_TYPE.SERVICE &&
      !hasBasisPvkjPrice) ||
    productType === PRODUCT_TYPE.SERVICE ||
    hasBasisPvkjPrice
      ? "kg"
      : inputMode === "liters"
        ? "liter"
        : "kg";
  const salePriceUnit: RefuelingPriceUnit = isRechargeActive
    ? purchasePriceUnit
    : inputMode === "liters"
      ? "liter"
      : "kg";

  const purchasePricePerTonne = calculateRefuelingPricePerTonne(
    purchasePrice,
    inputMode,
    density,
    purchasePriceUnit,
  );
  const salePricePerTonne = calculateRefuelingPricePerTonne(
    salePrice,
    inputMode,
    density,
    salePriceUnit,
  );
  const purchaseAmount = calculateRefuelingAmount(
    purchasePricePerTonne,
    finalTonnes,
  );
  const baseSaleAmount = calculateRefuelingAmount(
    salePricePerTonne,
    finalTonnes,
  );

  // Legacy agentFeeRate is stored as ₽/кг; calculations and UI use ₽/т.
  const agentFeeRate = useMemo(() => {
    if (selectedBasisId && selectedSupplier?.basisPrices) {
      const basisPrice = selectedSupplier.basisPrices.find(
        (bp) => bp.basisId === selectedBasisId
      );
      if (basisPrice?.agentFee) return parseFloat(basisPrice.agentFee);
    }
    return 0;
  }, [selectedSupplier, selectedBasisId]);

  const agentFeeRatePerTonne = calculateRefuelingPricePerTonne(
    agentFeeRate,
    "tonnes",
    density,
    "kg",
  ) ?? 0;

  const agentFee = useMemo(() => {
    return agentFeeRatePerTonne > 0 && finalTonnes > 0
      ? agentFeeRatePerTonne * finalTonnes
      : 0;
  }, [agentFeeRatePerTonne, finalTonnes]);

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
    if (otherServiceBasisData.otherServiceType === "royalty_per_ton") return finalTonnes > 0 ? val * finalTonnes : 0;
    if (otherServiceBasisData.otherServiceType === "percent_of_amount") return (baseSaleAmount !== null && baseSaleAmount > 0) ? baseSaleAmount * val / 100 : 0;
    if (otherServiceBasisData.otherServiceType === "fixed") {
      const qty = otherServiceQuantity ? parseFloat(otherServiceQuantity) : 1;
      return val * (isNaN(qty) || qty <= 0 ? 1 : qty);
    }
    return 0;
  }, [otherServiceBasisData, otherServiceQuantity, finalTonnes, baseSaleAmount]);

  // Эффективные суммы с учётом чекбоксов включения
  const effectiveAgentFee = isAgentFeeEnabled ? agentFee : 0;
  const effectiveOtherServiceFee = isOtherServiceEnabled ? otherServiceFee : 0;
  const saleAmount =
    baseSaleAmount !== null
      ? baseSaleAmount +
        (isRechargeActive
          ? effectiveAgentFee + effectiveOtherServiceFee
          : 0)
      : null;

  const rawProfit =
    purchaseAmount !== null && saleAmount !== null
      ? saleAmount - purchaseAmount - effectiveAgentFee - effectiveOtherServiceFee
      : null;
  const profit =
    rawProfit === null ? null : normalizeCurrencyForDisplay(rawProfit, 2);

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
      const likBalanceTonnes = kilogramsToTonnes(
        Math.max(0, Number.isFinite(equipmentBalance) ? equipmentBalance : 0),
      );
      const availableTonnes = isEditing
        ? likBalanceTonnes + initialQuantityTonnes
        : likBalanceTonnes;
      if (!selectedEquipmentId) {
        if (finalTonnes <= 0) {
          return { status: "ok", message: "Выберите ТЗК" };
        }
        return { status: "error", message: "Выберите ТЗК" };
      }
      if (finalTonnes <= 0) {
        return { status: "ok", message: `${formatTonnes(availableTonnes)} т` };
      }
      const likRemaining = availableTonnes - finalTonnes;
      if (likRemaining >= 0) {
        return { status: "ok", message: `ОК: ${formatTonnes(likRemaining)} т` };
      } else {
        return {
          status: "error",
          message: `Недостаточно на ТЗК! Доступно: ${formatTonnes(availableTonnes)} т`,
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

    if (finalTonnes <= 0) {
      return { status: "ok", message: `${formatTonnes(availableBalance)} т` };
    }
    
    const remaining = availableBalance - finalTonnes;

    if (remaining >= 0) {
      return { status: "ok", message: `ОК: ${formatTonnes(remaining)} т` };
    } else {
      return {
        status: "error",
        message: `Недостаточно! Доступно: ${formatTonnes(availableBalance)} т`,
      };
    }
  };

  const warehouseStatus = getWarehouseStatus();

  // Логика проверки объема по договору
  const contractVolumeStatus = useContractVolume({
    priceId: parsePriceCompositeId(selectedSalePriceId).priceId,
    currentQuantityKg: currentContractQuantity,
    initialQuantityKg: initialContractQuantity,
    mode: "refueling",
    currentDealAmount: saleAmount ?? 0,
    initialDealAmount: initialSaleAmount,
    displayUnit: inputMode === "liters" ? "liters" : "tonnes",
  });

  // Логика проверки объема по договору поставщика
  const supplierContractVolumeStatus = useContractVolume({
    priceId: parsePriceCompositeId(selectedPurchasePriceId).priceId,
    currentQuantityKg: currentContractQuantity,
    initialQuantityKg: initialContractQuantity,
    mode: "refueling",
    currentDealAmount: purchaseAmount ?? 0,
    initialDealAmount: initialPurchaseAmount,
    displayUnit: inputMode === "liters" ? "liters" : "tonnes",
  });

  return {
    calculatedKg,
    finalKg,
    finalTonnes,
    purchasePrice,
    salePrice,
    purchasePriceUnit,
    salePriceUnit,
    purchasePricePerTonne,
    salePricePerTonne,
    purchaseAmount,
    saleAmount,
    isRechargeActive,
    agentFee,
    agentFeeRate,
    agentFeeRatePerTonne,
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
