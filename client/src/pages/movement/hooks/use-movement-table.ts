import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export function useMovementTable() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});

  const { data: movements, isLoading } = useQuery({
    queryKey: ["/api/movement", { page, pageSize, search, ...Object.fromEntries(
      Object.entries(columnFilters).map(([k, v]) => [`filter_${k}`, v.join(",")])
    )}],
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
