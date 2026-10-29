import { PRODUCT_TYPE } from "@shared/constants";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  formatTonnesForInput,
} from "@shared/units";

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
       if (productType === PRODUCT_TYPE.SERVICE) {
         return {
            balanceTonnes: "0",
            averageCostPerTonne: null,
         };
       }
       if (!equipmentId || !date) {
         return {
            balanceTonnes: "0",
            averageCostPerTonne: null,
         };
       }
      const params = new URLSearchParams({
        date: format(date, "yyyy-MM-dd"),
      });
      if (productType) params.append("productType", productType);
      const res = await fetch(
        `/api/warehouses-equipment/${equipmentId}/balance?${params.toString()}`,
      );
      if (!res.ok) throw new Error("Failed to fetch equipment balance");
      const data = await res.json();
        if (data.balanceTonnes == null) {
          throw new Error(
            "Equipment balance response is missing balanceTonnes",
          );
        }
      return {
          balanceTonnes: formatTonnesForInput(data.balanceTonnes),
          averageCostPerTonne:
            data.averageCostPerTonne == null
              ? null
              : String(data.averageCostPerTonne),
      };
    },
    enabled: !!equipmentId && !!date,
  });
}
