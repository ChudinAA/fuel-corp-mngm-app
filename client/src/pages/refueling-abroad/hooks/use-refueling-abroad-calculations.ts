import { useMemo } from "react";
import { evaluateCommissionFormula } from "../utils";
import { useQuantityCalculation } from "@/pages/shared/hooks/use-quantity-calculation";
import { Price } from "@shared/schema";
import { usePriceExtraction } from "@/pages/shared/hooks/use-price-extraction";
import { parsePriceCompositeId } from "@/pages/shared/utils/price-utils";
import { useContractVolume } from "@/pages/shared/hooks/use-contract-volume";

interface UseRefuelingAbroadCalculationsProps {
  inputMode: "liters" | "kg";
  quantityLiters: string;
  density: string;
  quantityKg: string;
  purchaseExchangeRate: number;
  saleExchangeRate: number;
  commissionFormula: string;
  manualCommissionUsd: string;
  purchasePrices: Price[];
  salePrices: Price[];
  selectedPurchasePriceId: string;
  selectedSalePriceId: string;
  productType: string;
  initialQuantityKg?: number;
}

export function useRefuelingAbroadCalculations({
  inputMode,
  quantityLiters,
  density,
  quantityKg,
  purchaseExchangeRate,
  saleExchangeRate,
  commissionFormula,
  manualCommissionUsd,
  salePrices,
  purchasePrices,
  selectedPurchasePriceId,
  selectedSalePriceId,
  productType,
  initialQuantityKg = 0,
}: UseRefuelingAbroadCalculationsProps) {
  const { calculatedKg, finalKg } = useQuantityCalculation({
    inputMode,
    quantityLiters,
    density,
    quantityKg,
  });

  const {
    purchasePrice: extractedPurchasePrice,
    salePrice: extractedSalePrice,
  } = usePriceExtraction({
    purchasePrices,
    salePrices,
    selectedPurchasePriceId,
    selectedSalePriceId,
    isWarehouseSupplier: false,
    supplierWarehouse: undefined,
    selectedSupplier: undefined,
    productType,
  });

  const purchasePrice = useMemo(() => {
    // purchasePriceUsd - legacy manual price
    return extractedPurchasePrice;
  }, [extractedPurchasePrice]);

  const salePrice = useMemo(() => {
    // purchasePriceUsd - legacy manual price
    return extractedSalePrice;
  }, [extractedSalePrice]);

  const purchaseAmountUsd = useMemo(() => {
    return purchasePrice !== null && finalKg > 0
      ? purchasePrice * finalKg
      : null;
  }, [purchasePrice, finalKg]);

  const saleAmountUsd = useMemo(() => {
    return salePrice !== null && finalKg > 0 ? salePrice * finalKg : null;
  }, [salePrice, finalKg]);

  const commissionUsd = useMemo(() => {
    if (manualCommissionUsd && manualCommissionUsd.trim() !== "") {
      const manual = parseFloat(manualCommissionUsd);
      if (!isNaN(manual)) return manual;
    }

    if (commissionFormula && commissionFormula.trim() !== "") {
      const calculated = evaluateCommissionFormula(commissionFormula, {
        purchasePrice: purchasePrice ?? 0,
        salePrice: salePrice ?? 0,
        quantity: finalKg,
        exchangeRate: saleExchangeRate,
      });
      return calculated;
    }
    return null;
  }, [
    manualCommissionUsd,
    commissionFormula,
    purchasePrice,
    salePrice,
    finalKg,
    saleExchangeRate,
  ]);

  const purchaseAmountRub = useMemo(() => {
    return purchaseAmountUsd !== null && purchaseExchangeRate > 0
      ? purchaseAmountUsd * purchaseExchangeRate
      : null;
  }, [purchaseAmountUsd, purchaseExchangeRate]);

  const saleAmountRub = useMemo(() => {
    return saleAmountUsd !== null && saleExchangeRate > 0
      ? saleAmountUsd * saleExchangeRate
      : null;
  }, [saleAmountUsd, saleExchangeRate]);

  const commissionRub = useMemo(() => {
    return commissionUsd !== null && saleExchangeRate > 0
      ? commissionUsd * saleExchangeRate
      : null;
  }, [commissionUsd, saleExchangeRate]);

  const profitUsd = useMemo(() => {
    if (purchaseAmountUsd === null || saleAmountUsd === null) return null;
    const commission = commissionUsd || 0;
    return saleAmountUsd - purchaseAmountUsd - commission;
  }, [purchaseAmountUsd, saleAmountUsd, commissionUsd]);

  const profitRub = useMemo(() => {
    if (purchaseAmountRub === null || saleAmountRub === null) return null;
    const commissionRubVal = commissionRub || 0;
    return saleAmountRub - purchaseAmountRub - commissionRubVal;
  }, [purchaseAmountRub, saleAmountRub, commissionRub]);

  // Логика проверки объема по договору
  const contractVolumeStatus = useContractVolume({
    priceId: parsePriceCompositeId(selectedSalePriceId).priceId,
    currentQuantityKg: finalKg,
    initialQuantityKg: initialQuantityKg,
    mode: "refueling-abroad",
  });

  // Логика проверки объема по договору поставщика
  const supplierContractVolumeStatus = useContractVolume({
    priceId: parsePriceCompositeId(selectedPurchasePriceId).priceId,
    currentQuantityKg: finalKg,
    initialQuantityKg: initialQuantityKg,
    mode: "refueling-abroad",
  });

  return {
    calculatedKg,
    finalKg,
    purchasePrice,
    salePrice,
    purchaseAmountUsd,
    saleAmountUsd,
    purchaseAmountRub,
    saleAmountRub,
    commissionUsd,
    commissionRub,
    profitUsd,
    profitRub,
    contractVolumeStatus,
    supplierContractVolumeStatus,
  };
}
