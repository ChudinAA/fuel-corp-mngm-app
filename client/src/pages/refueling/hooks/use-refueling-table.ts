
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AircraftRefueling } from "@shared/schema";

export function useRefuelingTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const pageSize = 10;
  const { toast } = useToast();

  const { data: refuelingDeals, isLoading } = useQuery<{ data: AircraftRefueling[]; total: number }>({
    queryKey: [`/api/refueling?page=${page}&pageSize=${pageSize}${search ? `&search=${search}` : ""}`],
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
    deleteMutation,
    handleDelete,
  };
}
