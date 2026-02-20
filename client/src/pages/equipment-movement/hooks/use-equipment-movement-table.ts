import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export function useEquipmentMovementTable() {
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["/api/equipment-movement", search, columnFilters],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page: pageParam.toString(),
        limit: "20",
        search,
        ...Object.fromEntries(
          Object.entries(columnFilters).map(([k, v]) => [k, v.join(",")])
        ),
      });
      const res = await apiRequest("GET", `/api/equipment-movement?${params.toString()}`);
      return res.json();
    },
    getNextPageParam: (lastPage: any) => 
      lastPage.hasMore ? lastPage.nextPage : undefined,
    initialPageParam: 1,
  });

  const movements = data?.pages.flatMap((page) => page.data) || [];
  const total = data?.pages[0]?.total || 0;

  return {
    search,
    setSearch,
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
