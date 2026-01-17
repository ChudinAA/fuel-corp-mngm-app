import { useQuery } from "@tanstack/react-query";

export function useWarehouseBalance(warehouseId: string | undefined, date: Date | undefined, productType?: string) {
  return useQuery({
    queryKey: ["/api/warehouses", warehouseId, "balance", date?.toISOString(), productType],
    queryFn: async () => {
      if (!warehouseId || !date) return "0";
      const params = new URLSearchParams({
        date: date.toISOString(),
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
