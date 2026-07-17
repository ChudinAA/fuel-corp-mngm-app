import { db } from "server/db";
import { eq, inArray, sql } from "drizzle-orm";
import { priceRecalculationTasks, PRICE_RECALC_STATUS, PRICE_RECALC_DEAL_TYPE } from "../entities/price-recalculation-tasks";
import { prices, opt, aircraftRefueling, movement, transportation } from "@shared/schema";
import { SSEService } from "server/services/sse-service";
import { PriceRecalculationService } from "./price-recalculation-service";
import { RecalculationQueueService } from "../../warehouses/services/recalculation-queue-service";

export class PriceRecalculationWorker {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;
  private static isProcessing = false;

  static start(intervalMs: number = 5000) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[PriceRecalculationWorker] Starting with interval ${intervalMs}ms`);
    this.intervalId = setInterval(async () => {
      await this.processNextTask();
    }, intervalMs);
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("[PriceRecalculationWorker] Stopped");
  }

  private static async processNextTask() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Claim next pending task using FOR UPDATE SKIP LOCKED
      const result = await db.execute(sql`
        UPDATE price_recalculation_tasks
        SET status = ${PRICE_RECALC_STATUS.PROCESSING}
        WHERE id = (
          SELECT id FROM price_recalculation_tasks
          WHERE status = ${PRICE_RECALC_STATUS.PENDING}
          ORDER BY created_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `);

      if (!result.rows || result.rows.length === 0) {
        this.isProcessing = false;
        return;
      }

      const row = result.rows[0] as any;
      const task = {
        id: row.id,
        priceId: row.price_id,
        dealType: row.deal_type,
        dealId: row.deal_id,
        status: row.status,
      };

      console.log(`[PriceRecalculationWorker] Processing task ${task.id} for price ${task.priceId}, deal ${task.dealType}/${task.dealId}`);

      try {
        await this.processTask(task);

        await db
          .update(priceRecalculationTasks)
          .set({
            status: PRICE_RECALC_STATUS.DONE,
            completedAt: sql`NOW()`,
          })
          .where(eq(priceRecalculationTasks.id, task.id));

        console.log(`[PriceRecalculationWorker] Task ${task.id} completed`);
      } catch (error: any) {
        console.error(`[PriceRecalculationWorker] Task ${task.id} failed:`, error?.message);
        await db
          .update(priceRecalculationTasks)
          .set({
            status: PRICE_RECALC_STATUS.FAILED,
            errorMessage: error?.message || "Unknown error",
            completedAt: sql`NOW()`,
          })
          .where(eq(priceRecalculationTasks.id, task.id));
      }

      // Check if all tasks for this price are done
      const allDone = await PriceRecalculationService.checkIfAllDone(task.priceId);
      if (allDone) {
        await PriceRecalculationService.markPriceRecalculationComplete(task.priceId);
        SSEService.broadcast("price_recalculation_completed", { priceId: task.priceId });
        console.log(`[PriceRecalculationWorker] All tasks done for price ${task.priceId}`);
      }
    } catch (error) {
      console.error("[PriceRecalculationWorker] Error in processNextTask:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  private static async processTask(task: {
    id: string;
    priceId: string;
    dealType: string;
    dealId: string;
  }) {
    // Get the current price value
    const [currentPrice] = await db
      .select({ priceValues: prices.priceValues })
      .from(prices)
      .where(eq(prices.id, task.priceId));

    if (!currentPrice?.priceValues?.length) {
      throw new Error("Price values not found");
    }

    const newPriceRaw = JSON.parse(currentPrice.priceValues[0]);
    const newPrice = parseFloat(newPriceRaw.price);

    if (isNaN(newPrice)) {
      throw new Error("Invalid price value");
    }

    switch (task.dealType) {
      case PRICE_RECALC_DEAL_TYPE.OPT:
        await this.recalculateOptDeal(task.dealId, task.priceId, newPrice);
        break;
      case PRICE_RECALC_DEAL_TYPE.REFUELING:
        await this.recalculateRefuelingDeal(task.dealId, task.priceId, newPrice);
        break;
      case PRICE_RECALC_DEAL_TYPE.MOVEMENT:
        await this.recalculateMovementDeal(task.dealId, newPrice);
        break;
      case PRICE_RECALC_DEAL_TYPE.TRANSPORTATION:
        await this.recalculateTransportationDeal(task.dealId, task.priceId, newPrice);
        break;
      default:
        throw new Error(`Unknown deal type: ${task.dealType}`);
    }
  }

  private static async recalculateOptDeal(dealId: string, priceId: string, newPrice: number) {
    const [deal] = await db.select().from(opt).where(eq(opt.id, dealId));
    if (!deal) throw new Error(`OPT deal ${dealId} not found`);

    const qty = parseFloat(deal.quantityKg || "0");
    const updates: any = {};

    if (deal.purchasePriceId === priceId) {
      updates.purchasePrice = newPrice.toString();
      updates.purchaseAmount = (newPrice * qty).toFixed(2);
    }
    if (deal.salePriceId === priceId) {
      updates.salePrice = newPrice.toString();
      updates.saleAmount = (newPrice * qty).toFixed(2);
    }

    // Recalculate profit
    const purchasePrice = deal.purchasePriceId === priceId ? newPrice : parseFloat(deal.purchasePrice || "0");
    const salePrice = deal.salePriceId === priceId ? newPrice : parseFloat(deal.salePrice || "0");
    const purchaseAmount = purchasePrice * qty;
    const saleAmount = salePrice * qty;
    const deliveryCost = parseFloat(deal.deliveryCost || "0");
    updates.profit = (saleAmount - purchaseAmount - deliveryCost).toFixed(2);

    await db.update(opt).set({ ...updates, updatedAt: sql`NOW()` }).where(eq(opt.id, dealId));

    // If deal has a warehouse transaction, trigger warehouse recalculation
    if (deal.warehouseId && deal.transactionId) {
      await RecalculationQueueService.addToQueue(
        deal.warehouseId,
        deal.productType || "kerosene",
        deal.dealDate ? deal.dealDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      );
    }
  }

  private static async recalculateRefuelingDeal(dealId: string, priceId: string, newPrice: number) {
    const [deal] = await db.select().from(aircraftRefueling).where(eq(aircraftRefueling.id, dealId));
    if (!deal) throw new Error(`Refueling deal ${dealId} not found`);

    const qty = parseFloat(deal.quantityKg || "0");
    const updates: any = {};

    if (deal.purchasePriceId === priceId) {
      updates.purchasePrice = newPrice.toString();
      updates.purchaseAmount = (newPrice * qty).toFixed(2);
    }
    if (deal.salePriceId === priceId) {
      updates.salePrice = newPrice.toString();
      updates.saleAmount = (newPrice * qty).toFixed(2);
    }

    const purchasePrice = deal.purchasePriceId === priceId ? newPrice : parseFloat(deal.purchasePrice || "0");
    const salePrice = deal.salePriceId === priceId ? newPrice : parseFloat(deal.salePrice || "0");
    const purchaseAmount = purchasePrice * qty;
    const saleAmount = salePrice * qty;
    updates.profit = (saleAmount - purchaseAmount).toFixed(2);

    await db.update(aircraftRefueling).set({ ...updates, updatedAt: sql`NOW()` }).where(eq(aircraftRefueling.id, dealId));
  }

  private static async recalculateMovementDeal(dealId: string, newPrice: number) {
    const [deal] = await db.select().from(movement).where(eq(movement.id, dealId));
    if (!deal) throw new Error(`Movement deal ${dealId} not found`);

    const qty = parseFloat(deal.quantityKg || "0");
    const purchaseAmount = (newPrice * qty).toFixed(2);

    await db
      .update(movement)
      .set({
        purchasePrice: newPrice.toString(),
        purchaseAmount,
        updatedAt: sql`NOW()`,
      })
      .where(eq(movement.id, dealId));

    // Movement affects warehouse — trigger recalculation
    const warehouseId = deal.toWarehouseId || deal.fromWarehouseId;
    if (warehouseId) {
      await RecalculationQueueService.addToQueue(
        warehouseId,
        deal.productType || "kerosene",
        deal.movementDate ? deal.movementDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      );
    }
  }

  private static async recalculateTransportationDeal(dealId: string, priceId: string, newPrice: number) {
    const [deal] = await db.select().from(transportation).where(eq(transportation.id, dealId));
    if (!deal) throw new Error(`Transportation deal ${dealId} not found`);

    const qty = parseFloat(deal.quantityKg || "0");
    const updates: any = {};

    if (deal.purchasePriceId === priceId) {
      updates.purchasePrice = newPrice.toString();
      updates.purchaseAmount = (newPrice * qty).toFixed(2);
    }
    if (deal.salePriceId === priceId) {
      updates.salePrice = newPrice.toString();
      updates.saleAmount = (newPrice * qty).toFixed(2);
    }

    const purchasePrice = deal.purchasePriceId === priceId ? newPrice : parseFloat(deal.purchasePrice || "0");
    const salePrice = deal.salePriceId === priceId ? newPrice : parseFloat(deal.salePrice || "0");
    const purchaseAmount = purchasePrice * qty;
    const saleAmount = salePrice * qty;
    const deliveryCost = parseFloat(deal.deliveryCost || "0");
    updates.profit = (saleAmount - purchaseAmount - deliveryCost).toFixed(2);

    await db.update(transportation).set({ ...updates, updatedAt: sql`NOW()` }).where(eq(transportation.id, dealId));
  }
}
