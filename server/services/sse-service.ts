import { Response } from "express";

interface SSEClient {
  res: Response;
  clientId: string | null;
}

export class SSEService {
  private static clients: Set<SSEClient> = new Set();

  static register(res: Response, clientId: string | null = null) {
    const client: SSEClient = { res, clientId };
    this.clients.add(client);
    res.on("close", () => {
      this.clients.delete(client);
    });
  }

  static broadcast(event: string, data: any, excludeClientId?: string | null) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    this.clients.forEach((client) => {
      if (excludeClientId && client.clientId === excludeClientId) return;
      try {
        client.res.write(payload);
      } catch {
        this.clients.delete(client);
      }
    });
  }

  // Warehouse recalculation (existing)
  static notifyRecalculationCompleted(warehouseId: string, productType: string) {
    this.broadcast("warehouse_recalculated", { warehouseId, productType });
  }

  // Generic entity change notification
  static notifyEntityChanged(entity: string, excludeClientId?: string | null) {
    this.broadcast("entity_changed", { entity }, excludeClientId);
  }
}
