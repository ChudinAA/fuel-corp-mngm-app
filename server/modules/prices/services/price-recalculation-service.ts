import { db } from "server/db";
import { eq, or, isNull, and, inArray } from "drizzle-orm";
import {
  prices,
  opt,
  aircraftRefueling,
  movement,
  transportation,
  suppliers,
  customers,
} from "@shared/schema";
import { priceRecalculationTasks, PRICE_RECALC_DEAL_TYPE, PRICE_RECALC_STATUS } from "../entities/price-recalculation-tasks";
import { sql } from "drizzle-orm";

export interface AffectedDeal {
  dealType: string;
  dealId: string;
  dealNumber: string;
  dealDate: string;
  counterpartyName: string;
  quantityKg: string | null;
  role: "purchase" | "sale";
}

export class PriceRecalculationService {
  static async findAffectedDeals(priceId: string): Promise<AffectedDeal[]> {
    const results: AffectedDeal[] = [];

    // OPT deals
    const optDeals = await db
      .select({
        id: opt.id,
        dealDate: opt.dealDate,
        quantityKg: opt.quantityKg,
        supplierId: opt.supplierId,
        buyerId: opt.buyerId,
        purchasePriceId: opt.purchasePriceId,
        salePriceId: opt.salePriceId,
        createdAt: opt.createdAt,
      })
      .from(opt)
      .where(
        and(
          or(eq(opt.purchasePriceId, priceId), eq(opt.salePriceId, priceId)),
          isNull(opt.deletedAt),
          eq(opt.isDraft, false),
        ),
      );

    for (const deal of optDeals) {
      const supplier = deal.supplierId
        ? await db.query.suppliers.findFirst({ where: eq(suppliers.id, deal.supplierId) })
        : null;
      const buyer = deal.buyerId
        ? await db.query.customers.findFirst({ where: eq(customers.id, deal.buyerId) })
        : null;

      const isPurchase = deal.purchasePriceId === priceId;
      results.push({
        dealType: PRICE_RECALC_DEAL_TYPE.OPT,
        dealId: deal.id,
        dealNumber: `ОПТ от ${deal.dealDate ? deal.dealDate.slice(0, 10) : "—"}`,
        dealDate: deal.dealDate ? deal.dealDate.slice(0, 10) : "",
        counterpartyName: isPurchase
          ? supplier?.name || "Не указан"
          : buyer?.name || "Не указан",
        quantityKg: deal.quantityKg,
        role: isPurchase ? "purchase" : "sale",
      });
    }

    // Refueling deals
    const refuelingDeals = await db
      .select({
        id: aircraftRefueling.id,
        dealDate: aircraftRefueling.dealDate,
        quantityKg: aircraftRefueling.quantityKg,
        supplierId: aircraftRefueling.supplierId,
        buyerId: aircraftRefueling.buyerId,
        purchasePriceId: aircraftRefueling.purchasePriceId,
        salePriceId: aircraftRefueling.salePriceId,
      })
      .from(aircraftRefueling)
      .where(
        and(
          or(
            eq(aircraftRefueling.purchasePriceId, priceId),
            eq(aircraftRefueling.salePriceId, priceId),
          ),
          isNull(aircraftRefueling.deletedAt),
          eq(aircraftRefueling.isDraft, false),
        ),
      );

    for (const deal of refuelingDeals) {
      const supplier = deal.supplierId
        ? await db.query.suppliers.findFirst({ where: eq(suppliers.id, deal.supplierId) })
        : null;
      const buyer = deal.buyerId
        ? await db.query.customers.findFirst({ where: eq(customers.id, deal.buyerId) })
        : null;
      const isPurchase = deal.purchasePriceId === priceId;
      results.push({
        dealType: PRICE_RECALC_DEAL_TYPE.REFUELING,
        dealId: deal.id,
        dealNumber: `Заправка ВС от ${deal.dealDate ? deal.dealDate.slice(0, 10) : "—"}`,
        dealDate: deal.dealDate ? deal.dealDate.slice(0, 10) : "",
        counterpartyName: isPurchase
          ? supplier?.name || "Не указан"
          : buyer?.name || "Не указан",
        quantityKg: deal.quantityKg,
        role: isPurchase ? "purchase" : "sale",
      });
    }

    // Movement deals
    const movementDeals = await db
      .select({
        id: movement.id,
        movementDate: movement.movementDate,
        quantityKg: movement.quantityKg,
        supplierId: movement.supplierId,
        purchasePriceId: movement.purchasePriceId,
      })
      .from(movement)
      .where(
        and(
          eq(movement.purchasePriceId, priceId),
          isNull(movement.deletedAt),
        ),
      );

    for (const deal of movementDeals) {
      const supplier = deal.supplierId
        ? await db.query.suppliers.findFirst({ where: eq(suppliers.id, deal.supplierId) })
        : null;
      results.push({
        dealType: PRICE_RECALC_DEAL_TYPE.MOVEMENT,
        dealId: deal.id,
        dealNumber: `Движение от ${deal.movementDate ? deal.movementDate.slice(0, 10) : "—"}`,
        dealDate: deal.movementDate ? deal.movementDate.slice(0, 10) : "",
        counterpartyName: supplier?.name || "Не указан",
        quantityKg: deal.quantityKg,
        role: "purchase",
      });
    }

    // Transportation deals
    const transportationDeals = await db
      .select({
        id: transportation.id,
        dealDate: transportation.dealDate,
        quantityKg: transportation.quantityKg,
        supplierId: transportation.supplierId,
        buyerId: transportation.buyerId,
        purchasePriceId: transportation.purchasePriceId,
        salePriceId: transportation.salePriceId,
      })
      .from(transportation)
      .where(
        and(
          or(
            eq(transportation.purchasePriceId, priceId),
            eq(transportation.salePriceId, priceId),
          ),
          isNull(transportation.deletedAt),
          eq(transportation.isDraft, false),
        ),
      );

    for (const deal of transportationDeals) {
      const supplier = deal.supplierId
        ? await db.query.suppliers.findFirst({ where: eq(suppliers.id, deal.supplierId) })
        : null;
      const buyer = deal.buyerId
        ? await db.query.customers.findFirst({ where: eq(customers.id, deal.buyerId) })
        : null;
      const isPurchase = deal.purchasePriceId === priceId;
      results.push({
        dealType: PRICE_RECALC_DEAL_TYPE.TRANSPORTATION,
        dealId: deal.id,
        dealNumber: `Перевозка от ${deal.dealDate ? deal.dealDate.slice(0, 10) : "—"}`,
        dealDate: deal.dealDate ? deal.dealDate.slice(0, 10) : "",
        counterpartyName: isPurchase
          ? supplier?.name || "Не указан"
          : buyer?.name || "Не указан",
        quantityKg: deal.quantityKg,
        role: isPurchase ? "purchase" : "sale",
      });
    }

    return results;
  }

  /**
   * Called when user confirms the price change warning.
   * Saves old price values, updates new values, sets needsRecalculation flag,
   * and creates pending recalculation tasks.
   */
  static async confirmPriceChange(
    priceId: string,
    newPriceValues: string[],
    selectedDealIds: { dealType: string; dealId: string }[],
    updatedById: string,
    otherUpdateData: Record<string, any> = {},
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Get current price values to save as old
      const [currentPrice] = await tx
        .select({ priceValues: prices.priceValues })
        .from(prices)
        .where(eq(prices.id, priceId));

      // Update price with new values, set needsRecalculation = true, store old values
      await tx
        .update(prices)
        .set({
          ...otherUpdateData,
          priceValues: newPriceValues,
          needsRecalculation: true,
          oldPriceValues: currentPrice?.priceValues || [],
          updatedById,
          updatedAt: sql`NOW()`,
        })
        .where(eq(prices.id, priceId));

      // Delete any existing pending tasks for this price (clean slate)
      await tx
        .delete(priceRecalculationTasks)
        .where(
          and(
            eq(priceRecalculationTasks.priceId, priceId),
            inArray(priceRecalculationTasks.status, [
              PRICE_RECALC_STATUS.PENDING,
              PRICE_RECALC_STATUS.SKIPPED,
            ]),
          ),
        );

      // Create new tasks for selected deals
      if (selectedDealIds.length > 0) {
        await tx.insert(priceRecalculationTasks).values(
          selectedDealIds.map((d) => ({
            priceId,
            dealType: d.dealType,
            dealId: d.dealId,
            status: PRICE_RECALC_STATUS.PENDING,
          })),
        );
      }
    });
  }

  /**
   * Reject price change — reverts price to old values and clears recalculation state.
   */
  static async rejectPriceChange(priceId: string): Promise<void> {
    await db.transaction(async (tx) => {
      const [currentPrice] = await tx
        .select({ oldPriceValues: prices.oldPriceValues })
        .from(prices)
        .where(eq(prices.id, priceId));

      if (!currentPrice?.oldPriceValues) {
        throw new Error("Нет сохранённых старых значений цены для отката");
      }

      await tx
        .update(prices)
        .set({
          priceValues: currentPrice.oldPriceValues,
          oldPriceValues: null,
          needsRecalculation: false,
          updatedAt: sql`NOW()`,
        })
        .where(eq(prices.id, priceId));

      // Delete all tasks for this price
      await tx
        .delete(priceRecalculationTasks)
        .where(eq(priceRecalculationTasks.priceId, priceId));
    });
  }

  /**
   * Admin confirms which tasks to run — sets selected to pending, others to skipped.
   */
  static async executeRecalculation(
    priceId: string,
    selectedTaskIds: string[],
  ): Promise<void> {
    // Mark unselected pending tasks as skipped
    const allTasks = await db
      .select({ id: priceRecalculationTasks.id })
      .from(priceRecalculationTasks)
      .where(
        and(
          eq(priceRecalculationTasks.priceId, priceId),
          inArray(priceRecalculationTasks.status, [
            PRICE_RECALC_STATUS.PENDING,
            PRICE_RECALC_STATUS.SKIPPED,
          ]),
        ),
      );

    const allTaskIds = allTasks.map((t) => t.id);
    const toSkip = allTaskIds.filter((id) => !selectedTaskIds.includes(id));

    if (toSkip.length > 0) {
      await db
        .update(priceRecalculationTasks)
        .set({ status: PRICE_RECALC_STATUS.SKIPPED })
        .where(inArray(priceRecalculationTasks.id, toSkip));
    }

    if (selectedTaskIds.length > 0) {
      await db
        .update(priceRecalculationTasks)
        .set({ status: PRICE_RECALC_STATUS.PENDING })
        .where(inArray(priceRecalculationTasks.id, selectedTaskIds));
    }
  }

  static async getTasksForPrice(priceId: string) {
    return db
      .select()
      .from(priceRecalculationTasks)
      .where(eq(priceRecalculationTasks.priceId, priceId));
  }

  static async checkIfAllDone(priceId: string): Promise<boolean> {
    const pending = await db
      .select({ id: priceRecalculationTasks.id })
      .from(priceRecalculationTasks)
      .where(
        and(
          eq(priceRecalculationTasks.priceId, priceId),
          inArray(priceRecalculationTasks.status, [
            PRICE_RECALC_STATUS.PENDING,
            PRICE_RECALC_STATUS.PROCESSING,
          ]),
        ),
      );
    return pending.length === 0;
  }

  static async markPriceRecalculationComplete(priceId: string): Promise<void> {
    await db
      .update(prices)
      .set({
        needsRecalculation: false,
        oldPriceValues: null,
        updatedAt: sql`NOW()`,
      })
      .where(eq(prices.id, priceId));
  }
}
