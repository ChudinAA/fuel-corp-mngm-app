import { useMemo } from "react";
import { evaluateCommissionFormula } from "../utils";
import { usePriceLookup } from "../../shared/hooks/use-price-lookup";
import { usePriceExtraction } from "../../shared/hooks/use-price-extraction";
import { parsePriceCompositeId } from "@/pages/shared/utils/price-utils";

interface UseRefuelingAbroadCalculationsProps {
  inputMode: "liters" | "kg";
  quantityLiters: string;
  density: string;
  quantityKg: string;
  selectedPurchasePriceId: string;
  selectedSalePriceId: string;
  purchaseExchangeRate: number;
  saleExchangeRate: number;
  commissionFormula: string;
  manualCommissionUsd: string;
  supplierId: string;
  buyerId: string;
  basisId: string;
  productType: string;
  refuelingDate: Date | null;
}

export function useRefuelingAbroadCalculations({
  inputMode,
  quantityLiters,
  density,
  quantityKg,
  selectedPurchasePriceId,
  selectedSalePriceId,
  purchaseExchangeRate,
  saleExchangeRate,
  commissionFormula,
  manualCommissionUsd,
  supplierId,
  buyerId,
  basisId,
  productType,
  refuelingDate,
}: UseRefuelingAbroadCalculationsProps) {
  const { data: purchasePrices = [] } = usePriceLookup({
    counterpartyId: supplierId,
    counterpartyRole: "supplier",
    counterpartyType: "foreign",
    basisId,
    productType,
    date: refuelingDate,
    enabled: !!supplierId && !!basisId,
  });

  const { data: salePrices = [] } = usePriceLookup({
    counterpartyId: buyerId,
    counterpartyRole: "customer",
    counterpartyType: "foreign",
    basisId,
    productType,
    date: refuelingDate,
    enabled: !!buyerId && !!basisId,
  });

  const { purchasePrice: extractedPurchasePrice, salePrice: extractedSalePrice } = usePriceExtraction({
    purchasePrices,
    salePrices,
    selectedPurchasePriceId,
    selectedSalePriceId,
    isWarehouseSupplier: false,
    productType,
  });

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
    return calculatedKg || 0;
  }, [inputMode, quantityKg, calculatedKg]);

  const purchasePrice = extractedPurchasePrice || 0;
  const salePrice = extractedSalePrice || 0;

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
    purchasePrices,
    salePrices,
  };
}
