
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Opt } from "@shared/schema";

export function useOptTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editingOpt, setEditingOpt] = useState<Opt | null>(null);
  const pageSize = 10;
  const { toast } = useToast();

  const { data: optDeals, isLoading } = useQuery<{ data: Opt[]; total: number }>({
    queryKey: ["/api/opt", page, search],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/opt/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opt"] });
      toast({ title: "Сделка удалена", description: "Оптовая сделка успешно удалена" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Вы уверены, что хотите удалить эту сделку?")) {
      deleteMutation.mutate(id);
    }
  };

  return {
    page,
    setPage,
    search,
    setSearch,
    editingOpt,
    setEditingOpt,
    pageSize,
    optDeals,
    isLoading,
    deleteMutation,
    handleDelete,
  };
}
