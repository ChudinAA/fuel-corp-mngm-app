import { useMemo } from "react";
import { evaluateCommissionFormula } from "../utils";
import { Price } from "@shared/schema";
import { usePriceExtraction } from "@/pages/shared/hooks/use-price-extraction";
import { parsePriceCompositeId } from "@/pages/shared/utils/price-utils";
import { useContractVolume } from "@/pages/shared/hooks/use-contract-volume";
import { ChainBankCommissionItem, ChainItem } from "../components/deal-chain";
import {
  ChainIntermediaryItem,
  computeBankCommission,
  computeIntermediaryCommission,
} from "../components/deal-chain/types";
import {
  calculateRefuelingAmount,
  calculateRefuelingMassTonnes,
  calculateRefuelingPricePerTonne,
} from "../unit-calculations";
import { tonnesToKilograms } from "@shared/units";

interface UseRefuelingAbroadCalculationsProps {
  inputMode: "liters" | "tonnes";
  quantityLiters: string;
  density: string;
  quantityTonnes: string;
  purchaseExchangeRate: number;
  saleExchangeRate: number;
  purchasePrices: Price[];
  salePrices: Price[];
  selectedPurchasePriceId: string;
  selectedSalePriceId: string;
  productType: string;
  chainItems: ChainItem[];
  initialQuantityTonnes?: number;
  initialPurchaseAmountUsd?: number;
  initialSaleAmountUsd?: number;
}

export function useRefuelingAbroadCalculations({
  inputMode,
  quantityLiters,
  density,
  quantityTonnes,
  purchaseExchangeRate,
  saleExchangeRate,
  salePrices,
  purchasePrices,
  selectedPurchasePriceId,
  selectedSalePriceId,
  productType,
  chainItems,
  initialQuantityTonnes = 0,
  initialPurchaseAmountUsd = 0,
  initialSaleAmountUsd = 0,
}: UseRefuelingAbroadCalculationsProps) {
  const finalTonnes =
    calculateRefuelingMassTonnes(
      inputMode,
      inputMode === "liters" ? quantityLiters : quantityTonnes,
      density,
    ) ?? 0;
  const finalKg = tonnesToKilograms(finalTonnes);
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
    return extractedPurchasePrice;
  }, [extractedPurchasePrice]);

  const salePrice = useMemo(() => {
    return extractedSalePrice;
  }, [extractedSalePrice]);

  const purchasePricePerTonne = useMemo(
    () =>
      purchasePrice === null
        ? null
        : calculateRefuelingPricePerTonne(
            purchasePrice,
            inputMode,
            density,
          ),
    [purchasePrice, inputMode, density],
  );

  const salePricePerTonne = useMemo(
    () =>
      salePrice === null
        ? null
        : calculateRefuelingPricePerTonne(salePrice, inputMode, density),
    [salePrice, inputMode, density],
  );

  const purchaseAmountUsd = useMemo(() => {
    return calculateRefuelingAmount(purchasePricePerTonne, finalTonnes);
  }, [purchasePricePerTonne, finalTonnes]);

  const saleAmountUsd = useMemo(() => {
    return calculateRefuelingAmount(salePricePerTonne, finalTonnes);
  }, [salePricePerTonne, finalTonnes]);

  const totalIntermediaryCommissionUsd = useMemo(() => {
    const intermediaryChainItems = chainItems.filter(
      (i): i is ChainIntermediaryItem => i.type === "intermediary",
    );
    return intermediaryChainItems.reduce((sum, item) => {
      return (
        sum +
        computeIntermediaryCommission(
          item.incomeType,
          item.rateValue,
          saleAmountUsd ?? 0,
          finalTonnes,
        )
      );
    }, 0);
  }, [chainItems, saleAmountUsd, finalTonnes]);

  const totalBankCommissionUsd = useMemo(() => {
    const bankChainItems = chainItems.filter(
      (i): i is ChainBankCommissionItem => i.type === "bank_commission",
    );
    return bankChainItems.reduce((sum, item) => {
      return (
        sum +
        computeBankCommission(
          item.commissionType,
          item.percent,
          item.minValue,
          purchaseAmountUsd ?? 0,
        )
      );
    }, 0);
  }, [chainItems, purchaseAmountUsd]);

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

  const totalIntermediaryCommissionRub = useMemo(() => {
    return saleExchangeRate
      ? totalIntermediaryCommissionUsd * saleExchangeRate
      : purchaseExchangeRate
        ? totalIntermediaryCommissionUsd * purchaseExchangeRate
        : 0;
  }, [totalIntermediaryCommissionUsd, saleExchangeRate, purchaseExchangeRate]);

  const totalBankCommissionRub = useMemo(() => {
    return saleExchangeRate
      ? totalBankCommissionUsd * saleExchangeRate
      : purchaseExchangeRate
        ? totalBankCommissionUsd * purchaseExchangeRate
        : 0;
  }, [totalBankCommissionUsd, saleExchangeRate, purchaseExchangeRate]);

  const profitUsd = useMemo(() => {
    if (purchaseAmountUsd === null || saleAmountUsd === null) return null;
    const commission = totalIntermediaryCommissionUsd + totalBankCommissionUsd;
    return saleAmountUsd - purchaseAmountUsd - commission;
  }, [
    purchaseAmountUsd,
    saleAmountUsd,
    totalIntermediaryCommissionUsd,
    totalBankCommissionUsd,
  ]);

  const profitRub = useMemo(() => {
    if (purchaseAmountRub === null || saleAmountRub === null) return null;
    const commissionRubVal =
      totalIntermediaryCommissionRub + totalBankCommissionRub || 0;
    return saleAmountRub - purchaseAmountRub - commissionRubVal;
  }, [
    purchaseAmountRub,
    saleAmountRub,
    totalIntermediaryCommissionRub,
    totalBankCommissionRub,
  ]);

  // Логика проверки объема по договору
  const contractVolumeStatus = useContractVolume({
    priceId: parsePriceCompositeId(selectedSalePriceId).priceId,
    currentQuantityTonnes: finalTonnes,
    initialQuantityTonnes,
    mode: "refueling-abroad",
    currentDealAmount: saleAmountUsd ?? 0,
    initialDealAmount: initialSaleAmountUsd,
  });

  // Логика проверки объема по договору поставщика
  const supplierContractVolumeStatus = useContractVolume({
    priceId: parsePriceCompositeId(selectedPurchasePriceId).priceId,
    currentQuantityTonnes: finalTonnes,
    initialQuantityTonnes,
    mode: "refueling-abroad",
    currentDealAmount: purchaseAmountUsd ?? 0,
    initialDealAmount: initialPurchaseAmountUsd,
  });

  return {
    finalTonnes,
    finalKg,
    purchasePrice,
    salePrice,
    purchasePricePerTonne,
    salePricePerTonne,
    purchaseAmountUsd,
    saleAmountUsd,
    purchaseAmountRub,
    saleAmountRub,
    totalIntermediaryCommissionUsd,
    totalIntermediaryCommissionRub,
    totalBankCommissionUsd,
    totalBankCommissionRub,
    profitUsd,
    profitRub,
    contractVolumeStatus,
    supplierContractVolumeStatus,
  };
}
