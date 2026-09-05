import { useInfiniteQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { usePersistedTableFilters, buildFilterQueryString } from "@/hooks/use-persisted-table-filters";

export function useEquipmentMovementTable() {
  const { columnFilters, setColumnFilters, search, setSearch } =
    usePersistedTableFilters("table-filters:equipment-movement");

  const hasActiveFilters = Object.values(columnFilters).some((v) => v.length > 0);
  const effectiveLimit = hasActiveFilters ? 200 : 100;

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["/api/equipment-movement", search, columnFilters],
    queryFn: async ({ pageParam = 0 }) => {
      const filterStr = buildFilterQueryString(columnFilters);
      const params = new URLSearchParams({
        offset: pageParam.toString(),
        pageSize: effectiveLimit.toString(),
      });
      if (search) params.append("search", search);
      const res = await apiRequest("GET", `/api/equipment-movement?${params.toString()}${filterStr}`);
      const json = await res.json();
      const items = json.items || [];
      return {
        data: items,
        total: json.total || 0,
      };
    },
    getNextPageParam: (lastPage: any, allPages: any[]) => {
      const loadedCount = allPages.reduce((sum: number, p: any) => sum + p.data.length, 0);
      return loadedCount < lastPage.total ? loadedCount : undefined;
    },
    initialPageParam: 0,
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
