import { db } from "server/db";
import { eq, sql } from "drizzle-orm";
import { equipments } from "../entities/equipment";
import { EquipmentRecalculationQueueService } from "./equipment-recalculation-queue-service";
import { EquipmentRecalculationService } from "./equipment-recalculation-service";

export class EquipmentRecalculationWorker {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;
  private static isProcessing = false;

  static start(intervalMs: number = 5000) {
    if (this.isRunning) {
      console.log("[EquipmentRecalculationWorker] Already running");
      return;
    }

    this.isRunning = true;
    console.log(
      `[EquipmentRecalculationWorker] Starting with interval ${intervalMs}ms`,
    );

    this.intervalId = setInterval(async () => {
      await this.processNextTask();
    }, intervalMs);

    EquipmentRecalculationQueueService.resetStuckTasks();
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("[EquipmentRecalculationWorker] Stopped");
  }

  private static async processNextTask() {
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      const task = await EquipmentRecalculationQueueService.claimNextTask();

      if (!task) {
        this.isProcessing = false;
        return;
      }

      console.log(
        `[EquipmentRecalculationWorker] Processing task ${task.id} for equipment ${task.equipmentId}`,
      );

      try {
        await db.transaction(async (tx) => {
          await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtext(${task.equipmentId} || ${task.productType}))`,
          );

          await EquipmentRecalculationService.recalculateEquipmentFromDate(
            tx,
            task.equipmentId,
            task.afterDate || new Date(0).toISOString(),
            task.productType || "kerosene",
            task.createdById || undefined,
          );
        });

        await EquipmentRecalculationQueueService.markAsCompleted(task.id);
        console.log(
          `[EquipmentRecalculationWorker] Task ${task.id} completed successfully`,
        );
      } catch (error: any) {
        console.error(
          `[EquipmentRecalculationWorker] Task ${task.id} failed:`,
          error,
        );
        await EquipmentRecalculationQueueService.markAsFailed(
          task.id,
          error.message || "Unknown error",
        );
      }
    } catch (error) {
      console.error(
        "[EquipmentRecalculationWorker] Error in processNextTask:",
        error,
      );
    } finally {
      this.isProcessing = false;
    }
  }
}
