import { Response } from "express";

export class SSEService {
  private static clients: Set<Response> = new Set();

  static register(res: Response) {
    this.clients.add(res);
    res.on("close", () => {
      this.clients.delete(res);
    });
  }

  static broadcast(event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    this.clients.forEach(res => {
      res.write(payload);
    });
  }

  static notifyRecalculationCompleted(warehouseId: string, productType: string) {
    this.broadcast("warehouse_recalculated", { warehouseId, productType });
  }
}
