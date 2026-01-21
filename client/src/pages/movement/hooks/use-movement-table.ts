import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export function useMovementTable() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});

  const { data: movements, isLoading } = useQuery<{ data: any[], total: number }>({
    queryKey: ["/api/movement", page, pageSize, search, columnFilters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      
      if (search) params.append("search", search);
      
      Object.entries(columnFilters).forEach(([k, v]) => {
        if (v.length > 0) {
          v.forEach(val => params.append(`filter_${k}`, val));
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
