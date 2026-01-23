import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export function useMovementTable() {
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});

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
        pageSize: pageSize.toString(),
      });
      
      if (search) params.append("search", search);
      
      Object.entries(columnFilters).forEach(([k, v]) => {
        if (v.length > 0) {
          v.forEach(val => params.append(`filter_${k}`, val));
        }
      });

      const res = await apiRequest("GET", `/api/movement?${params.toString()}`);
      return res.json() as Promise<{ data: any[], total: number }>;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.length * pageSize;
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
  };
}
