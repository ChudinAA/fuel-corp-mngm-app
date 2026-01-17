import { useQuery } from "@tanstack/react-query";

export function useWarehouseBalance(warehouseId: string | undefined, date: Date | undefined) {
  return useQuery({
    queryKey: ["/api/warehouses", warehouseId, "balance", date?.toISOString()],
    queryFn: async () => {
      if (!warehouseId || !date) return "0";
      const res = await fetch(`/api/warehouses/${warehouseId}/balance?date=${date.toISOString()}`);
      if (!res.ok) throw new Error("Failed to fetch balance");
      const data = await res.json();
      return data.balance as string;
    },
    enabled: !!warehouseId && !!date,
  });
}
