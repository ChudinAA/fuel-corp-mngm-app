
import { eq, desc, sql } from "drizzle-orm";
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
  async getOptDeals(page: number, pageSize: number): Promise<{ data: Opt[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const data = await db.select().from(opt).orderBy(desc(opt.dealDate)).limit(pageSize).offset(offset);

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

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(opt);
    return { data: enrichedData, total: Number(countResult?.count || 0) };
  }

  async createOpt(data: InsertOpt): Promise<Opt> {
    const [created] = await db.insert(opt).values(data).returning();

    // Обновляем остаток на складе (списание при продаже)
    if (created.warehouseId && created.quantityKg) {
      const quantityKg = parseFloat(created.quantityKg);
      const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, created.warehouseId)).limit(1);

      if (warehouse) {
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
