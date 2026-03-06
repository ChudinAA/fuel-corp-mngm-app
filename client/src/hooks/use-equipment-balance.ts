import { PRODUCT_TYPE } from "@shared/constants";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

export function useEquipmentBalance(
  equipmentId: string | undefined,
  date: Date | undefined,
  productType?: string,
) {
  return useQuery({
    queryKey: [
      "/api/warehouses-equipment",
      equipmentId,
      "balance",
      date ? format(date, "yyyy-MM-dd") : undefined,
      productType,
    ],
    queryFn: async () => {
      if (productType === PRODUCT_TYPE.SERVICE) return { balance: "0", averageCost: "0" };
      if (!equipmentId || !date) return { balance: "0", averageCost: "0" };
      const params = new URLSearchParams({
        date: format(date, "yyyy-MM-dd"),
      });
      if (productType) params.append("productType", productType);
      const res = await fetch(
        `/api/warehouses-equipment/${equipmentId}/balance?${params.toString()}`,
      );
      if (!res.ok) throw new Error("Failed to fetch equipment balance");
      const data = await res.json();
      return {
        balance: data.balance as string,
        averageCost: data.averageCost as string | null,
      };
    },
    enabled: !!equipmentId && !!date,
  });
}
