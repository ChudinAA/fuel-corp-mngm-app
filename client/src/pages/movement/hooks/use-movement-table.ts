import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export function useMovementTable() {
  const [pageSize] = useState(100);
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});

  const hasActiveFilters = Object.values(columnFilters).some(v => v.length > 0);
  const effectivePageSize = hasActiveFilters ? 1000 : pageSize;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["/api/movement", pageSize, search, columnFilters],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        offset: pageParam.toString(),
        pageSize: effectivePageSize.toString(),
      });
      
      if (search) params.append("search", search);
      
      Object.entries(columnFilters).forEach(([k, v]) => {
        if (v.length > 0) {
          params.append(`filter_${k}`, v.join(","));
        }
      });

      const res = await apiRequest("GET", `/api/movement?${params.toString()}`);
      return res.json() as Promise<{ data: any[], total: number }>;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce((sum, p) => sum + p.data.length, 0);
      return loadedCount < lastPage.total ? loadedCount : undefined;
    },
  });

  const movements = data?.pages.flatMap((page) => page.data) || [];
  const total = data?.pages[0]?.total || 0;

  return {
    search,
    setSearch,
    pageSize,
    movements,
    total,
    isLoading,
    columnFilters,
    setColumnFilters,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  };
}
