import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

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
      dateFrom: Date | string;
      dateTo: Date | string;
      productType: string;
      excludeId?: string;
    }) => {
      const queryParams = new URLSearchParams({
        counterpartyId: params.counterpartyId,
        counterpartyType: params.counterpartyType,
        counterpartyRole: params.counterpartyRole,
        basis: params.basis,
        productType: params.productType,
        dateFrom: typeof params.dateFrom === "string" ? params.dateFrom : format(params.dateFrom, "yyyy-MM-dd"),
        dateTo: typeof params.dateTo === "string" ? params.dateTo : format(params.dateTo, "yyyy-MM-dd"),
        ...(params.excludeId && { excludeId: params.excludeId }),
      });
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

  return {
    result,
    setResult,
    check: mutation.mutate,
    checkAsync: mutation.mutateAsync,
    isChecking: mutation.isPending,
  };
}