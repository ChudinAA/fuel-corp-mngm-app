import { useEffect, useRef } from "react";
import { queryClient } from "@/lib/queryClient";

interface SSEEventData {
  warehouseId: string;
  productType: string;
}

export function useWarehouseSSE(isAuthenticated: boolean) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const connect = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource("/api/warehouses/sse/events", {
        withCredentials: true,
      });

      eventSource.onopen = () => {
        console.log("[SSE] Connected to warehouse events");
      };

      eventSource.addEventListener("warehouse_recalculated", (event) => {
        try {
          const data: SSEEventData = JSON.parse(event.data);
          console.log("[SSE] Warehouse recalculated:", data);

          queryClient.invalidateQueries({
            queryKey: ["/api/warehouses", data.warehouseId, "balance"],
          });

          queryClient.invalidateQueries({
            queryKey: ["/api/warehouses", data.warehouseId, "transactions"],
          });

          queryClient.invalidateQueries({
            queryKey: ["/api/warehouses", data.warehouseId],
          });

          queryClient.invalidateQueries({
            queryKey: ["/api/warehouses"],
          });

          queryClient.invalidateQueries({
            queryKey: ["/api/opt"],
          });

          queryClient.invalidateQueries({
            queryKey: ["/api/refueling"],
          });

          queryClient.invalidateQueries({
            queryKey: ["/api/movement"],
          });
        } catch (error) {
          console.error("[SSE] Failed to parse event data:", error);
        }
      });

      eventSource.onerror = () => {
        eventSource.close();
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      };

      eventSourceRef.current = eventSource;
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isAuthenticated]);
}
