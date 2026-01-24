import { db } from "server/db";
import { sql, eq } from "drizzle-orm";
import { warehouses } from "@shared/schema";
import { RecalculationQueueService } from "./recalculation-queue-service";
import { WarehouseRecalculationService } from "./warehouse-recalculation-service";

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

      console.log(`[RecalculationWorker] Processing task ${task.id} for warehouse ${task.warehouseId}`);

      try {
        await db.transaction(async (tx) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${task.warehouseId} || ${task.productType}))`);

          // Set isRecalculating flag
          await tx.update(warehouses)
            .set({ isRecalculating: true })
            .where(eq(warehouses.id, task.warehouseId));

          const visitedWarehouses = new Set<string>();
          
          await WarehouseRecalculationService.recalculateAllAffectedTransactions(
            tx,
            [{
              warehouseId: task.warehouseId,
              afterDate: task.afterDate || new Date(0).toISOString(),
              productType: task.productType || "kerosene",
            }],
            task.createdById || undefined,
            visitedWarehouses
          );

          // Reset isRecalculating flag
          await tx.update(warehouses)
            .set({ isRecalculating: false })
            .where(eq(warehouses.id, task.warehouseId));
        });

        await RecalculationQueueService.markAsCompleted(task.id);
        console.log(`[RecalculationWorker] Task ${task.id} completed successfully`);

      } catch (error: any) {
        console.error(`[RecalculationWorker] Task ${task.id} failed:`, error);
        
        // Ensure flag is reset even on failure
        try {
          await db.update(warehouses)
            .set({ isRecalculating: false })
            .where(eq(warehouses.id, task.warehouseId));
        } catch (resetError) {
          console.error("[RecalculationWorker] Failed to reset isRecalculating flag:", resetError);
        }

        await RecalculationQueueService.markAsFailed(task.id, error.message || "Unknown error");
      }

    } catch (error) {
      console.error("[RecalculationWorker] Error in processNextTask:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  static async processImmediately(warehouseId: string, productType: string, afterDate: string, userId?: string) {
    console.log(`[RecalculationWorker] Processing immediately for warehouse ${warehouseId}`);

    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${warehouseId} || ${productType}))`);

        // Set isRecalculating flag
        await tx.update(warehouses)
          .set({ isRecalculating: true })
          .where(eq(warehouses.id, warehouseId));

        const visitedWarehouses = new Set<string>();
        
        await WarehouseRecalculationService.recalculateAllAffectedTransactions(
          tx,
          [{
            warehouseId,
            afterDate,
            productType,
          }],
          userId,
          visitedWarehouses
        );

        // Reset isRecalculating flag
        await tx.update(warehouses)
          .set({ isRecalculating: false })
          .where(eq(warehouses.id, warehouseId));
      });

      console.log(`[RecalculationWorker] Immediate processing completed for warehouse ${warehouseId}`);
    } catch (error) {
      console.error(`[RecalculationWorker] Immediate processing failed for warehouse ${warehouseId}:`, error);
      
      // Ensure flag is reset on failure
      try {
        await db.update(warehouses)
          .set({ isRecalculating: false })
          .where(eq(warehouses.id, warehouseId));
      } catch (resetError) {
        console.error("[RecalculationWorker] Failed to reset isRecalculating flag in immediate mode:", resetError);
      }
      
      throw error;
    }
  }
}
