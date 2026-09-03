import { useInfiniteQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { usePersistedTableFilters, buildFilterQueryString } from "@/hooks/use-persisted-table-filters";

export function useMovementTable() {
  const { columnFilters, setColumnFilters, search, setSearch } =
    usePersistedTableFilters("table-filters:movement");

  const pageSize = 100;

  const hasActiveFilters = Object.values(columnFilters).some((v) => v.length > 0);
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
      const filterStr = buildFilterQueryString(columnFilters);
      const params = new URLSearchParams({
        offset: pageParam.toString(),
        pageSize: effectivePageSize.toString(),
      });
      if (search) params.append("search", search);
      const res = await apiRequest("GET", `/api/movement?${params.toString()}${filterStr}`);
      return res.json() as Promise<{ data: any[]; total: number }>;
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
