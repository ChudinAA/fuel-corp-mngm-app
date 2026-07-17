import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

export function usePriceSSE() {
  useEffect(() => {
    const eventSource = new EventSource("/api/prices/sse/events", {
      withCredentials: true,
    });

    eventSource.addEventListener("price_recalculation_completed", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        queryClient.invalidateQueries({ queryKey: ["/api/prices/list"] });
        queryClient.invalidateQueries({ queryKey: ["/api/prices/find-active"] });
        if (data.priceId) {
          queryClient.invalidateQueries({
            queryKey: [`/api/prices/${data.priceId}/recalculation-tasks`],
          });
        }
        // Invalidate all deal types that may have been recalculated
        queryClient.invalidateQueries({ queryKey: ["/api/opt"] });
        queryClient.invalidateQueries({ queryKey: ["/api/refueling"] });
        queryClient.invalidateQueries({ queryKey: ["/api/movement"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transportation"] });
      } catch (err) {
        console.error("[usePriceSSE] Failed to parse event data:", err);
      }
    });

    eventSource.onerror = () => {
      // EventSource auto-reconnects on error
    };

    return () => {
      eventSource.close();
    };
  }, []);
}
