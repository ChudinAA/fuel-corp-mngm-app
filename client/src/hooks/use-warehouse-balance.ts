import { PRODUCT_TYPE } from "@shared/constants";
import {
  formatTonnesForInput,
} from "@shared/units";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

export function useWarehouseBalance(warehouseId: string | undefined, date: Date | undefined, productType?: string) {
  return useQuery({
    queryKey: ["/api/warehouses", warehouseId, "balance", date ? format(date, "yyyy-MM-dd") : undefined, productType],
    queryFn: async () => {
      if (productType === PRODUCT_TYPE.SERVICE) {
        return { balanceTonnes: "0", averageCostPerTonne: null };
      }
      if (!warehouseId || !date) {
        return { balanceTonnes: "0", averageCostPerTonne: null };
      }
      const params = new URLSearchParams({
        date: format(date, "yyyy-MM-dd"),
      });
      if (productType) params.append("productType", productType);
      const res = await fetch(`/api/warehouses/${warehouseId}/balance?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch balance");
      const data = await res.json();
      if (data.balanceTonnes == null) {
        throw new Error("Warehouse balance response is missing balanceTonnes");
      }
      return {
        balanceTonnes: formatTonnesForInput(data.balanceTonnes),
        averageCostPerTonne: data.averageCostPerTonne == null
          ? null
          : String(data.averageCostPerTonne),
      };
    },
    enabled: !!warehouseId && !!date,
  });
}
