import { eq, desc, sql, or, isNull, and } from "drizzle-orm";
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

export class OptStorage {
  async getOpt(id: string): Promise<Opt | undefined> {
    return db.query.opt.findFirst({
      where: and(eq(opt.id, id), isNull(opt.deletedAt)),
    });
  }

  async getOptDeals(
    offset: number = 0,
    pageSize: number = 20,
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
        if (filters.deliveryLocation?.length) {
          conditions.push(
            sql`${logisticsDeliveryLocations.name} IN ${filters.deliveryLocation}`,
          );
        }
        if (filters.carrier?.length) {
          conditions.push(sql`${logisticsCarriers.name} IN ${filters.carrier}`);
        }
        if (filters.date?.length) {
          // Convert dates to string format for comparison
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
      .orderBy(desc(opt.dealDate))
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
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(opt).values(data).returning();

      // Обновляем остаток на складе только если это склад-поставщик и НЕ черновик
      if (!created.isDraft && created.warehouseId && created.quantityKg) {
        const { transaction } =
          await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
            tx,
            created.warehouseId,
            TRANSACTION_TYPE.SALE,
            PRODUCT_TYPE.KEROSENE,
            SOURCE_TYPE.OPT,
            created.id,
            parseFloat(created.quantityKg),
            parseFloat(created.purchaseAmount || "0"),
            data.createdById,
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

      if (!currentOpt) return undefined;

      // Логика перехода из черновика в готовую сделку
      const transitioningFromDraft =
        currentOpt.isDraft && data.isDraft === false;

      // Если сделка становится не черновиком, создаем транзакцию
      if (transitioningFromDraft && data.warehouseId && data.quantityKg) {
        const { transaction } =
          await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
            tx,
            data.warehouseId,
            TRANSACTION_TYPE.SALE,
            PRODUCT_TYPE.KEROSENE,
            SOURCE_TYPE.OPT,
            currentOpt.id,
            data.quantityKg,
            data.purchaseAmount || 0,
            data.updatedById,
            data.dealDate,
          );

        data.transactionId = transaction.id;
      }
      // Проверяем изменилось ли количество КГ и есть ли привязанная транзакция (для НЕ черновиков)
      else if (
        !currentOpt.isDraft &&
        data.quantityKg &&
        currentOpt.transactionId &&
        currentOpt.warehouseId
      ) {
        if (data.warehouseId !== currentOpt.warehouseId) {
          throw new Error(
            "Нельзя поменять склад-источник для существующей сделки",
          );
        }

        const oldQuantityKg = parseFloat(currentOpt.quantityKg);
        const newQuantityKg = data.quantityKg;
        const oldTotalCost = parseFloat(currentOpt.purchaseAmount || "0");
        const newTotalCost = data.purchaseAmount || 0;

        if (oldQuantityKg !== newQuantityKg) {
          await WarehouseTransactionService.updateTransactionAndRecalculateWarehouse(
            tx,
            currentOpt.transactionId,
            currentOpt.warehouseId,
            oldQuantityKg,
            oldTotalCost,
            newQuantityKg,
            newTotalCost,
            PRODUCT_TYPE.KEROSENE,
            data.updatedById,
            data.dealDate,
          );
        }
      }

      // Обновляем сделку
      const [updated] = await tx
        .update(opt)
        .set({
          ...data,
          updatedAt: sql`NOW()`,
          updatedById: data.updatedById,
        })
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

      if (currentOpt && currentOpt.transactionId) {
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

  async getUsedVolumeByPrice(priceId: string): Promise<number> {
    const [optVolume] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${opt.quantityKg}), 0)`,
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
        total: sql<string>`COALESCE(SUM(${movement.quantityKg}), 0)`,
      })
      .from(movement)
      .where(
        and(eq(movement.purchasePriceId, priceId), isNull(movement.deletedAt)),
      );

    const total =
      parseFloat(optVolume.total || "0") +
      parseFloat(movementVolume.total || "0");
    return total;
  }

  async checkDuplicate(data: {
    dealDate: string;
    supplierId: string;
    buyerId: string;
    productType: string;
    basisId?: string | null;
    customerBasisId?: string | null;
    deliveryLocationId?: string | null;
    quantityKg: number;
  }): Promise<boolean> {
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
        eq(opt.quantityKg, data.quantityKg.toString()),
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
  ): Promise<boolean> {
    await db.transaction(async (tx) => {
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
    });

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
