import { db } from "server/db";
import { eq, sql } from "drizzle-orm";
import { RecalculationQueueService } from "./recalculation-queue-service";
import { WarehouseRecalculationService } from "./warehouse-recalculation-service";
import { warehouses } from "@shared/schema";
import { SSEService } from "server/services/sse-service";

export class RecalculationWorker {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;
  private static isProcessing = false;

  static start(intervalMs: number = 5000) {
    if (this.isRunning) {
      console.log("[RecalculationWorker] Already running");
      return;
    }

    this.isRunning = true;
    console.log(`[RecalculationWorker] Starting with interval ${intervalMs}ms`);

    this.intervalId = setInterval(async () => {
      await this.processNextTask();
    }, intervalMs);

    RecalculationQueueService.resetStuckTasks();
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("[RecalculationWorker] Stopped");
  }

  private static async processNextTask() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const task = await RecalculationQueueService.claimNextTask();

      if (!task) {
        this.isProcessing = false;
        return;
      }

      console.log(
        `[RecalculationWorker] Processing task ${task.id} for warehouse ${task.warehouseId}`,
      );

      // Set isRecalculating flag
      await this.setWarehouseRecalculatingFlag(true, task.warehouseId);

      try {
        await db.transaction(async (tx) => {
          await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtext(${task.warehouseId} || ${task.productType}))`,
          );

          const visitedWarehouses = new Set<string>();

          await WarehouseRecalculationService.recalculateAllAffectedTransactions(
            tx,
            [
              {
                warehouseId: task.warehouseId,
                afterDate: task.afterDate || new Date(0).toISOString(),
                productType: task.productType || "kerosene",
              },
            ],
            task.createdById || undefined,
            visitedWarehouses,
          );
        });

        await RecalculationQueueService.markAsCompleted(task.id);
        await this.setWarehouseRecalculatingFlag(false, task.warehouseId);
        SSEService.notifyRecalculationCompleted(task.warehouseId, task.productType);
        console.log(
          `[RecalculationWorker] Task ${task.id} completed successfully`,
        );
      } catch (error: any) {
        console.error(`[RecalculationWorker] Task ${task.id} failed:`, error);
        await RecalculationQueueService.markAsFailed(
          task.id,
          error.message || "Unknown error",
        );
        // Set isRecalculating flag
        await this.setWarehouseRecalculatingFlag(false, task.warehouseId);
        SSEService.notifyRecalculationCompleted(task.warehouseId, task.productType);
      }
    } catch (error) {
      console.error("[RecalculationWorker] Error in processNextTask:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  static async setWarehouseRecalculatingFlag(
    isRecalculating: boolean,
    warehouseId: any,
  ) {
    await db
      .update(warehouses)
      .set({ isRecalculating: isRecalculating })
      .where(eq(warehouses.id, warehouseId));
  }
}
