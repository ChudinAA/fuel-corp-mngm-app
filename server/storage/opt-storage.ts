import { eq, desc, sql, or } from "drizzle-orm";
import { db } from "../db";
import {
  opt,
  warehouses,
  warehouseTransactions,
  wholesaleSuppliers,
  customers,
  type Opt,
  type InsertOpt,
} from "@shared/schema";
import { IOptStorage } from "./types";

export class OptStorage implements IOptStorage {
  async getOptDeals(page: number = 1, pageSize: number = 10, search?: string): Promise<{ data: Opt[]; total: number }> {
    const offset = (page - 1) * pageSize;

    let query = db.select().from(opt);
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(opt);

    // Add search filter if provided
    if (search && search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      const searchCondition = or(
        sql`${opt.supplierId}::text ILIKE ${searchPattern}`,
        sql`${opt.buyerId}::text ILIKE ${searchPattern}`,
        sql`${opt.basis}::text ILIKE ${searchPattern}`,
        sql`${opt.vehicleNumber}::text ILIKE ${searchPattern}`,
        sql`${opt.driverName}::text ILIKE ${searchPattern}`,
        sql`${opt.notes}::text ILIKE ${searchPattern}`
      );
      query = query.where(searchCondition);
      countQuery = countQuery.where(searchCondition);
    }

    const data = await query.orderBy(desc(opt.createdAt)).limit(pageSize).offset(offset);

    // Обогащаем данные именами поставщиков и покупателей
    const enrichedData = await Promise.all(
      data.map(async (deal) => {
        let supplierName = deal.supplierId;
        let buyerName = deal.buyerId;

        // Получаем название поставщика
        const [supplier] = await db.select().from(wholesaleSuppliers).where(eq(wholesaleSuppliers.id, deal.supplierId)).limit(1);
        if (supplier) {
          supplierName = supplier.name;
        }

        // Получаем название покупателя из customers
        const [buyer] = await db.select().from(customers).where(eq(customers.id, deal.buyerId)).limit(1);
        if (buyer) {
          buyerName = buyer.name;
        }

        return {
          ...deal,
          supplierId: supplierName,
          buyerId: buyerName
        };
      })
    );

    const [countResult] = await countQuery;
    return { data: enrichedData, total: Number(countResult?.count || 0) };
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