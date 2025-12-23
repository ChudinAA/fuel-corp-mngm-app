
import { eq, desc, sql, or } from "drizzle-orm";
import { db } from "../db";
import {
  opt,
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

export class OptStorage implements IOptStorage {
  async getOptDeals(page: number = 1, pageSize: number = 10, search?: string): Promise<{ data: any[]; total: number }> {
    const offset = (page - 1) * pageSize;

    let baseQuery = db.query.opt.findMany({
      limit: pageSize,
      offset: offset,
      orderBy: (opt, { desc }) => [desc(opt.dealDate)],
      with: {
        supplier: {
          columns: {
            id: true,
            name: true,
            isWarehouse: true,
          }
        },
        buyer: {
          columns: {
            id: true,
            name: true,
          }
        },
        carrier: {
          columns: {
            id: true,
            name: true,
          }
        },
        deliveryLocation: {
          columns: {
            id: true,
            name: true,
          }
        },
        warehouse: {
          columns: {
            id: true,
            name: true,
          }
        },
      },
    });

    // Для поиска используем стандартный запрос с joins
    if (search && search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      const searchCondition = or(
        sql`${suppliers.name} ILIKE ${searchPattern}`,
        sql`${customers.name} ILIKE ${searchPattern}`,
        sql`${opt.basis}::text ILIKE ${searchPattern}`,
        sql`${opt.notes}::text ILIKE ${searchPattern}`,
        sql`${logisticsCarriers.name}::text ILIKE ${searchPattern}`,
        sql`${logisticsDeliveryLocations.name}::text ILIKE ${searchPattern}`
      );

      const rawData = await db.select({
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
        .leftJoin(logisticsDeliveryLocations, eq(opt.deliveryLocationId, logisticsDeliveryLocations.id))
        .leftJoin(warehouses, eq(opt.warehouseId, warehouses.id))
        .where(searchCondition)
        .orderBy(desc(opt.dealDate))
        .limit(pageSize)
        .offset(offset);

      const data = rawData.map(row => ({
        ...row.opt,
        supplier: {
          id: row.opt.supplierId,
          name: row.supplierName || 'Не указан',
          isWarehouse: row.supplierIsWarehouse || false,
        },
        buyer: {
          id: row.opt.buyerId,
          name: row.buyerName || 'Не указан',
        },
        carrier: row.opt.carrierId ? {
          id: row.opt.carrierId,
          name: row.carrierName || 'Не указан',
        } : null,
        deliveryLocation: row.opt.deliveryLocationId ? {
          id: row.opt.deliveryLocationId,
          name: row.deliveryLocationName || 'Не указано',
        } : null,
        warehouse: row.opt.warehouseId ? {
          id: row.opt.warehouseId,
          name: row.warehouseName || 'Не указан',
        } : null,
        isApproxVolume: row.opt.isApproxVolume || false,
      }));

      const [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(opt)
        .leftJoin(suppliers, eq(opt.supplierId, suppliers.id))
        .leftJoin(customers, eq(opt.buyerId, customers.id))
        .leftJoin(logisticsCarriers, eq(opt.carrierId, logisticsCarriers.id))
        .leftJoin(logisticsDeliveryLocations, eq(opt.deliveryLocationId, logisticsDeliveryLocations.id))
        .where(searchCondition);

      return { data, total: Number(countResult?.count || 0) };
    }

    // Без поиска используем query API с relations
    const data = await baseQuery;
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(opt);

    return { 
      data: data.map(item => ({
        ...item,
        supplier: item.supplier || { id: item.supplierId, name: 'Не указан', isWarehouse: false },
        buyer: item.buyer || { id: item.buyerId, name: 'Не указан' },
        isApproxVolume: item.isApproxVolume || false,
      })), 
      total: Number(countResult?.count || 0) 
    };
  }

  async createOpt(data: InsertOpt): Promise<Opt> {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(opt).values(data).returning();

      // Обновляем остаток на складе только если это склад-поставщик
      if (created.warehouseId && created.quantityKg) {
        const warehouse = await tx.query.warehouses.findFirst({
          where: eq(warehouses.id, created.warehouseId),
          with: {
            supplier: true,
          }
        });

        // Проверяем что это склад поставщика
        if (warehouse && warehouse.supplierId) {
          const quantityKg = parseFloat(created.quantityKg);
          const currentBalance = parseFloat(warehouse.currentBalance || "0");
          const newBalance = Math.max(0, currentBalance - quantityKg);

          await tx.update(warehouses)
            .set({
              currentBalance: newBalance.toFixed(2),
              updatedAt: sql`NOW()`,
              updatedById: data.createdById
            })
            .where(eq(warehouses.id, created.warehouseId));

          // Создаем запись транзакции
          const [transaction] = await tx.insert(warehouseTransactions).values({
            warehouseId: created.warehouseId,
            transactionType: TRANSACTION_TYPE.SALE,
            productType: PRODUCT_TYPE.KEROSENE,
            sourceType: SOURCE_TYPE.OPT,
            sourceId: created.id,
            quantity: (-quantityKg).toString(),
            balanceBefore: currentBalance.toString(),
            balanceAfter: newBalance.toString(),
            averageCostBefore: warehouse.averageCost || "0",
            averageCostAfter: warehouse.averageCost || "0",
            createdById: data.createdById
          }).returning();

          // Сохраняем ID транзакции в сделке
          await tx.update(opt)
            .set({ transactionId: transaction.id })
            .where(eq(opt.id, created.id));
        }
      }

      return created;
    });
  }

  async updateOpt(id: string, data: Partial<InsertOpt>): Promise<Opt | undefined> {
    return await db.transaction(async (tx) => {
      // Получаем текущую сделку с relations
      const currentOpt = await tx.query.opt.findFirst({
        where: eq(opt.id, id),
        with: {
          warehouse: true,
          transaction: true,
        }
      });

      if (!currentOpt) return undefined;

      // Проверяем изменилось ли количество КГ и есть ли привязанная транзакция
      if (data.quantityKg && currentOpt.transactionId && currentOpt.warehouseId) {
        const oldQuantityKg = parseFloat(currentOpt.quantityKg);
        const newQuantityKg = parseFloat(data.quantityKg.toString());

        if (oldQuantityKg !== newQuantityKg) {
          const quantityDiff = newQuantityKg - oldQuantityKg;

          if (currentOpt.warehouse && currentOpt.transaction) {
            const currentBalance = parseFloat(currentOpt.warehouse.currentBalance || "0");
            const newBalance = Math.max(0, currentBalance - quantityDiff);

            // Обновляем баланс склада
            await tx.update(warehouses)
              .set({
                currentBalance: newBalance.toFixed(2),
                updatedAt: sql`NOW()`,
                updatedById: data.updatedById
              })
              .where(eq(warehouses.id, currentOpt.warehouseId));

            // Обновляем транзакцию
            await tx.update(warehouseTransactions)
              .set({
                quantity: (-newQuantityKg).toString(),
                balanceAfter: newBalance.toString(),
                updatedAt: sql`NOW()`,
                updatedById: data.updatedById
              })
              .where(eq(warehouseTransactions.id, currentOpt.transactionId));
          }
        }
      }

      // Обновляем сделку
      const [updated] = await tx.update(opt).set({
        ...data,
        updatedAt: sql`NOW()`,
        updatedById: data.updatedById
      }).where(eq(opt.id, id)).returning();

      return updated;
    });
  }

  async deleteOpt(id: string): Promise<boolean> {
    await db.transaction(async (tx) => {
      // Получаем сделку с relations
      const currentOpt = await tx.query.opt.findFirst({
        where: eq(opt.id, id),
        with: {
          warehouse: true,
        }
      });

      if (currentOpt && currentOpt.transactionId && currentOpt.warehouseId && currentOpt.warehouse) {
        const quantityKg = parseFloat(currentOpt.quantityKg);
        const currentBalance = parseFloat(currentOpt.warehouse.currentBalance || "0");
        const newBalance = currentBalance + quantityKg;

        await tx.update(warehouses)
          .set({ currentBalance: newBalance.toFixed(2), updatedAt: sql`NOW()` })
          .where(eq(warehouses.id, currentOpt.warehouseId));

        // Удаляем транзакцию
        await tx.delete(warehouseTransactions).where(eq(warehouseTransactions.id, currentOpt.transactionId));
      }

      await tx.delete(opt).where(eq(opt.id, id));
    });

    return true;
  }
}
