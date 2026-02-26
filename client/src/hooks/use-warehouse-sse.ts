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
      if (!isAuthenticated) return;

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

          queryClient.invalidateQueries({
            queryKey: ["/api/equipment-movement"],
          });

          queryClient.invalidateQueries({
            queryKey: ["/api/warehouses/equipment-map"],
          });
        } catch (error) {
          console.error("[SSE] Failed to parse event data:", error);
        }
      });

      eventSource.onerror = (err) => {
        console.error("[SSE] Connection error:", err);
        eventSource.close();
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        // Exponential backoff or longer delay if not authenticated
        const delay = isAuthenticated ? 10000 : 40000;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
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
