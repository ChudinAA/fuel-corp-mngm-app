import { eq, desc, isNull, and, or, sql, ilike } from "drizzle-orm";
import { db } from "server/db";
import {
  exchangeDeals,
  type ExchangeDeal,
  type InsertExchangeDeal,
} from "../entities/exchange-deals";
import { suppliers } from "../../suppliers/entities/suppliers";
import { customers } from "../../customers/entities/customers";
import { railwayStations, railwayTariffs } from "../../railway/entities/railway";
import { movement, warehouseTransactions } from "@shared/schema";
import {
  exchangeAdvanceCards,
  exchangeAdvanceTransactions,
} from "../../exchange-advances/entities/exchange-advances";
import { MOVEMENT_TYPE, TRANSACTION_TYPE, SOURCE_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { WarehouseTransactionService } from "../../warehouses/services/warehouse-transaction-service";

// ——— Утилиты для работы с датами без смещения часового пояса ———

/**
 * Получить movementDate для перемещения:
 * приоритет — plannedDeliveryDate, затем dealDate, иначе — текущая дата (локальная).
 */
function getMovementDate(deal: ExchangeDeal): string {
  const raw = deal.plannedDeliveryDate || deal.dealDate;
  if (raw) return raw as string; // date-строка "YYYY-MM-DD", Postgres сам преобразует в timestamp
  // Текущая дата в локальном формате без toISOString()
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Безопасный null для UUID-полей: пустую строку заменяем null.
 */
function safeUuid(val: any): string | null {
  if (!val || typeof val !== "string" || val.trim() === "") return null;
  return val;
}

export class ExchangeDealsStorage {
  async getDeal(id: string): Promise<any | undefined> {
    const result = await db
      .select({
        deal: exchangeDeals,
        sellerName: suppliers.name,
        buyerName: customers.name,
        departureName: sql<string>`ds.name`,
        departureCode: sql<string>`ds.code`,
        destinationName: sql<string>`dest.name`,
        destinationCode: sql<string>`dest.code`,
        tariffZoneName: railwayTariffs.zoneName,
        tariffPricePerTon: railwayTariffs.pricePerTon,
        buyerSupplierName: sql<string>`bs.name`,
      })
      .from(exchangeDeals)
      .leftJoin(suppliers, eq(exchangeDeals.sellerId, suppliers.id))
      .leftJoin(customers, eq(exchangeDeals.buyerId, customers.id))
      .leftJoin(sql`railway_stations ds`, sql`ds.id = ${exchangeDeals.departureStationId}`)
      .leftJoin(sql`railway_stations dest`, sql`dest.id = ${exchangeDeals.destinationStationId}`)
      .leftJoin(railwayTariffs, eq(exchangeDeals.deliveryTariffId, railwayTariffs.id))
      .leftJoin(sql`suppliers bs`, sql`bs.id = ${exchangeDeals.buyerSupplierId}`)
      .where(and(eq(exchangeDeals.id, id), isNull(exchangeDeals.deletedAt)))
      .limit(1);

    if (!result.length) return undefined;
    const row = result[0];
    return {
      ...row.deal,
      sellerName: row.sellerName,
      buyerName: row.buyerName,
      departureName: row.departureName,
      departureCode: row.departureCode,
      destinationName: row.destinationName,
      destinationCode: row.destinationCode,
      tariffZoneName: row.tariffZoneName,
      tariffPricePerTon: row.tariffPricePerTon,
      buyerSupplierName: row.buyerSupplierName,
    };
  }

  async getDeals(
    offset: number = 0,
    pageSize: number = 20,
    search?: string,
    filters?: Record<string, string[]>,
  ): Promise<{ data: any[]; total: number }> {
    const buildConditions = () => {
      const conditions: any[] = [isNull(exchangeDeals.deletedAt)];

      if (filters) {
        if (filters.seller?.length) {
          conditions.push(sql`${suppliers.name} IN ${filters.seller}`);
        }
        if (filters.buyer?.length) {
          conditions.push(sql`${customers.name} IN ${filters.buyer}`);
        }
        if (filters.date?.length) {
          conditions.push(
            sql`TO_CHAR(${exchangeDeals.dealDate}, 'DD.MM.YYYY') IN ${filters.date}`,
          );
        }
        if (filters.dealNumber?.length) {
          conditions.push(sql`${exchangeDeals.dealNumber} IN ${filters.dealNumber}`);
        }
      }

      if (search && search.trim()) {
        const pattern = `%${search.trim()}%`;
        conditions.push(
          or(
            ilike(suppliers.name, pattern),
            ilike(customers.name, pattern),
            sql`${exchangeDeals.dealNumber} ILIKE ${pattern}`,
            sql`${exchangeDeals.wagonNumbers} ILIKE ${pattern}`,
          ),
        );
      }

      return and(...conditions);
    };

    const whereClause = buildConditions();

    const rawData = await db
      .select({
        deal: exchangeDeals,
        sellerName: suppliers.name,
        buyerName: customers.name,
        departureName: sql<string>`ds.name`,
        departureCode: sql<string>`ds.code`,
        destinationName: sql<string>`dest.name`,
        destinationCode: sql<string>`dest.code`,
        tariffZoneName: railwayTariffs.zoneName,
        tariffPricePerTon: railwayTariffs.pricePerTon,
        buyerSupplierName: sql<string>`bs.name`,
      })
      .from(exchangeDeals)
      .leftJoin(suppliers, eq(exchangeDeals.sellerId, suppliers.id))
      .leftJoin(customers, eq(exchangeDeals.buyerId, customers.id))
      .leftJoin(sql`railway_stations ds`, sql`ds.id = ${exchangeDeals.departureStationId}`)
      .leftJoin(sql`railway_stations dest`, sql`dest.id = ${exchangeDeals.destinationStationId}`)
      .leftJoin(railwayTariffs, eq(exchangeDeals.deliveryTariffId, railwayTariffs.id))
      .leftJoin(sql`suppliers bs`, sql`bs.id = ${exchangeDeals.buyerSupplierId}`)
      .where(whereClause)
      .orderBy(desc(exchangeDeals.createdAt))
      .limit(pageSize)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(exchangeDeals)
      .leftJoin(suppliers, eq(exchangeDeals.sellerId, suppliers.id))
      .leftJoin(customers, eq(exchangeDeals.buyerId, customers.id))
      .where(whereClause);

    const total = Number(totalResult[0]?.count ?? 0);

    const data = rawData.map((row) => ({
      ...row.deal,
      sellerName: row.sellerName,
      buyerName: row.buyerName,
      departureName: row.departureName,
      departureCode: row.departureCode,
      destinationName: row.destinationName,
      destinationCode: row.destinationCode,
      tariffZoneName: row.tariffZoneName,
      tariffPricePerTon: row.tariffPricePerTon,
      buyerSupplierName: row.buyerSupplierName,
    }));

    return { data, total };
  }

  async createDeal(data: InsertExchangeDeal): Promise<ExchangeDeal> {
    const [deal] = await db.insert(exchangeDeals).values(data).returning();

    if (deal.isReceivedAtWarehouse && deal.buyerSupplierId && !deal.movementId) {
      await this._createMovementForDeal(deal);
    }

    if (!deal.isDraft && deal.sellerId) {
      await this._createAdvanceExpense(deal);
    }

    return deal;
  }

  async updateDeal(id: string, data: Partial<InsertExchangeDeal>, updatedById?: string): Promise<ExchangeDeal | undefined> {
    const existing = await db.query.exchangeDeals.findFirst({
      where: and(eq(exchangeDeals.id, id), isNull(exchangeDeals.deletedAt)),
    });
    if (!existing) return undefined;

    const [deal] = await db
      .update(exchangeDeals)
      .set({ ...data, updatedAt: sql`NOW()`, updatedById })
      .where(and(eq(exchangeDeals.id, id), isNull(exchangeDeals.deletedAt)))
      .returning();

    // ——— Перемещение ———
    const wasReceived = existing.isReceivedAtWarehouse;
    const nowReceived = deal.isReceivedAtWarehouse;

    if (nowReceived && !wasReceived && deal.buyerSupplierId && !deal.movementId) {
      // Только что подтвердили получение — создать перемещение
      await this._createMovementForDeal(deal);
    } else if (nowReceived && deal.movementId) {
      // Перемещение уже есть — проверить, изменились ли данные
      const fieldsChanged =
        existing.weightTon !== deal.weightTon ||
        existing.actualWeightTon !== deal.actualWeightTon ||
        existing.pricePerTon !== deal.pricePerTon ||
        existing.dealDate !== deal.dealDate ||
        existing.plannedDeliveryDate !== deal.plannedDeliveryDate ||
        existing.deliveryTariffId !== deal.deliveryTariffId ||
        existing.sellerId !== deal.sellerId ||
        existing.notes !== deal.notes;

      if (fieldsChanged) {
        await this._updateMovementForDeal(deal, existing, updatedById);
      }
    }

    // ——— Авансы продавца ———
    const wasNotDraft = !existing.isDraft && !!existing.sellerId;
    const isNotDraft = !deal.isDraft && !!deal.sellerId;

    if (wasNotDraft) {
      await this._deleteAdvanceExpense(deal.id, updatedById);
    }
    if (isNotDraft) {
      await this._createAdvanceExpense(deal, updatedById);
    }

    return deal;
  }

  // ——— Вычисление значений для перемещения ———
  private async _computeMovementValues(deal: ExchangeDeal): Promise<{
    weightTon: number;
    quantityKg: number;
    pricePerTon: number;
    purchaseAmount: number;
    deliveryCostTotal: number;
    totalAmount: number;
    purchasePricePerKg: number;
    movementDate: string;
  }> {
    // Приоритет: actualWeightTon → weightTon
    const weightTon = parseFloat(String(deal.actualWeightTon || deal.weightTon || "0")) || 0;
    const quantityKg = weightTon * 1000;
    const pricePerTon = parseFloat(String(deal.pricePerTon || "0")) || 0;
    const purchaseAmount = pricePerTon * weightTon;

    let deliveryCostTotal = 0;
    if (deal.deliveryTariffId) {
      const tariffResult = await db
        .select()
        .from(railwayTariffs)
        .where(eq(railwayTariffs.id, deal.deliveryTariffId))
        .limit(1);
      if (tariffResult.length > 0) {
        deliveryCostTotal = parseFloat(String(tariffResult[0].pricePerTon || "0")) * weightTon;
      }
    }

    const totalAmount = purchaseAmount + deliveryCostTotal;
    // Себестоимость = (закупка + доставка) / кг
    const purchasePricePerKg = quantityKg > 0 ? totalAmount / quantityKg : 0;
    const movementDate = getMovementDate(deal);

    return { weightTon, quantityKg, pricePerTon, purchaseAmount, deliveryCostTotal, totalAmount, purchasePricePerKg, movementDate };
  }

  // ——— Сумма закупки у продавца (без доставки) для аванса ———
  private _computePurchaseAmount(deal: ExchangeDeal): number {
    const weightTon = parseFloat(String(deal.actualWeightTon || deal.weightTon || "0")) || 0;
    const pricePerTon = parseFloat(String(deal.pricePerTon || "0")) || 0;
    return pricePerTon * weightTon;
  }

  // ——— Создать перемещение при подтверждении получения на складе ———
  private async _createMovementForDeal(deal: ExchangeDeal): Promise<void> {
    if (!deal.buyerSupplierId) return;

    const supplier = await db.query.suppliers.findFirst({
      where: eq(suppliers.id, deal.buyerSupplierId),
    });
    if (!supplier?.warehouseId) return;

    const { quantityKg, totalAmount, purchasePricePerKg, deliveryCostTotal, movementDate } =
      await this._computeMovementValues(deal);

    if (quantityKg <= 0) return;

    // deliveryCost в перемещении — в рублях за тонну (не за кг)
    const deliveryCostPerTon = deal.deliveryTariffId
      ? await this._getDeliveryTariffPerTon(deal.deliveryTariffId)
      : 0;

    await db.transaction(async (tx) => {
      const [createdMovement] = await tx
        .insert(movement)
        .values({
          movementDate,
          movementType: MOVEMENT_TYPE.SUPPLY,
          productType: PRODUCT_TYPE.KEROSENE,
          toWarehouseId: supplier.warehouseId!,
          supplierId: deal.sellerId || null,
          quantityKg: String(quantityKg),
          totalCost: String(totalAmount),
          purchasePrice: String(purchasePricePerKg),
          costPerKg: String(purchasePricePerKg),
          deliveryCost: String(deliveryCostPerTon),
          isDraft: false,
          fromExchange: true,
          exchangeId: deal.id,
          notes: deal.notes || null,
          createdById: deal.createdById || null,
        })
        .returning();

      const { transaction } = await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
        tx,
        supplier.warehouseId!,
        TRANSACTION_TYPE.RECEIPT,
        PRODUCT_TYPE.KEROSENE,
        SOURCE_TYPE.MOVEMENT,
        createdMovement.id,
        quantityKg,
        totalAmount,
        deal.createdById || undefined,
        movementDate,
      );

      await tx
        .update(movement)
        .set({ transactionId: transaction.id })
        .where(eq(movement.id, createdMovement.id));

      await tx
        .update(exchangeDeals)
        .set({ movementId: createdMovement.id })
        .where(eq(exchangeDeals.id, deal.id));
    });
  }

  private async _getDeliveryTariffPerTon(tariffId: string): Promise<number> {
    const [tariff] = await db
      .select()
      .from(railwayTariffs)
      .where(eq(railwayTariffs.id, tariffId))
      .limit(1);
    return tariff ? parseFloat(String(tariff.pricePerTon || "0")) : 0;
  }

  private async _updateMovementForDeal(
    deal: ExchangeDeal,
    existing: ExchangeDeal,
    updatedById?: string,
  ): Promise<void> {
    if (!deal.movementId || !deal.buyerSupplierId) return;

    const supplier = await db.query.suppliers.findFirst({
      where: eq(suppliers.id, deal.buyerSupplierId),
    });
    if (!supplier?.warehouseId) return;

    const oldValues = await this._computeMovementValues(existing);
    const newValues = await this._computeMovementValues(deal);

    if (newValues.quantityKg <= 0) return;

    const deliveryCostPerTon = deal.deliveryTariffId
      ? await this._getDeliveryTariffPerTon(deal.deliveryTariffId)
      : 0;

    await db.transaction(async (tx) => {
      const currentMovement = await tx.query.movement.findFirst({
        where: and(eq(movement.id, deal.movementId!), isNull(movement.deletedAt)),
      });
      if (!currentMovement) return;

      await tx
        .update(movement)
        .set({
          movementDate: newValues.movementDate,
          supplierId: deal.sellerId || null,
          quantityKg: String(newValues.quantityKg),
          totalCost: String(newValues.totalAmount),
          purchasePrice: String(newValues.purchasePricePerKg),
          costPerKg: String(newValues.purchasePricePerKg),
          deliveryCost: String(deliveryCostPerTon),
          notes: deal.notes || null,
          updatedAt: sql`NOW()`,
          updatedById: updatedById || null,
        })
        .where(eq(movement.id, deal.movementId!));

      if (currentMovement.transactionId) {
        await WarehouseTransactionService.updateTransactionAndRecalculateWarehouse(
          tx,
          currentMovement.transactionId,
          supplier.warehouseId!,
          oldValues.quantityKg,
          oldValues.totalAmount,
          newValues.quantityKg,
          newValues.totalAmount,
          PRODUCT_TYPE.KEROSENE,
          updatedById,
          newValues.movementDate,
        );
      } else {
        const { transaction } = await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
          tx,
          supplier.warehouseId!,
          TRANSACTION_TYPE.RECEIPT,
          PRODUCT_TYPE.KEROSENE,
          SOURCE_TYPE.MOVEMENT,
          deal.movementId!,
          newValues.quantityKg,
          newValues.totalAmount,
          updatedById,
          newValues.movementDate,
        );
        await tx
          .update(movement)
          .set({ transactionId: transaction.id })
          .where(eq(movement.id, deal.movementId!));
      }
    });
  }

  // ——— Авансы продавца ———

  private async _createAdvanceExpense(deal: ExchangeDeal, createdById?: string): Promise<void> {
    if (!deal.sellerId) return;

    const purchaseAmount = this._computePurchaseAmount(deal);
    if (purchaseAmount <= 0) return;

    const card = await db.query.exchangeAdvanceCards.findFirst({
      where: and(
        eq(exchangeAdvanceCards.sellerId, deal.sellerId),
        isNull(exchangeAdvanceCards.deletedAt),
      ),
    });
    if (!card) return;

    const currentBalance = parseFloat(card.currentBalance ?? "0");
    const newBalance = currentBalance - purchaseAmount;

    await db.insert(exchangeAdvanceTransactions).values({
      cardId: card.id,
      transactionType: "expense",
      amount: String(purchaseAmount),
      balanceBefore: String(currentBalance),
      balanceAfter: String(newBalance),
      relatedDealId: deal.id,
      description: `Закупка по сделке ${deal.dealNumber || deal.id}`,
      transactionDate: deal.dealDate || null,
      createdById: (createdById || deal.createdById) ?? null,
    });

    await db
      .update(exchangeAdvanceCards)
      .set({ currentBalance: String(newBalance), updatedAt: sql`NOW()` })
      .where(eq(exchangeAdvanceCards.id, card.id));
  }

  private async _deleteAdvanceExpense(dealId: string, deletedById?: string): Promise<void> {
    const txn = await db.query.exchangeAdvanceTransactions.findFirst({
      where: and(
        eq(exchangeAdvanceTransactions.relatedDealId, dealId),
        eq(exchangeAdvanceTransactions.transactionType, "expense"),
        isNull(exchangeAdvanceTransactions.deletedAt),
      ),
    });
    if (!txn) return;

    await db
      .update(exchangeAdvanceCards)
      .set({ currentBalance: txn.balanceBefore, updatedAt: sql`NOW()` })
      .where(eq(exchangeAdvanceCards.id, txn.cardId));

    await db
      .update(exchangeAdvanceTransactions)
      .set({ deletedAt: sql`NOW()`, deletedById: deletedById ?? null })
      .where(eq(exchangeAdvanceTransactions.id, txn.id));
  }

  // ——— CRUD ———

  async deleteDeal(id: string, deletedById?: string): Promise<boolean> {
    const existing = await db.query.exchangeDeals.findFirst({
      where: and(eq(exchangeDeals.id, id), isNull(exchangeDeals.deletedAt)),
    });

    await db.transaction(async (tx) => {
      if (existing?.movementId) {
        const relatedMovement = await tx.query.movement.findFirst({
          where: and(eq(movement.id, existing.movementId), isNull(movement.deletedAt)),
        });

        if (relatedMovement) {
          if (relatedMovement.transactionId) {
            await WarehouseTransactionService.deleteTransactionAndRevertWarehouse(
              tx,
              relatedMovement.transactionId,
              deletedById,
            );
          }

          await tx
            .update(movement)
            .set({ deletedAt: sql`NOW()`, deletedById: deletedById || null })
            .where(eq(movement.id, existing.movementId));
        }
      }

      await tx
        .update(exchangeDeals)
        .set({ deletedAt: sql`NOW()`, deletedById })
        .where(and(eq(exchangeDeals.id, id), isNull(exchangeDeals.deletedAt)));
    });

    if (!existing?.isDraft && existing?.sellerId) {
      await this._deleteAdvanceExpense(id, deletedById);
    }

    return true;
  }

  async restoreDeal(id: string, data: any): Promise<ExchangeDeal | undefined> {
    // Очищаем UUID-поля от пустых строк, чтобы не было "invalid input syntax for type uuid"
    const cleanData = {
      ...data,
      departureStationId: safeUuid(data.departureStationId),
      destinationStationId: safeUuid(data.destinationStationId),
      buyerId: safeUuid(data.buyerId),
      buyerSupplierId: safeUuid(data.buyerSupplierId),
      deliveryTariffId: safeUuid(data.deliveryTariffId),
      sellerId: safeUuid(data.sellerId),
      movementId: safeUuid(data.movementId),
      createdById: safeUuid(data.createdById),
      updatedById: safeUuid(data.updatedById),
      deletedById: null,
      deletedAt: null,
    };

    const [deal] = await db
      .insert(exchangeDeals)
      .values({ ...cleanData, id })
      .onConflictDoUpdate({
        target: exchangeDeals.id,
        set: { ...cleanData, updatedAt: sql`NOW()` },
      })
      .returning();

    if (deal.movementId) {
      await db.transaction(async (tx) => {
        const relatedMovement = await tx.query.movement.findFirst({
          where: eq(movement.id, deal.movementId!),
        });

        if (relatedMovement) {
          await tx
            .update(movement)
            .set({ deletedAt: null, deletedById: null })
            .where(eq(movement.id, deal.movementId!));

          if (relatedMovement.transactionId) {
            await WarehouseTransactionService.restoreTransactionAndRecalculateWarehouse(
              tx,
              relatedMovement.transactionId,
              cleanData.updatedById,
            );
          }
        }
      });
    }

    if (!deal.isDraft && deal.sellerId) {
      await this._createAdvanceExpense(deal, cleanData.updatedById);
    }

    return deal;
  }

  async copyDeal(id: string, createdById?: string): Promise<ExchangeDeal | undefined> {
    const original = await db.query.exchangeDeals.findFirst({
      where: and(eq(exchangeDeals.id, id), isNull(exchangeDeals.deletedAt)),
    });
    if (!original) return undefined;

    const { id: _id, createdAt, updatedAt, deletedAt, deletedById, movementId, ...rest } = original;
    const [copy] = await db
      .insert(exchangeDeals)
      .values({
        ...rest,
        dealNumber: rest.dealNumber ? `${rest.dealNumber} (копия)` : null,
        isDraft: true,
        isReceivedAtWarehouse: false,
        createdById,
      })
      .returning();
    return copy;
  }
}
