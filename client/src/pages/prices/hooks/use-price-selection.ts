
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Price } from "@shared/schema";

export function usePriceSelection() {
  const { toast } = useToast();
  const [result, setResult] = useState<string | null>(null);
  const [calculatingPriceId, setCalculatingPriceId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (params: {
      counterpartyId: string;
      counterpartyType: string;
      basis: string;
      dateFrom: Date;
      dateTo: Date;
    }) => {
      const queryParams = new URLSearchParams({
        counterpartyId: params.counterpartyId,
        counterpartyType: params.counterpartyType,
        basis: params.basis,
        dateFrom: format(params.dateFrom, "yyyy-MM-dd"),
        dateTo: format(params.dateTo, "yyyy-MM-dd"),
      });
      const res = await apiRequest("GET", `/api/prices/calculate-selection?${queryParams}`);
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data.totalVolume);
      toast({ title: "Выборка рассчитана", description: `Общий объем: ${data.totalVolume} кг` });
    },
    onError: () => {
      toast({ title: "Ошибка расчета", description: "Не удалось рассчитать выборку", variant: "destructive" });
    },
  });

  const calculateForPrice = useMutation({
    mutationFn: async (price: Price) => {
      setCalculatingPriceId(price.id);
      const params = new URLSearchParams({
        counterpartyId: price.counterpartyId,
        counterpartyType: price.counterpartyType,
        basis: price.basis || "",
        dateFrom: price.dateFrom,
        dateTo: price.dateTo || price.dateFrom,
        priceId: price.id,
      });
      const res = await apiRequest("GET", `/api/prices/calculate-selection?${params}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      toast({ title: "Выборка рассчитана", description: `Общий объем: ${data.totalVolume} кг` });
      setCalculatingPriceId(null);
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось рассчитать выборку", variant: "destructive" });
      setCalculatingPriceId(null);
    },
  });

  return {
    result,
    setResult,
    calculate: mutation.mutate,
    isCalculating: mutation.isPending,
    calculateForPrice,
    calculatingPriceId,
  };
}
