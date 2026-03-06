import { eq, and, or, lt, sql } from "drizzle-orm";
import { db } from "server/db";
import { equipmentRecalculationQueue } from "../entities/equipment";
import { RECALCULATION_STATUS } from "@shared/constants";

export class EquipmentRecalculationQueueService {
  static async addToQueue(
    equipmentId: string,
    productType: string,
    afterDate: string,
    createdById?: string,
    priority: number = 0,
  ): Promise<void> {
    const existingPending = await db.query.equipmentRecalculationQueue.findFirst({
      where: and(
        eq(equipmentRecalculationQueue.equipmentId, equipmentId),
        eq(equipmentRecalculationQueue.productType, productType),
        or(
          eq(equipmentRecalculationQueue.status, RECALCULATION_STATUS.PENDING),
          eq(equipmentRecalculationQueue.status, RECALCULATION_STATUS.PROCESSING),
        ),
      ),
    });

    if (existingPending) {
      const existingDate = new Date(existingPending.afterDate || "");
      const newDate = new Date(afterDate);

      if (newDate < existingDate) {
        await db
          .update(equipmentRecalculationQueue)
          .set({
            afterDate,
            priority: Math.max(existingPending.priority || 0, priority),
          })
          .where(eq(equipmentRecalculationQueue.id, existingPending.id));

        console.log(
          `[EquipmentRecalculationQueue] Updated task ${existingPending.id} with earlier date: ${afterDate}`,
        );
      }
      return;
    }

    await db.insert(equipmentRecalculationQueue).values({
      equipmentId,
      productType,
      afterDate,
      status: RECALCULATION_STATUS.PENDING,
      priority,
      createdById,
    });

    console.log(
      `[EquipmentRecalculationQueue] Added task for equipment ${equipmentId}, productType ${productType}, afterDate ${afterDate}`,
    );
  }

  static async claimNextTask() {
    const result = await db.execute(sql`
      UPDATE equipment_recalculation_queue
      SET
        status = ${RECALCULATION_STATUS.PROCESSING},
        attempts = attempts + 1,
        processing_started_at = NOW()
      WHERE id = (
        SELECT id FROM equipment_recalculation_queue
        WHERE status = ${RECALCULATION_STATUS.PENDING}
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `);

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as any;
      return {
        id: row.id,
        equipmentId: row.equipment_id,
        productType: row.product_type,
        afterDate: row.after_date,
        status: row.status,
        priority: row.priority,
        attempts: row.attempts,
        createdById: row.created_by_id,
        createdAt: row.created_at,
        processingStartedAt: row.processing_started_at,
      };
    }

    return null;
  }

  static async markAsCompleted(taskId: string) {
    await db
      .update(equipmentRecalculationQueue)
      .set({
        status: RECALCULATION_STATUS.COMPLETED,
        processedAt: sql`NOW()`,
        errorMessage: null,
      })
      .where(eq(equipmentRecalculationQueue.id, taskId));
  }

  static async markAsFailed(taskId: string, errorMessage: string) {
    const task = await db.query.equipmentRecalculationQueue.findFirst({
      where: eq(equipmentRecalculationQueue.id, taskId),
    });

    const attempts = task?.attempts || 0;
    const maxAttempts = 3;

    if (attempts >= maxAttempts) {
      await db
        .update(equipmentRecalculationQueue)
        .set({
          status: RECALCULATION_STATUS.FAILED,
          errorMessage,
          processedAt: sql`NOW()`,
        })
        .where(eq(equipmentRecalculationQueue.id, taskId));
    } else {
      await db
        .update(equipmentRecalculationQueue)
        .set({
          status: RECALCULATION_STATUS.PENDING,
          errorMessage,
          processingStartedAt: null,
        })
        .where(eq(equipmentRecalculationQueue.id, taskId));
    }
  }

  static async resetStuckTasks() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const result = await db
      .update(equipmentRecalculationQueue)
      .set({
        status: RECALCULATION_STATUS.PENDING,
        errorMessage: "Task was stuck in processing state",
        processingStartedAt: null,
      })
      .where(
        and(
          eq(equipmentRecalculationQueue.status, RECALCULATION_STATUS.PROCESSING),
          lt(equipmentRecalculationQueue.processingStartedAt, fiveMinutesAgo),
        ),
      )
      .returning();

    if (result.length > 0) {
      console.log(
        `[EquipmentRecalculationQueue] Reset ${result.length} stuck tasks`,
      );
    }
  }

  static async hasPendingTasks(
    equipmentId: string,
    productType: string,
  ): Promise<boolean> {
    const task = await db.query.equipmentRecalculationQueue.findFirst({
      where: and(
        eq(equipmentRecalculationQueue.equipmentId, equipmentId),
        eq(equipmentRecalculationQueue.productType, productType),
        or(
          eq(equipmentRecalculationQueue.status, RECALCULATION_STATUS.PENDING),
          eq(equipmentRecalculationQueue.status, RECALCULATION_STATUS.PROCESSING),
        ),
      ),
    });

    return !!task;
  }
}
