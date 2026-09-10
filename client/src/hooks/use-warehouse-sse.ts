import { useEffect, useRef } from "react";
import { queryClient } from "@/lib/queryClient";
import { CLIENT_ID } from "@/lib/client-id";

interface SSEEventData {
  warehouseId: string;
  productType: string;
}

interface EntityChangedData {
  entity: string;
}

/** Maps entity name to the query keys that should be invalidated */
const ENTITY_QUERY_KEYS: Record<string, string[][]> = {
  opt:                [["/api/opt"]],
  refueling:          [["/api/refueling"]],
  "refueling-abroad": [["/api/refueling-abroad"]],
  movement:           [["/api/movement"]],
  transportation:     [["/api/transportation"]],
  "exchange-deals":   [["/api/exchange-deals"]],
  "equipment-movement": [["/api/equipment-movement"]],
  prices:             [["/api/prices"], ["/api/prices/list"]],
  warehouses:         [["/api/warehouses"]],
};

export function useWarehouseSSE(isAuthenticated: boolean) {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/warehouses/sse/events?clientId=${encodeURIComponent(CLIENT_ID)}`;
    const eventSource = new EventSource(url, { withCredentials: true });

    eventSource.onopen = () => {
      console.log("[SSE] Connected");
    };

    // Warehouse recalculation (existing)
    eventSource.addEventListener("warehouse_recalculated", (event) => {
      try {
        const data: SSEEventData = JSON.parse(event.data);
        console.log("[SSE] Warehouse recalculated:", data);

        queryClient.invalidateQueries({ queryKey: ["/api/warehouses", data.warehouseId, "balance"] });
        queryClient.invalidateQueries({ queryKey: ["/api/warehouses", data.warehouseId, "transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/warehouses", data.warehouseId] });
        queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
        queryClient.invalidateQueries({ queryKey: ["/api/opt"] });
        queryClient.invalidateQueries({ queryKey: ["/api/refueling"] });
        queryClient.invalidateQueries({ queryKey: ["/api/movement"] });
        queryClient.invalidateQueries({ queryKey: ["/api/equipment-movement"] });
        queryClient.invalidateQueries({ queryKey: ["/api/warehouses/equipment-map"] });
      } catch (error) {
        console.error("[SSE] Failed to parse warehouse_recalculated:", error);
      }
    });

    // Generic entity change (new)
    eventSource.addEventListener("entity_changed", (event) => {
      try {
        const data: EntityChangedData = JSON.parse(event.data);
        console.log("[SSE] Entity changed:", data.entity);

        const keys = ENTITY_QUERY_KEYS[data.entity];
        if (keys) {
          keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
        }
      } catch (error) {
        console.error("[SSE] Failed to parse entity_changed:", error);
      }
    });

    eventSource.addEventListener("auth_error", () => {
      console.warn("[SSE] Auth error, closing connection");
      eventSource.close();
      eventSourceRef.current = null;
    });

    // Do NOT close on error — browser auto-reconnects EventSource on network issues
    eventSource.onerror = (err) => {
      console.warn("[SSE] Connection error (will auto-reconnect):", err);
    };

    eventSourceRef.current = eventSource;

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isAuthenticated]);
}
