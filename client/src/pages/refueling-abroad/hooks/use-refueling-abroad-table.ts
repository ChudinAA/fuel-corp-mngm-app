import { useMemo } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePersistedTableFilters, buildFilterQueryString } from "@/hooks/use-persisted-table-filters";

export function useRefuelingAbroadTable() {
  const { columnFilters, setColumnFilters, search, setSearch } =
    usePersistedTableFilters("table-filters:refueling-abroad");

  const pageSize = 100;
  const { toast } = useToast();

  const hasActiveFilters = Object.values(columnFilters).some((v) => v.length > 0);
  const effectivePageSize = hasActiveFilters ? 200 : pageSize;

  const filterStr = buildFilterQueryString(columnFilters);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: [`/api/refueling-abroad`, { search, columnFilters }],
      queryFn: async ({ pageParam = 0 }) => {
        const res = await apiRequest(
          "GET",
          `/api/refueling-abroad?offset=${pageParam}&pageSize=${effectivePageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}${filterStr}`,
        );
        return res.json();
      },
      initialPageParam: 0,
      getNextPageParam: (lastPage, allPages) => {
        const currentCount = allPages.reduce(
          (sum, page) =>
            sum + (Array.isArray(page.data)
              ? page.data.length
              : Array.isArray(page)
                ? page.length
                : 0),
          0,
        );
        const total = lastPage.total ?? (Array.isArray(lastPage) ? lastPage.length : 0);
        return currentCount < total ? currentCount : undefined;
      },
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
    });

  const refuelingDeals = useMemo(() => {
    if (!data) return { data: [], total: 0 };
    const allData = data.pages.flatMap((page) =>
      Array.isArray(page.data) ? page.data : Array.isArray(page) ? page : []
    );
    const total = data.pages[0]?.total ?? allData.length;
    return { data: allData, total };
  }, [data]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/refueling-abroad/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/refueling-abroad`] });
      toast({
        title: "Запись удалена",
        description: "Заправка за рубежом успешно удалена",
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
    refuelingDeals,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    search,
    setSearch,
    pageSize,
    columnFilters,
    setColumnFilters,
    deleteMutation,
    handleDelete,
  };
}
