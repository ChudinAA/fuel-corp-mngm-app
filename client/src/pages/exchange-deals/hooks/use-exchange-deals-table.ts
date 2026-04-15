import { useState } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useExchangeDealsTable() {
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const pageSize = 20;
  const { toast } = useToast();

  const {
    data: dealsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<{ data: any[]; total: number }>({
    queryKey: ["/api/exchange-deals", { search, columnFilters }],
    queryFn: async ({ pageParam = 0 }) => {
      const filters = Object.entries(columnFilters)
        .filter(([_, values]) => values.length > 0)
        .map(([id, values]) => `&filter_${id}=${encodeURIComponent(values.join(","))}`)
        .join("");
      const res = await apiRequest(
        "GET",
        `/api/exchange-deals?offset=${pageParam}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}${filters}`,
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
      const res = await apiRequest("DELETE", `/api/exchange-deals/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-deals"] });
      toast({ title: "Сделка удалена" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return {
    search,
    setSearch,
    pageSize,
    dealsData,
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
