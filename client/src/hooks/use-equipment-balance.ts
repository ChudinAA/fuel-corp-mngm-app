import { PRODUCT_TYPE } from "@shared/constants";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  formatTonnesForInput,
  kilogramsToTonnes,
  pricePerKilogramToPerTonne,
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
           balance: "0",
            balanceTonnes: "0",
           averageCost: "0",
           averageCostPerTonne: "0.000",
         };
       }
       if (!equipmentId || !date) {
         return {
           balance: "0",
            balanceTonnes: "0",
           averageCost: "0",
           averageCostPerTonne: "0.000",
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
       const balance = String(data.balance ?? "0");
       const averageCost =
         data.averageCost == null ? null : String(data.averageCost);
      return {
         balance,
          balanceTonnes: formatTonnesForInput(
            data.balanceTonnes == null
              ? kilogramsToTonnes(Number(balance))
              : String(data.balanceTonnes),
          ),
         averageCost,
         averageCostPerTonne:
           data.averageCostPerTonne == null
             ? averageCost == null
               ? null
               : pricePerKilogramToPerTonne(Number(averageCost)).toFixed(3)
             : String(data.averageCostPerTonne),
      };
    },
    enabled: !!equipmentId && !!date,
  });
}
