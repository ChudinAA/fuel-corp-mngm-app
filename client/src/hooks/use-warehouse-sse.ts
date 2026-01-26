import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

export function useWarehouseSSE() {
  useEffect(() => {
    const eventSource = new EventSource("/api/events");

    eventSource.addEventListener("warehouse_recalculated", (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Warehouse recalculated via SSE:", data);
        
        // Invalidate warehouse balance queries
        queryClient.invalidateQueries({
          queryKey: ["/api/warehouses", data.warehouseId, "balance"],
        });
        
        // Invalidate warehouse transactions
        queryClient.invalidateQueries({
          queryKey: ["/api/warehouses", data.warehouseId, "transactions"],
        });

        // Invalidate specific warehouse details
        queryClient.invalidateQueries({
          queryKey: ["/api/warehouses", data.warehouseId],
        });

        // Broadly invalidate deals that might be affected
        queryClient.invalidateQueries({ queryKey: ["/api/opt"] });
        queryClient.invalidateQueries({ queryKey: ["/api/refueling"] });
        queryClient.invalidateQueries({ queryKey: ["/api/movement"] });
      } catch (err) {
        console.error("Error processing SSE event:", err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, []);
}
