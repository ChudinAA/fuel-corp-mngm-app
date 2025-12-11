import { eq, desc, sql, or } from "drizzle-orm";
import { db } from "../db";
import {
  opt,
  warehouses,
  warehouseTransactions,
  wholesaleSuppliers,
  customers,
  logisticsCarriers,
  logisticsDeliveryLocations,
  type Opt,
  type InsertOpt,
} from "@shared/schema";
import { IOptStorage } from "./types";

export class OptStorage implements IOptStorage {
  async getOptDeals(page: number = 1, pageSize: number = 10, search?: string): Promise<{ data: any[]; total: number }> {
    const offset = (page - 1) * pageSize;

    let query = db.select({
      opt: opt,
      supplierName: wholesaleSuppliers.name,
      supplierIsWarehouse: wholesaleSuppliers.isWarehouse,
      buyerName: customers.name,
      carrierName: sql<string>`${logisticsCarriers.name}`,
      deliveryLocationName: sql<string>`${logisticsDeliveryLocations.name}`,
      warehouseName: sql<string>`${warehouses.name}`,
    })
      .from(opt)
      .leftJoin(wholesaleSuppliers, eq(opt.supplierId, wholesaleSuppliers.id))
      .leftJoin(customers, eq(opt.buyerId, customers.id))
      .leftJoin(logisticsCarriers, eq(opt.carrierId, logisticsCarriers.id))
      .leftJoin(logisticsDeliveryLocations, eq(opt.deliveryLocationId, logisticsDeliveryLocations.id))
      .leftJoin(warehouses, eq(opt.warehouseId, warehouses.id));

    let countQuery = db.select({ count: sql<number>`count(*)` })
      .from(opt)
      .leftJoin(wholesaleSuppliers, eq(opt.supplierId, wholesaleSuppliers.id))
      .leftJoin(customers, eq(opt.buyerId, customers.id));

    // Add search filter if provided
    if (search && search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      const searchCondition = or(
        sql`${wholesaleSuppliers.name} ILIKE ${searchPattern}`,
        sql`${customers.name} ILIKE ${searchPattern}`,
        sql`${opt.basis}::text ILIKE ${searchPattern}`,
        sql`${opt.vehicleNumber}::text ILIKE ${searchPattern}`,
        sql`${opt.driverName}::text ILIKE ${searchPattern}`,
        sql`${opt.notes}::text ILIKE ${searchPattern}`
      );
      query = query.where(searchCondition);
      countQuery = countQuery.where(searchCondition);
    }

    const rawData = await query.orderBy(desc(opt.createdAt)).limit(pageSize).offset(offset);
    
    // Преобразуем данные в нужный формат с полными объектами
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
    }));

    const [countResult] = await countQuery;
    return { data, total: Number(countResult?.count || 0) };
  }

  async createOpt(data: InsertOpt): Promise<Opt> {
    const [created] = await db.insert(opt).values(data).returning();

    // Обновляем остаток на складе только если это склад-поставщик
    if (created.warehouseId && created.quantityKg) {
      const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, created.warehouseId)).limit(1);

      // Проверяем что это склад поставщика
      if (warehouse && warehouse.supplierType && warehouse.supplierId) {
        const quantityKg = parseFloat(created.quantityKg);
        const currentBalance = parseFloat(warehouse.currentBalance || "0");
        const newBalance = Math.max(0, currentBalance - quantityKg);

        await db.update(warehouses)
          .set({
            currentBalance: newBalance.toFixed(2)
          })
          .where(eq(warehouses.id, created.warehouseId));

        // Создаем запись транзакции
        await db.insert(warehouseTransactions).values({
          warehouseId: created.warehouseId,
          transactionType: 'sale',
          sourceType: 'opt',
          sourceId: created.id,
          quantity: (-quantityKg).toString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          averageCostBefore: warehouse.averageCost || "0",
          averageCostAfter: warehouse.averageCost || "0",
          transactionDate: created.dealDate,
        });
      }
    }

    return created;
  }

  async updateOpt(id: string, data: Partial<InsertOpt>): Promise<Opt | undefined> {
    const [updated] = await db.update(opt).set(data).where(eq(opt.id, id)).returning();
    return updated;
  }

  async deleteOpt(id: string): Promise<boolean> {
    await db.delete(opt).where(eq(opt.id, id));
    return true;
  }
}