import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Opt } from "@shared/schema";
import type { OptFilters } from "../components/opt-filters-dialog";

export function useOptTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<OptFilters>({});
  const pageSize = 10;
  const { toast } = useToast();

  const buildQueryString = () => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("pageSize", pageSize.toString());
    
    if (search) {
      params.set("search", search);
    }
    
    if (filters.dateFrom) {
      params.set("dateFrom", filters.dateFrom.toISOString().split("T")[0]);
    }
    
    if (filters.dateTo) {
      params.set("dateTo", filters.dateTo.toISOString().split("T")[0]);
    }
    
    if (filters.supplierId) {
      params.set("supplierId", filters.supplierId);
    }
    
    if (filters.buyerId) {
      params.set("buyerId", filters.buyerId);
    }
    
    if (filters.warehouseId) {
      params.set("warehouseId", filters.warehouseId);
    }
    
    return params.toString();
  };

  const { data: optDeals, isLoading } = useQuery<{ data: Opt[]; total: number }>({
    queryKey: [`/api/opt?${buildQueryString()}`],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/opt/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith('/api/opt');
        }
      });
      toast({ title: "Сделка удалена", description: "Оптовая сделка успешно удалена" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const handleDelete = (id: string) => {
    const confirmed = window.confirm(
      "Вы уверены, что хотите удалить эту сделку?\n\n" +
      "⚠️ ВНИМАНИЕ: Удаление сделки повлияет на:\n" +
      "• Остатки на складах\n" +
      "• Транзакции склада (warehouse_transactions)\n" +
      "• Связанные перемещения\n\n" +
      "Это действие необратимо!"
    );

    if (confirmed) {
      deleteMutation.mutate(id);
    }
  };

  return {
    page,
    setPage,
    search,
    setSearch,
    filters,
    setFilters,
    pageSize,
    optDeals,
    isLoading,
    deleteMutation,
    handleDelete,
  };
}