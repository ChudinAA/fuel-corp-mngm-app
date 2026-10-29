import { eq, desc, asc, sql, or, isNull, and } from "drizzle-orm";
import { db } from "server/db";
import {
  opt,
  movement,
  warehouses,
  warehouseTransactions,
  suppliers,
  customers,
  logisticsCarriers,
  logisticsDeliveryLocations,
  type Opt,
  type InsertOpt,
} from "@shared/schema";
import { IOptStorage } from "./types";
import { PRODUCT_TYPE, SOURCE_TYPE, TRANSACTION_TYPE } from "@shared/constants";
import { WarehouseTransactionService } from "server/modules/warehouses/services/warehouse-transaction-service";

function numericOrNull(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${label} должна быть числом`);
  }
  return numeric;
}

function normalizeOptTonneFields<T extends object>(data: T): T {
  const input = data as Record<string, unknown>;
  const normalized = { ...input };

  if (Object.prototype.hasOwnProperty.call(input, "quantityTonnes")) {
    const tonnes = numericOrNull(input.quantityTonnes, "Масса в тоннах");
    normalized.quantityTonnes =
      tonnes == null ? null : Number(tonnes.toFixed(5));
  }

  for (const field of [
    "purchasePricePerTonne",
    "salePricePerTonne",
    "deliveryTariffPerTonne",
  ]) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      normalized[field] = numericOrNull(input[field], field);
    }
  }

  return normalized as T;
}

export class OptStorage {
  async getOpt(id: string): Promise<Opt | undefined> {
    return db.query.opt.findFirst({
      where: and(eq(opt.id, id), isNull(opt.deletedAt)),
    });
  }

  async getOptDeals(
    offset: number = 0,
    pageSize: number = 100,
    search?: string,
    filters?: Record<string, string[]>,
  ): Promise<{ data: any[]; total: number }> {
    // Helper to build filter conditions
    const buildFilterConditions = () => {
      const conditions: any[] = [isNull(opt.deletedAt)];

      if (filters) {
        if (filters.supplier?.length) {
          conditions.push(sql`${suppliers.name} IN ${filters.supplier}`);
        }
        if (filters.buyer?.length) {
          conditions.push(sql`${customers.name} IN ${filters.buyer}`);
        }
        if (filters.productType?.length) {
          conditions.push(sql`${opt.productType} IN ${filters.productType}`);
        }
        if (filters.deliveryLocation?.length) {
          conditions.push(
            sql`${logisticsDeliveryLocations.name} IN ${filters.deliveryLocation}`,
          );
        }
        if (filters.carrier?.length) {
          conditions.push(sql`${logisticsCarriers.name} IN ${filters.carrier}`);
        }
        if (filters.dateFrom?.length && filters.dateTo?.length) {
          conditions.push(
            sql`${opt.dealDate}::date >= ${filters.dateFrom[0]}::date`,
            sql`${opt.dealDate}::date <= ${filters.dateTo[0]}::date`,
          );
        } else if (filters.date?.length) {
          conditions.push(
            sql`TO_CHAR(${opt.dealDate}, 'DD.MM.YYYY') IN ${filters.date}`,
          );
        }
      }

      if (search && search.trim()) {
        const searchPattern = `%${search.trim()}%`;
        conditions.push(
          or(
            sql`${suppliers.name} ILIKE ${searchPattern}`,
            sql`${customers.name} ILIKE ${searchPattern}`,
            sql`${opt.basis}::text ILIKE ${searchPattern}`,
            sql`${opt.notes}::text ILIKE ${searchPattern}`,
            sql`${logisticsCarriers.name}::text ILIKE ${searchPattern}`,
            sql`${logisticsDeliveryLocations.name}::text ILIKE ${searchPattern}`,
          ),
        );
      }

      return and(...conditions);
    };

    const filterCondition = buildFilterConditions();

    const rawData = await db
      .select({
        opt: opt,
        supplierName: suppliers.name,
        supplierIsWarehouse: suppliers.isWarehouse,
        buyerName: customers.name,
        carrierName: sql<string>`${logisticsCarriers.name}`,
        deliveryLocationName: sql<string>`${logisticsDeliveryLocations.name}`,
        warehouseName: sql<string>`${warehouses.name}`,
      })
      .from(opt)
      .leftJoin(suppliers, eq(opt.supplierId, suppliers.id))
      .leftJoin(customers, eq(opt.buyerId, customers.id))
      .leftJoin(logisticsCarriers, eq(opt.carrierId, logisticsCarriers.id))
      .leftJoin(
        logisticsDeliveryLocations,
        eq(opt.deliveryLocationId, logisticsDeliveryLocations.id),
      )
      .leftJoin(warehouses, eq(opt.warehouseId, warehouses.id))
      .where(filterCondition)
      .orderBy(desc(opt.dealDate), asc(customers.name), asc(suppliers.name))
      .limit(pageSize)
      .offset(offset);

    const data = rawData.map((row) => ({
      ...row.opt,
      supplier: {
        id: row.opt.supplierId,
        name: row.supplierName || "Не указан",
        isWarehouse: row.supplierIsWarehouse || false,
      },
      buyer: {
        id: row.opt.buyerId,
        name: row.buyerName || "Не указан",
      },
      carrier: row.opt.carrierId
        ? {
            id: row.opt.carrierId,
            name: row.carrierName || "Не указан",
          }
        : null,
      deliveryLocation: row.opt.deliveryLocationId
        ? {
            id: row.opt.deliveryLocationId,
            name: row.deliveryLocationName || "Не указано",
          }
        : null,
      warehouse: row.opt.warehouseId
        ? {
            id: row.opt.warehouseId,
            name: row.warehouseName || "Не указан",
          }
        : null,
      isApproxVolume: row.opt.isApproxVolume || false,
    }));

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(opt)
      .leftJoin(suppliers, eq(opt.supplierId, suppliers.id))
      .leftJoin(customers, eq(opt.buyerId, customers.id))
      .leftJoin(logisticsCarriers, eq(opt.carrierId, logisticsCarriers.id))
      .leftJoin(
        logisticsDeliveryLocations,
        eq(opt.deliveryLocationId, logisticsDeliveryLocations.id),
      )
      .where(filterCondition);

    return { data, total: Number(countResult?.count || 0) };
  }

  async createOpt(data: InsertOpt): Promise<Opt> {
    const normalizedData = normalizeOptTonneFields(data);
    if (
      !normalizedData.supplierId ||
      !normalizedData.buyerId ||
      !normalizedData.dealDate ||
      normalizedData.quantityTonnes == null
    ) {
      throw new Error("Supplier, buyer, deal date, and quantity are required");
    }
    return await db.transaction(async (tx) => {
      const insertValues = Object.fromEntries(
        Object.entries({
          ...normalizedData,
          supplierId: normalizedData.supplierId!,
          buyerId: normalizedData.buyerId!,
          dealDate: normalizedData.dealDate!,
          quantityTonnes: String(normalizedData.quantityTonnes),
        }).map(([key, value]) => [
          key,
          typeof value === "number" ? String(value) : value,
        ]),
      );
      const [created] = await tx
        .insert(opt)
        .values(insertValues as unknown as typeof opt.$inferInsert)
        .returning();

      // Обновляем остаток на складе только если это склад-поставщик и НЕ черновик
      if (
        !created.isDraft &&
        created.warehouseId &&
        created.quantityTonnes &&
        (created.productType === PRODUCT_TYPE.KEROSENE ||
          created.productType === PRODUCT_TYPE.PVKJ)
      ) {
        const { transaction } =
          await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
            tx,
            created.warehouseId,
            TRANSACTION_TYPE.SALE,
            created.productType || PRODUCT_TYPE.KEROSENE,
            SOURCE_TYPE.OPT,
            created.id,
            Number(created.quantityTonnes),
            parseFloat(created.purchaseAmount || "0"),
            normalizedData.createdById ?? undefined,
            created.dealDate,
          );

        // Сохраняем ID транзакции в сделке
        await tx
          .update(opt)
          .set({ transactionId: transaction.id })
          .where(eq(opt.id, created.id));
      }

      return created;
    });
  }

  async updateOpt(
    id: string,
    data: Partial<InsertOpt>,
  ): Promise<Opt | undefined> {
    return await db.transaction(async (tx) => {
      // Получаем текущую сделку с relations
      const currentOpt = await tx.query.opt.findFirst({
        where: eq(opt.id, id),
      });

      if (!currentOpt) {
        throw new Error("Deal not found");
      }
      const normalizedData = normalizeOptTonneFields(data);
      let createdTransactionId: string | undefined;

      // Логика перехода из черновика в готовую сделку
      const transitioningFromDraft =
        currentOpt.isDraft && normalizedData.isDraft === false;

      // Если сделка становится не черновиком, создаем транзакцию
      if (
        transitioningFromDraft &&
        normalizedData.warehouseId &&
        normalizedData.quantityTonnes &&
        (normalizedData.productType === PRODUCT_TYPE.KEROSENE ||
          normalizedData.productType === PRODUCT_TYPE.PVKJ)
      ) {
        const { transaction } =
          await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
            tx,
            normalizedData.warehouseId,
            TRANSACTION_TYPE.SALE,
            normalizedData.productType || PRODUCT_TYPE.KEROSENE,
            SOURCE_TYPE.OPT,
            currentOpt.id,
            Number(normalizedData.quantityTonnes),
            normalizedData.purchaseAmount || 0,
            normalizedData.updatedById ?? undefined,
            normalizedData.dealDate ?? undefined,
          );

        createdTransactionId = transaction.id;
      }
      // Проверяем изменилось ли количество КГ и/или дата сделки, и есть ли привязанная транзакция (для НЕ черновиков)
      else if (
        !currentOpt.isDraft &&
        currentOpt.transactionId &&
        currentOpt.warehouseId &&
        (currentOpt.productType === PRODUCT_TYPE.KEROSENE ||
          currentOpt.productType === PRODUCT_TYPE.PVKJ)
      ) {
        if (
          data.productType !== undefined &&
          data.productType !== currentOpt.productType
        ) {
          throw new Error(
            "Нельзя поменять тип продукта для существующей сделки",
          );
        }

        if (
          data.warehouseId !== undefined &&
          data.warehouseId !== currentOpt.warehouseId
        ) {
          throw new Error(
            "Нельзя поменять склад-источник для существующей сделки",
          );
        }

        if (currentOpt.quantityTonnes == null) {
          throw new Error(
            `OPT deal ${currentOpt.id} has no authoritative tonne quantity`,
          );
        }
        const oldQuantityTonnes = Number(currentOpt.quantityTonnes);
        const newQuantityTonnes =
          normalizedData.quantityTonnes == null
            ? oldQuantityTonnes
            : Number(normalizedData.quantityTonnes);
        const oldTotalCost = parseFloat(currentOpt.purchaseAmount || "0");
        const newTotalCost =
          normalizedData.purchaseAmount ?? oldTotalCost;

        const quantityChanged = oldQuantityTonnes !== newQuantityTonnes;
        const dateChanged =
          normalizedData.dealDate !== undefined &&
          normalizedData.dealDate !== currentOpt.dealDate;

        if (quantityChanged) {
          // Количество изменилось — обновляем транзакцию (метод также применит новую дату)
          await WarehouseTransactionService.updateTransactionAndRecalculateWarehouse(
            tx,
            currentOpt.transactionId,
            currentOpt.warehouseId,
            oldQuantityTonnes,
            oldTotalCost,
            newQuantityTonnes,
            newTotalCost,
            currentOpt.productType || PRODUCT_TYPE.KEROSENE,
            normalizedData.updatedById ?? undefined,
            normalizedData.dealDate ?? undefined,
          );
        } else if (dateChanged) {
          // Только дата изменилась — обновляем дату транзакции и запускаем пересчёт
          await WarehouseTransactionService.updateTransactionDateAndRecalculate(
            tx,
            currentOpt.transactionId,
            currentOpt.warehouseId,
            currentOpt.productType || PRODUCT_TYPE.KEROSENE,
            currentOpt.dealDate!,
            normalizedData.dealDate!,
            normalizedData.updatedById ?? undefined,
          );
        }
      }

      // Обновляем сделку
      const [updated] = await tx
        .update(opt)
        .set({
          ...normalizedData,
          transactionId: createdTransactionId,
          updatedAt: sql`NOW()`,
          updatedById: normalizedData.updatedById ?? undefined,
        } as unknown as Partial<typeof opt.$inferInsert>)
        .where(eq(opt.id, id))
        .returning();

      return updated;
    });
  }

  async deleteOpt(id: string, userId?: string): Promise<boolean> {
    await db.transaction(async (tx) => {
      const currentOpt = await tx.query.opt.findFirst({
        where: eq(opt.id, id),
      });

      if (
        currentOpt &&
        currentOpt.transactionId &&
        (currentOpt.productType === PRODUCT_TYPE.KEROSENE ||
         currentOpt.productType === PRODUCT_TYPE.PVKJ)
      ) {
        await WarehouseTransactionService.deleteTransactionAndRevertWarehouse(
          tx,
          currentOpt.transactionId,
          userId,
        );
      }

      await tx
        .update(opt)
        .set({
          deletedAt: sql`NOW()`,
          deletedById: userId,
        })
        .where(eq(opt.id, id));
    });

    return true;
  }

  async getUsedVolumeByPrice(
    priceId: string,
  ): Promise<{ usedVolumeTonnes: number }> {
    const [optVolume] = await db
      .select({
        totalMassTonnes: sql<string>`COALESCE(SUM(${opt.quantityTonnes}), 0)`,
      })
      .from(opt)
      .where(
        and(
          or(eq(opt.salePriceId, priceId), eq(opt.purchasePriceId, priceId)),
          isNull(opt.deletedAt),
          eq(opt.isDraft, false),
        ),
      );

    const [movementVolume] = await db
      .select({
        totalMassTonnes: sql<string>`COALESCE(SUM(${movement.quantityTonnes}), 0)`,
      })
      .from(movement)
      .where(
        and(eq(movement.purchasePriceId, priceId), isNull(movement.deletedAt)),
      );

    const usedVolumeTonnes =
      Number.parseFloat(optVolume.totalMassTonnes || "0") +
      Number.parseFloat(movementVolume.totalMassTonnes || "0");
    return { usedVolumeTonnes };
  }

  async getUsedAmountByPrice(priceId: string): Promise<number> {
    const [saleResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${opt.saleAmount}), 0)`,
      })
      .from(opt)
      .where(
        and(
          eq(opt.salePriceId, priceId),
          isNull(opt.deletedAt),
          eq(opt.isDraft, false),
        ),
      );

    const [purchaseResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${opt.purchaseAmount}), 0)`,
      })
      .from(opt)
      .where(
        and(
          eq(opt.purchasePriceId, priceId),
          isNull(opt.deletedAt),
          eq(opt.isDraft, false),
        ),
      );

    const saleTotal = parseFloat(saleResult?.total || "0");
    const purchaseTotal = parseFloat(purchaseResult?.total || "0");
    return Math.max(saleTotal, purchaseTotal);
  }

  async checkDuplicate(data: {
    dealDate: string;
    supplierId: string;
    buyerId: string;
    productType: string;
    basisId?: string | null;
    customerBasisId?: string | null;
    deliveryLocationId?: string | null;
    quantityTonnes?: number;
  }): Promise<boolean> {
    const quantityTonnes = data.quantityTonnes ?? null;
    if (quantityTonnes === null) {
      throw new Error("Масса сделки обязательна для проверки дубликата");
    }
    const existing = await db.query.opt.findFirst({
      where: and(
        sql`DATE(${opt.dealDate}) = DATE(${data.dealDate})`,
        eq(opt.supplierId, data.supplierId),
        eq(opt.buyerId, data.buyerId),
        eq(opt.productType, data.productType),
        data.basisId ? eq(opt.basisId, data.basisId) : isNull(opt.basisId),
        data.customerBasisId
          ? eq(opt.customerBasisId, data.customerBasisId)
          : isNull(opt.customerBasisId),
        data.deliveryLocationId
          ? eq(opt.deliveryLocationId, data.deliveryLocationId)
          : isNull(opt.deliveryLocationId),
        eq(opt.quantityTonnes, Number(quantityTonnes.toFixed(5)).toString()),
        isNull(opt.deletedAt),
        eq(opt.isDraft, false),
      ),
    });
    return !!existing;
  }

  async restoreOpt(
    id: string,
    oldData: any,
    userId?: string,
    transaction?: any,
  ): Promise<boolean> {
    const restore = async (tx: any) => {
      // Restore the opt record
      await tx
        .update(opt)
        .set({
          deletedAt: null,
          deletedById: null,
        })
        .where(eq(opt.id, id));

      // Restore associated transaction if exists
      if (oldData.transactionId) {
        await WarehouseTransactionService.restoreTransactionAndRecalculateWarehouse(
          tx,
          oldData.transactionId,
          userId,
        );
      }
    };
    if (transaction) await restore(transaction);
    else await db.transaction(restore);

    return true;
  }

  async getAllOpts(): Promise<any[]> {
    const data = await db.query.opt.findMany({
      where: isNull(opt.deletedAt),
      orderBy: (opt, { desc }) => [desc(opt.dealDate)],
      with: {
        supplier: {
          columns: {
            id: true,
            name: true,
            isWarehouse: true,
          },
        },
        buyer: {
          columns: {
            id: true,
            name: true,
          },
        },
        carrier: {
          columns: {
            id: true,
            name: true,
          },
        },
        deliveryLocation: {
          columns: {
            id: true,
            name: true,
          },
        },
        warehouse: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    return data.map((item) => ({
      ...item,
      supplier: item.supplier || {
        id: item.supplierId,
        name: "Не указан",
        isWarehouse: false,
      },
      buyer: item.buyer || { id: item.buyerId, name: "Не указан" },
      isApproxVolume: item.isApproxVolume || false,
    }));
  }
}
