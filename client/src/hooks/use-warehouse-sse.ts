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

/**
 * Maps SSE entity name → all queryKeys that client A invalidates on mutation.
 * Must stay in sync with onSuccess handlers in each entity's hook/page.
 *
 * Rules:
 * - /api/warehouses balance changes are handled separately by warehouse_recalculated
 *   (fired by the background recalculation worker), so we don't repeat them here.
 * - /api/warehouses/equipment-map IS included for equipment-movement and refueling
 *   because we want immediate invalidation, not waiting for the worker (up to 5s).
 * - Note: invalidateQueries({ queryKey: ["/api/opt"] }) uses prefix matching and
 *   will match ["/api/opt", filters] etc. — but NOT ["/api/opt/contract-used"]
 *   because that is a different first array element. Hence both are listed.
 */
const ENTITY_QUERY_KEYS: Record<string, string[][]> = {
  opt: [
    ["/api/opt"],
    ["/api/opt/contract-used"],
  ],
  refueling: [
    ["/api/refueling"],
    ["/api/refueling/contract-used"],
    ["/api/warehouses/equipment-map"],
  ],
  "refueling-abroad": [
    ["/api/refueling-abroad"],
    ["/api/refueling-abroad/contract-used"],
    ["/api/storage-cards/advances"],
    ["/api/settings/beneficiary"],
  ],
  movement: [
    ["/api/movement"],
    ["/api/opt/contract-used"],
  ],
  transportation: [
    ["/api/transportation"],
  ],
  "exchange-deals": [
    ["/api/exchange-deals"],
    ["/api/exchange-advances"],
    ["/api/exchange-advances/by-seller"],
    ["/api/movement"],
  ],
  "equipment-movement": [
    ["/api/equipment-movement"],
    ["/api/warehouses/equipment-map"],
    ["/api/warehouses/lik"],
    ["/api/warehouses-equipment"],
  ],
  prices: [
    ["/api/prices"],
    ["/api/prices/list"],
    ["/api/prices/find-active"],
    ["/api/storage-cards/advances"],
    ["/api/prices/last-contract-info"],
  ],
  // Warehouse/equipment CRUD (not recalculation — that comes via warehouse_recalculated)
  "warehouses-crud": [
    ["/api/warehouses"],
  ],
  "warehouses-equipment-crud": [
    ["/api/warehouses-equipment"],
    ["/api/warehouses/equipment-map"],
  ],
  // Reference directories
  customers: [
    ["/api/customers"],
  ],
  suppliers: [
    ["/api/suppliers"],
  ],
  bases: [
    ["/api/bases"],
  ],
  "logistics-directories": [
    ["/api/logistics/carriers"],
    ["/api/logistics/vehicles"],
    ["/api/logistics/drivers"],
    ["/api/logistics/trailers"],
    ["/api/logistics/delivery-locations"],
  ],
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

    // Warehouse recalculation — fired by background worker after balance recompute
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

    // Generic entity change — fired immediately after any mutation
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

    // Auth error — close permanently (session gone)
    eventSource.addEventListener("auth_error", () => {
      console.warn("[SSE] Auth error, closing connection");
      eventSource.close();
      eventSourceRef.current = null;
    });

    // Network/server error — do NOT close; browser auto-reconnects EventSource
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
