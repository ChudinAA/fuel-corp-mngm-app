
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Price } from "@shared/schema";
import { formatTonnes } from "@shared/units";

export function usePriceSelection() {
  const { toast } = useToast();
  const [calculatingPriceId, setCalculatingPriceId] = useState<string | null>(null);

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
    onSuccess: (data, price) => {
      queryClient.invalidateQueries({ queryKey: ["/api/prices/list"] });
      const isAmountLimit = (price as any).limitType === "amount";
      const calculatedVolume = data.volume as
        | { value: string | number; unit: "tonne" | "liter" }
        | undefined;
      const volumeDescription = calculatedVolume
        ? calculatedVolume.unit === "tonne"
          ? `${formatTonnes(Number(calculatedVolume.value))} т`
          : `${new Intl.NumberFormat("ru-RU", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(Number(calculatedVolume.value))} л`
        : `${formatTonnes(Number(calculatedVolume?.value ?? 0))} т`;
      const description = isAmountLimit
        ? `Общая сумма: ${data.totalAmount} ₽`
        : `Общий объём: ${volumeDescription}`;
      toast({ title: "Выборка рассчитана", description });
      setCalculatingPriceId(null);
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось рассчитать выборку", variant: "destructive" });
      setCalculatingPriceId(null);
    },
  });

  return {
    calculateForPrice,
    calculatingPriceId,
  };
}
