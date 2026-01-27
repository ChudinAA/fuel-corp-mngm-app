import { useMemo } from "react";
import { evaluateCommissionFormula } from "../utils";

interface UseRefuelingAbroadCalculationsProps {
  inputMode: "liters" | "kg";
  quantityLiters: string;
  density: string;
  quantityKg: string;
  purchasePriceUsd: string;
  salePriceUsd: string;
  exchangeRate: number;
  commissionFormula: string;
  manualCommissionUsd: string;
}

export function useRefuelingAbroadCalculations({
  inputMode,
  quantityLiters,
  density,
  quantityKg,
  purchasePriceUsd,
  salePriceUsd,
  exchangeRate,
  commissionFormula,
  manualCommissionUsd,
}: UseRefuelingAbroadCalculationsProps) {
  const calculatedKg = useMemo(() => {
    if (inputMode === "kg") return null;
    const liters = parseFloat(quantityLiters || "0");
    const d = parseFloat(density || "0.8");
    if (isNaN(liters) || isNaN(d) || d <= 0) return null;
    return liters * d;
  }, [inputMode, quantityLiters, density]);

  const finalKg = useMemo(() => {
    if (inputMode === "kg") {
      const kg = parseFloat(quantityKg || "0");
      return isNaN(kg) ? 0 : kg;
    }
    return calculatedKg || 0;
  }, [inputMode, quantityKg, calculatedKg]);

  const purchasePrice = useMemo(() => {
    const price = parseFloat(purchasePriceUsd || "0");
    return isNaN(price) ? 0 : price;
  }, [purchasePriceUsd]);

  const salePrice = useMemo(() => {
    const price = parseFloat(salePriceUsd || "0");
    return isNaN(price) ? 0 : price;
  }, [salePriceUsd]);

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
        exchangeRate,
      });
      return calculated;
    }
    return null;
  }, [manualCommissionUsd, commissionFormula, purchasePrice, salePrice, finalKg, exchangeRate]);

  const purchaseAmountRub = useMemo(() => {
    return purchaseAmountUsd !== null && exchangeRate > 0 ? purchaseAmountUsd * exchangeRate : null;
  }, [purchaseAmountUsd, exchangeRate]);

  const saleAmountRub = useMemo(() => {
    return saleAmountUsd !== null && exchangeRate > 0 ? saleAmountUsd * exchangeRate : null;
  }, [saleAmountUsd, exchangeRate]);

  const commissionRub = useMemo(() => {
    return commissionUsd !== null && exchangeRate > 0 ? commissionUsd * exchangeRate : null;
  }, [commissionUsd, exchangeRate]);

  const profitUsd = useMemo(() => {
    if (purchaseAmountUsd === null || saleAmountUsd === null) return null;
    const commission = commissionUsd || 0;
    return saleAmountUsd - purchaseAmountUsd - commission;
  }, [purchaseAmountUsd, saleAmountUsd, commissionUsd]);

  const profitRub = useMemo(() => {
    return profitUsd !== null && exchangeRate > 0 ? profitUsd * exchangeRate : null;
  }, [profitUsd, exchangeRate]);

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
  };
}
