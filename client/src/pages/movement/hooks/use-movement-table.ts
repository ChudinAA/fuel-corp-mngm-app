import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export function useMovementTable() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});

  const { data: movements, isLoading } = useQuery<{ data: any[], total: number }>({
    queryKey: ["/api/movement", page, pageSize, search, ...Object.entries(columnFilters).map(([k, v]) => `${k}:${v.join(",")}`)],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        search: search
      });
      
      Object.entries(columnFilters).forEach(([k, v]) => {
        if (v.length > 0) {
          params.append(`filter_${k}`, v.join(","));
        }
      });

      const res = await apiRequest("GET", `/api/movement?${params.toString()}`);
      return res.json();
    }
  });

  return {
    page,
    setPage,
    search,
    setSearch,
    pageSize,
    movements,
    isLoading,
    columnFilters,
    setColumnFilters,
  };
}
