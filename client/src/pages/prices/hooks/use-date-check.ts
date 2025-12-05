
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Price } from "@shared/schema";

export function useDateCheck() {
  const { toast } = useToast();
  const [result, setResult] = useState<{
    status: string;
    message: string;
    overlaps?: { id: number; dateFrom: string; dateTo: string }[];
  } | null>(null);

  const mutation = useMutation({
    mutationFn: async (params: {
      counterpartyId: string;
      counterpartyType: string;
      counterpartyRole: string;
      basis: string;
      dateFrom: Date;
      dateTo: Date;
      excludeId?: string;
    }) => {
      const queryParams = new URLSearchParams({
        counterpartyId: params.counterpartyId,
        counterpartyType: params.counterpartyType,
        counterpartyRole: params.counterpartyRole,
        basis: params.basis,
        dateFrom: format(params.dateFrom, "yyyy-MM-dd"),
        dateTo: format(params.dateTo, "yyyy-MM-dd"),
      });
      if (params.excludeId) {
        queryParams.append("excludeId", params.excludeId);
      }
      const res = await apiRequest("GET", `/api/prices/check-date-overlaps?${queryParams}`);
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.status === "error") {
        toast({ title: "Двойная цена!", description: data.message, variant: "destructive" });
      } else if (data.status === "warning") {
        toast({ title: "Внимание", description: data.message });
      } else {
        toast({ title: "Проверка пройдена", description: "Пересечений не обнаружено" });
      }
    },
    onError: () => {
      toast({ title: "Ошибка проверки", description: "Не удалось проверить даты", variant: "destructive" });
    },
  });

  const checkForPrice = useMutation({
    mutationFn: async (price: Price) => {
      const params = new URLSearchParams({
        counterpartyId: price.counterpartyId,
        counterpartyType: price.counterpartyType,
        counterpartyRole: price.counterpartyRole,
        basis: price.basis || "",
        dateFrom: price.dateFrom,
        dateTo: price.dateTo || price.dateFrom,
        excludeId: price.id,
      });
      const res = await apiRequest("GET", `/api/prices/check-date-overlaps?${params}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      if (data.status === "error") {
        toast({ title: "Двойная цена!", description: data.message, variant: "destructive" });
      } else {
        toast({ title: "Проверка пройдена", description: "Пересечений не обнаружено" });
      }
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось проверить даты", variant: "destructive" });
    },
  });

  return {
    result,
    setResult,
    check: mutation.mutate,
    isChecking: mutation.isPending,
    checkForPrice,
  };
}
