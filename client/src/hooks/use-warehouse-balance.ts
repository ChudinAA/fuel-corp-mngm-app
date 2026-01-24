import { PRODUCT_TYPE } from "@shared/constants";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

export function useWarehouseBalance(warehouseId: string | undefined, date: Date | undefined, productType?: string) {
  return useQuery({
    queryKey: ["/api/warehouses", warehouseId, "balance", date ? format(date, "yyyy-MM-dd") : undefined, productType],
    queryFn: async () => {
      if (productType === PRODUCT_TYPE.SERVICE) return "0";
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

import { useState, useEffect } from "react";

export function useWarehouseBalance(warehouseId: string | undefined, date: Date | undefined, productType?: string) {
  // ...
}

export function useWarehouses() {
  const [forcedPollingCount, setForcedPollingCount] = useState(0);

  useEffect(() => {
    if (forcedPollingCount > 0) {
      const timer = setTimeout(() => {
        setForcedPollingCount(prev => prev - 1);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [forcedPollingCount]);

  const query = useQuery({
    queryKey: ["/api/warehouses"],
    queryFn: async () => {
      const res = await fetch("/api/warehouses");
      if (!res.ok) throw new Error("Failed to fetch warehouses");
      return res.json();
    },
    refetchInterval: (query) => {
      if (forcedPollingCount > 0) return 2000;
      
      const warehouses = query.state.data as any[];
      if (warehouses && warehouses.some((w: any) => w.isRecalculating)) {
        return 2000; // Poll every 2s if any warehouse is recalculating
      }
      return false; // Disable polling otherwise
    }
  });

  return {
    ...query,
    startForcedPolling: () => setForcedPollingCount(3) // 3 times * 2s = 6s of forced polling
  };
}
