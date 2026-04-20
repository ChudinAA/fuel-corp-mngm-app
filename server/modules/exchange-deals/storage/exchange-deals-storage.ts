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
import { MOVEMENT_TYPE, TRANSACTION_TYPE, SOURCE_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { WarehouseTransactionService } from "../../warehouses/services/warehouse-transaction-service";

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

    return deal;
  }

  async updateDeal(id: string, data: Partial<InsertExchangeDeal>, updatedById?: string): Promise<ExchangeDeal | undefined> {
    const existing = await db.query.exchangeDeals.findFirst({
      where: and(eq(exchangeDeals.id, id), isNull(exchangeDeals.deletedAt)),
    });
    if (!existing) return undefined;

    const [deal] = await db
      .update(exchangeDeals)
      .set({ ...data, updatedAt: new Date().toISOString(), updatedById })
      .where(and(eq(exchangeDeals.id, id), isNull(exchangeDeals.deletedAt)))
      .returning();

    const wasReceived = existing.isReceivedAtWarehouse;
    const nowReceived = deal.isReceivedAtWarehouse;

    // Новое получение на складе — создать перемещение
    if (nowReceived && !wasReceived && deal.buyerSupplierId && !deal.movementId) {
      await this._createMovementForDeal(deal);
      return deal;
    }

    // Если уже есть перемещение и изменились финансовые/количественные данные — обновить
    if (nowReceived && deal.movementId) {
      const fieldsChanged =
        existing.weightTon !== deal.weightTon ||
        existing.actualWeightTon !== deal.actualWeightTon ||
        existing.pricePerTon !== deal.pricePerTon ||
        existing.dealDate !== deal.dealDate ||
        existing.deliveryTariffId !== deal.deliveryTariffId;

      if (fieldsChanged) {
        await this._updateMovementForDeal(deal, existing, updatedById);
      }
    }

    return deal;
  }

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
    const purchasePricePerKg = quantityKg > 0 ? totalAmount / quantityKg : 0;
    const movementDate = deal.dealDate
      ? new Date(deal.dealDate).toISOString()
      : new Date().toISOString();

    return { weightTon, quantityKg, pricePerTon, purchaseAmount, deliveryCostTotal, totalAmount, purchasePricePerKg, movementDate };
  }

  private async _createMovementForDeal(deal: ExchangeDeal): Promise<void> {
    if (!deal.buyerSupplierId) return;

    const supplier = await db.query.suppliers.findFirst({
      where: eq(suppliers.id, deal.buyerSupplierId),
    });
    if (!supplier?.warehouseId) return;

    const { quantityKg, totalAmount, purchasePricePerKg, movementDate } =
      await this._computeMovementValues(deal);

    if (quantityKg <= 0) return;

    await db.transaction(async (tx) => {
      const [createdMovement] = await tx
        .insert(movement)
        .values({
          movementDate,
          movementType: MOVEMENT_TYPE.SUPPLY,
          productType: PRODUCT_TYPE.KEROSENE,
          toWarehouseId: supplier.warehouseId!,
          quantityKg: String(quantityKg),
          totalCost: String(totalAmount),
          purchasePrice: String(purchasePricePerKg),
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

    await db.transaction(async (tx) => {
      const currentMovement = await tx.query.movement.findFirst({
        where: and(eq(movement.id, deal.movementId!), isNull(movement.deletedAt)),
      });
      if (!currentMovement) return;

      const movementDate = newValues.movementDate;

      await tx
        .update(movement)
        .set({
          movementDate,
          quantityKg: String(newValues.quantityKg),
          totalCost: String(newValues.totalAmount),
          purchasePrice: String(newValues.purchasePricePerKg),
          notes: deal.notes || null,
          updatedAt: new Date().toISOString(),
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
          movementDate,
        );
      } else {
        // Транзакции ещё нет — создаём
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
          movementDate,
        );
        await tx
          .update(movement)
          .set({ transactionId: transaction.id })
          .where(eq(movement.id, deal.movementId!));
      }
    });
  }

  async deleteDeal(id: string, deletedById?: string): Promise<boolean> {
    const existing = await db.query.exchangeDeals.findFirst({
      where: and(eq(exchangeDeals.id, id), isNull(exchangeDeals.deletedAt)),
    });

    await db.transaction(async (tx) => {
      // Если есть связанное перемещение — откатить его и транзакцию склада
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
            .set({
              deletedAt: sql`NOW()`,
              deletedById: deletedById || null,
            })
            .where(eq(movement.id, existing.movementId));
        }
      }

      await tx
        .update(exchangeDeals)
        .set({ deletedAt: new Date().toISOString(), deletedById })
        .where(and(eq(exchangeDeals.id, id), isNull(exchangeDeals.deletedAt)));
    });

    return true;
  }

  async restoreDeal(id: string, data: any): Promise<ExchangeDeal | undefined> {
    const [deal] = await db
      .insert(exchangeDeals)
      .values({ ...data, id, deletedAt: null })
      .onConflictDoUpdate({
        target: exchangeDeals.id,
        set: { ...data, deletedAt: null, updatedAt: new Date().toISOString() },
      })
      .returning();

    // Если есть связанное перемещение — восстановить его и транзакцию склада
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
              data.updatedById,
            );
          }
        }
      });
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
        createdAt: new Date().toISOString(),
      })
      .returning();
    return copy;
  }
}
