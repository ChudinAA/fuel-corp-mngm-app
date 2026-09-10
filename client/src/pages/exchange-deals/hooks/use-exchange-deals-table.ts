import { useMemo } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePersistedTableFilters, buildFilterQueryString } from "@/hooks/use-persisted-table-filters";

export function useExchangeDealsTable() {
  const { columnFilters, setColumnFilters, search, setSearch } =
    usePersistedTableFilters("table-filters:exchange-deals");

  const pageSize = 100;
  const { toast } = useToast();

  const hasActiveFilters = Object.values(columnFilters).some((v) => v.length > 0);
  const effectivePageSize = hasActiveFilters ? 200 : pageSize;

  const {
    data: dealsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<{ data: any[]; total: number }>({
    queryKey: ["/api/exchange-deals", { search, columnFilters }],
    queryFn: async ({ pageParam = 0 }) => {
      const filterStr = buildFilterQueryString(columnFilters);
      const res = await apiRequest(
        "GET",
        `/api/exchange-deals?offset=${pageParam}&pageSize=${effectivePageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}${filterStr}`,
      );
      return res.json();
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce((sum, p) => sum + p.data.length, 0);
      return loadedCount < lastPage.total ? loadedCount : undefined;
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/exchange-deals/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movement"] });
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
