import { useMemo } from "react";
import { evaluateCommissionFormula } from "../utils";
import { usePriceExtraction } from "../../shared/hooks/use-price-extraction";
import { parsePriceCompositeId } from "@/pages/shared/utils/price-utils";
import { useContractVolume } from "@/pages/shared/hooks/use-contract-volume";
import type { Price, Supplier } from "@shared/schema";

interface UseRefuelingAbroadCalculationsProps {
  inputMode: "liters" | "kg";
  quantityLiters: string;
  density: string;
  quantityKg: string;
  purchasePriceUsd: string;
  salePriceUsd: string;
  purchaseExchangeRate: number;
  saleExchangeRate: number;
  commissionFormula: string;
  manualCommissionUsd: string;
  purchasePrices: Price[];
  salePrices: Price[];
  selectedPurchasePriceId: string;
  selectedSalePriceId: string;
  selectedSupplier: Supplier | undefined;
  initialQuantityKg?: number;
}

export function useRefuelingAbroadCalculations({
  inputMode,
  quantityLiters,
  density,
  quantityKg,
  purchasePriceUsd,
  salePriceUsd,
  purchaseExchangeRate,
  saleExchangeRate,
  commissionFormula,
  manualCommissionUsd,
  purchasePrices,
  salePrices,
  selectedPurchasePriceId,
  selectedSalePriceId,
  selectedSupplier,
  initialQuantityKg = 0,
}: UseRefuelingAbroadCalculationsProps) {
  const calculatedKg = useMemo(() => {
    if (inputMode === "kg") return null;
    const liters = parseFloat(quantityLiters || "0");
    const d = parseFloat(density || "0.8");
    if (isNaN(liters) || isNaN(d) || d <= 0) return null;
    return (liters * d).toFixed(0);
  }, [inputMode, quantityLiters, density]);

  const finalKg = useMemo(() => {
    if (inputMode === "kg") {
      const kg = parseFloat(quantityKg || "0");
      return isNaN(kg) ? 0 : kg;
    }
    return calculatedKg ? parseFloat(calculatedKg) : 0;
  }, [inputMode, quantityKg, calculatedKg]);

  const { purchasePrice: extractedPurchasePrice, salePrice: extractedSalePrice } = usePriceExtraction({
    purchasePrices,
    salePrices,
    selectedPurchasePriceId,
    selectedSalePriceId,
    isWarehouseSupplier: false,
    selectedSupplier,
    productType: "kerosene", // Default for abroad
  });

  const purchasePrice = useMemo(() => {
    if (extractedPurchasePrice !== null) return extractedPurchasePrice;
    const price = parseFloat(purchasePriceUsd || "0");
    return isNaN(price) ? 0 : price;
  }, [purchasePriceUsd, extractedPurchasePrice]);

  const salePrice = useMemo(() => {
    if (extractedSalePrice !== null) return extractedSalePrice;
    const price = parseFloat(salePriceUsd || "0");
    return isNaN(price) ? 0 : price;
  }, [salePriceUsd, extractedSalePrice]);

  const purchaseAmountUsd = useMemo(() => {
    return purchasePrice > 0 && finalKg > 0 ? purchasePrice * finalKg : null;
  }, [purchasePrice, finalKg]);

  const saleAmountUsd = useMemo(() => {
    return salePrice > 0 && finalKg > 0 ? salePrice * finalKg : null;
  }, [salePrice, finalKg]);

  const commissionUsd = useMemo(() => {
    if (manualCommissionUsd && manualCommissionUsd.trim() !== "") {
      const manual = parseFloat(manualCommissionUsd);
      if (!isNaN(manual)) return manual;
    }
    
    if (commissionFormula && commissionFormula.trim() !== "") {
      const calculated = evaluateCommissionFormula(commissionFormula, {
        purchasePrice,
        salePrice,
        quantity: finalKg,
        exchangeRate: saleExchangeRate,
      });
      return calculated;
    }
    return null;
  }, [manualCommissionUsd, commissionFormula, purchasePrice, salePrice, finalKg, saleExchangeRate]);

  const purchaseAmountRub = useMemo(() => {
    return purchaseAmountUsd !== null && purchaseExchangeRate > 0 ? purchaseAmountUsd * purchaseExchangeRate : null;
  }, [purchaseAmountUsd, purchaseExchangeRate]);

  const saleAmountRub = useMemo(() => {
    return saleAmountUsd !== null && saleExchangeRate > 0 ? saleAmountUsd * saleExchangeRate : null;
  }, [saleAmountUsd, saleExchangeRate]);

  const commissionRub = useMemo(() => {
    return commissionUsd !== null && saleExchangeRate > 0 ? commissionUsd * saleExchangeRate : null;
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

  const contractVolumeStatus = useContractVolume({
    priceId: parsePriceCompositeId(selectedSalePriceId).priceId,
    currentQuantityKg: finalKg,
    initialQuantityKg: initialQuantityKg,
    mode: "refueling",
  });

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
