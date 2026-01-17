import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

export function useWarehouseBalance(warehouseId: string | undefined, date: Date | undefined, productType?: string) {
  return useQuery({
    queryKey: ["/api/warehouses", warehouseId, "balance", date ? format(date, "yyyy-MM-dd") : undefined, productType],
    queryFn: async () => {
      if (!warehouseId || !date) return "0";
      const params = new URLSearchParams({
        date: format(date, "yyyy-MM-dd"),
      });
      if (productType) params.append("productType", productType);
      const res = await fetch(`/api/warehouses/${warehouseId}/balance?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch balance");
      const data = await res.json();
      return data.balance as string;
    },
    enabled: !!warehouseId && !!date,
  });
}
