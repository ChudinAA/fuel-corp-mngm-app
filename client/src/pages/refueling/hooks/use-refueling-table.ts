
import { useState, useMemo } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AircraftRefueling } from "@shared/schema";

export function useRefuelingTable() {
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const pageSize = 20;
  const { toast } = useToast();

  const filterParams = Object.entries(columnFilters)
    .filter(([_, values]) => values.length > 0)
    .map(([columnId, values]) => `&filter_${columnId}=${values.join(",")}`)
    .join("");

  const { 
    data, 
    isLoading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useInfiniteQuery({
    queryKey: [`/api/refueling`, { search, columnFilters }],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await apiRequest(
        "GET", 
        `/api/refueling?offset=${pageParam}&pageSize=${pageSize}${search ? `&search=${search}` : ""}${filterParams}`
      );
      return res.json();
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + page.data.length, 0);
      return currentCount < lastPage.total ? currentCount : undefined;
    },
  });

  const refuelingDeals = useMemo(() => {
    if (!data) return { data: [], total: 0 };
    return {
      data: data.pages.flatMap((page) => page.data),
      total: data.pages[0]?.total || 0,
    };
  }, [data]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/refueling/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/refueling`] });
      toast({ title: "Заправка удалена", description: "Заправка ВС успешно удалена" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return {
    page,
    setPage,
    search,
    setSearch,
    pageSize,
    refuelingDeals,
    isLoading,
    columnFilters,
    setColumnFilters,
    deleteMutation,
    handleDelete,
  };
}
