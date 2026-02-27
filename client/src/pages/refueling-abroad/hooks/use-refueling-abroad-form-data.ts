import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { extractPriceIdsForSubmit } from "@/pages/shared/utils/price-utils";
import type { RefuelingAbroadFormData } from "../schemas";
import type { 
  Supplier, 
  Customer, 
  ExchangeRate, 
  Base 
} from "@shared/schema";

interface UseRefuelingAbroadFormDataProps {
  onSuccess?: () => void;
  editData?: any;
  selectedPurchasePriceId: string;
  selectedSalePriceId: string;
  purchasePrices: any[];
  salePrices: any[];
  calculations: any;
  purchaseExchangeRate: number;
  saleExchangeRate: number;
  totalIntermediaryCommissionUsd: number;
  totalIntermediaryCommissionRub: number;
  intermediariesList: any[];
  setSelectedPurchasePriceId: (id: string) => void;
  setSelectedSalePriceId: (id: string) => void;
}

export function useRefuelingAbroadFormData({
  onSuccess,
  editData,
  selectedPurchasePriceId,
  selectedSalePriceId,
  purchasePrices,
  salePrices,
  calculations,
  purchaseExchangeRate,
  saleExchangeRate,
  totalIntermediaryCommissionUsd,
  totalIntermediaryCommissionRub,
  intermediariesList,
  setSelectedPurchasePriceId,
  setSelectedSalePriceId,
}: UseRefuelingAbroadFormDataProps) {
  const { toast } = useToast();

  const suppliersQuery = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const customersQuery = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const basesQuery = useQuery<Base[]>({
    queryKey: ["/api/bases"],
  });

  const exchangeRatesQuery = useQuery<ExchangeRate[]>({
    queryKey: ["/api/exchange-rates"],
  });

  const currenciesQuery = useQuery<any[]>({
    queryKey: ["/api/currencies"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: RefuelingAbroadFormData) => {
      const {
        purchasePriceId,
        purchasePriceIndex,
        salePriceId,
        salePriceIndex,
      } = extractPriceIdsForSubmit(
        selectedPurchasePriceId,
        selectedSalePriceId,
        purchasePrices,
        salePrices,
        false,
      );

      const payload = {
        refuelingDate: data.refuelingDate
          ? format(data.refuelingDate, "yyyy-MM-dd'T'HH:mm:ss")
          : null,
        productType: data.productType || null,
        aircraftNumber: data.aircraftNumber || null,
        flightNumber: data.flightNumber || null,
        airport: data.airportCode || null,
        country: null,
        supplierId: data.supplierId && data.supplierId !== "none" ? data.supplierId : null,
        buyerId: data.buyerId && data.buyerId !== "none" ? data.buyerId : null,
        basisId: data.basisId && data.basisId !== "none" ? data.basisId : null,
        intermediaryId: null,
        intermediaryCommissionFormula: null,
        intermediaryCommissionUsd: totalIntermediaryCommissionUsd || null,
        intermediaryCommissionRub: totalIntermediaryCommissionRub || null,
        quantityLiters: data.quantityLiters ? parseFloat(data.quantityLiters) : null,
        density: data.density ? parseFloat(data.density) : null,
        quantityKg: calculations.finalKg || 0,
        purchasePriceId: purchasePriceId || null,
        purchasePriceIndex: purchasePriceIndex !== undefined ? purchasePriceIndex : null,
        salePriceId: salePriceId || null,
        salePriceIndex: salePriceIndex !== undefined ? salePriceIndex : null,
        currency: "USD",
        purchaseExchangeRateId: data.purchaseExchangeRateId || null,
        purchaseExchangeRateValue: purchaseExchangeRate || null,
        saleExchangeRateId: data.saleExchangeRateId || null,
        saleExchangeRateValue: saleExchangeRate || null,
        purchasePriceUsd: calculations.purchasePrice || null,
        purchasePriceRub: calculations.purchasePrice && purchaseExchangeRate ? calculations.purchasePrice * purchaseExchangeRate : null,
        salePriceUsd: calculations.salePrice || null,
        salePriceRub: calculations.salePrice && saleExchangeRate ? calculations.salePrice * saleExchangeRate : null,
        purchaseAmountUsd: calculations.purchaseAmountUsd || null,
        saleAmountUsd: calculations.saleAmountUsd || null,
        purchaseAmountRub: calculations.purchaseAmountRub || null,
        saleAmountRub: calculations.saleAmountRub || null,
        profitUsd: calculations.profitUsd ?? null,
        profitRub: calculations.profitRub ?? null,
        notes: data.notes || null,
        isApproxVolume: data.isApproxVolume || false,
        inputMode: data.inputMode,
        isDraft: data.isDraft,
      };

      let refuelingId: string;
      if (editData && editData.id) {
        await apiRequest("PATCH", `/api/refueling-abroad/${editData.id}`, payload);
        refuelingId = editData.id;
      } else {
        const response = await apiRequest("POST", "/api/refueling-abroad", payload);
        const result = await response.json();
        refuelingId = result.id;
      }

      const intermediariesPayload = intermediariesList
        .filter((item) => item.intermediaryId && item.intermediaryId !== "none")
        .map((item, index) => ({
          intermediaryId: item.intermediaryId,
          orderIndex: index,
          commissionFormula: item.commissionFormula !== undefined ? item.commissionFormula : null,
          manualCommissionUsd: item.manualCommissionUsd || null,
          commissionUsd: item.commissionUsd ?? null,
          commissionRub: item.commissionRub ?? null,
          buyCurrencyId: item.buyCurrencyId || null,
          sellCurrencyId: item.sellCurrencyId || null,
          buyExchangeRate: item.buyExchangeRate ?? null,
          sellExchangeRate: item.sellExchangeRate ?? null,
          crossConversionCost: item.crossConversionCost ?? 0,
          crossConversionCostRub: item.crossConversionCostRub ?? 0,
          notes: item.notes || null,
        }));

      await apiRequest("PUT", `/api/refueling-abroad/${refuelingId}/intermediaries`, intermediariesPayload);
      return { id: refuelingId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/refueling-abroad/contract-used"] });
      queryClient.invalidateQueries({ queryKey: ["/api/storage-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/refueling-abroad"] });
      queryClient.invalidateQueries({ queryKey: ["/api/storage-cards/advances"] });
      toast({ title: editData ? "Запись обновлена" : "Запись создана" });
      setSelectedPurchasePriceId("");
      setSelectedSalePriceId("");
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить запись",
        variant: "destructive",
      });
    },
  });

  return {
    suppliers: suppliersQuery.data || [],
    customers: customersQuery.data || [],
    allBases: basesQuery.data || [],
    exchangeRates: exchangeRatesQuery.data || [],
    currencies: currenciesQuery.data || [],
    createMutation,
  };
}
