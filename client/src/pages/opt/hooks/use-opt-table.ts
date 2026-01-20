import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useOptTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const pageSize = 20;
  const { toast } = useToast();

  const { data: optDeals, isLoading } = useQuery<{ data: any[]; total: number }>({
    queryKey: [
      `/api/opt?page=${page}&pageSize=${pageSize}${search ? `&search=${search}` : ""}${
        Object.entries(columnFilters)
          .filter(([_, values]) => values.length > 0)
          .map(([id, values]) => `&filter_${id}=${encodeURIComponent(values.join(","))}`)
          .join("")
      }`,
    ],
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
    pageSize,
    optDeals,
    isLoading,
    columnFilters,
    setColumnFilters,
    deleteMutation,
    handleDelete,
  };
}