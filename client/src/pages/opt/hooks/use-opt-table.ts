import { useState } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useOptTable() {
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>(
    {},
  );
  const pageSize = 20;
  const { toast } = useToast();

  const {
    data: optDeals,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<{ data: any[]; total: number }>({
    queryKey: ["/api/opt", { search, columnFilters }],
    queryFn: async ({ pageParam = 0 }) => {
      const filters = Object.entries(columnFilters)
        .filter(([_, values]) => values.length > 0)
        .map(
          ([id, values]) =>
            `&filter_${id}=${encodeURIComponent(values.join(","))}`,
        )
        .join("");

      const res = await apiRequest(
        "GET",
        `/api/opt?offset=${pageParam}&pageSize=${pageSize}${search ? `&search=${search}` : ""}${filters}`,
      );
      return res.json();
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.length * pageSize;
      return loadedCount < lastPage.total ? loadedCount : undefined;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/opt/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opt"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/opt/contract-used"] });
      toast({
        title: "Сделка удалена",
        description: "Оптовая сделка успешно удалена",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return {
    search,
    setSearch,
    pageSize,
    optDeals,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    columnFilters,
    setColumnFilters,
    deleteMutation,
    handleDelete,
  };
}
