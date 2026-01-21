
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AircraftRefueling } from "@shared/schema";

export function useRefuelingTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const pageSize = 20;
  const { toast } = useToast();

  const filterParams = Object.entries(columnFilters)
    .filter(([_, values]) => values.length > 0)
    .map(([columnId, values]) => `&filter_${columnId}=${values.join(",")}`)
    .join("");

  const { data: refuelingDeals, isLoading } = useQuery<{ data: AircraftRefueling[]; total: number }>({
    queryKey: [`/api/refueling?page=${page}&pageSize=${pageSize}${search ? `&search=${search}` : ""}${filterParams}`],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/refueling/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith('/api/refueling');
        }
      });
      toast({ title: "Заправка удалена", description: "Заправка ВС успешно удалена" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return {
    page,
    setPage,
    search,
    setSearch,
    pageSize,
    refuelingDeals,
    isLoading,
    columnFilters,
    setColumnFilters,
    deleteMutation,
    handleDelete,
  };
}
