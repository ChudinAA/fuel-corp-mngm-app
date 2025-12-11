import { eq, desc, sql, or, and } from "drizzle-orm";
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
  async getOptDeals(
    page: number = 1,
    pageSize: number = 10,
    search?: string,
    filters?: {
      dateFrom?: string;
      dateTo?: string;
      supplierId?: string;
      buyerId?: string;
      warehouseId?: string;
    }
  ): Promise<{ data: Opt[]; total: number }> {
    const offset = (page - 1) * pageSize;

    let query = db.select({
      opt: opt,
      supplierName: wholesaleSuppliers.name,
      buyerName: customers.name,
    })
      .from(opt)
      .leftJoin(wholesaleSuppliers, eq(opt.supplierId, wholesaleSuppliers.id))
      .leftJoin(customers, eq(opt.buyerId, customers.id));

    let countQuery = db.select({ count: sql<number>`count(*)` })
      .from(opt)
      .leftJoin(wholesaleSuppliers, eq(opt.supplierId, wholesaleSuppliers.id))
      .leftJoin(customers, eq(opt.buyerId, customers.id));

    const conditions = [];

    // Add search filter if provided
    if (search && search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      conditions.push(
        or(
          sql`${wholesaleSuppliers.name} ILIKE ${searchPattern}`,
          sql`${customers.name} ILIKE ${searchPattern}`,
          sql`${opt.basis}::text ILIKE ${searchPattern}`,
          sql`${opt.vehicleNumber}::text ILIKE ${searchPattern}`,
          sql`${opt.driverName}::text ILIKE ${searchPattern}`,
          sql`${opt.notes}::text ILIKE ${searchPattern}`
        )
      );
    }

    // Add date filters
    if (filters?.dateFrom) {
      conditions.push(sql`${opt.dealDate} >= ${filters.dateFrom}`);
    }

    if (filters?.dateTo) {
      conditions.push(sql`${opt.dealDate} <= ${filters.dateTo}`);
    }

    // Add supplier filter
    if (filters?.supplierId) {
      conditions.push(eq(opt.supplierId, filters.supplierId));
    }

    // Add buyer filter
    if (filters?.buyerId) {
      conditions.push(eq(opt.buyerId, filters.buyerId));
    }

    // Add warehouse filter
    if (filters?.warehouseId) {
      conditions.push(eq(opt.warehouseId, filters.warehouseId));
    }

    // Apply all conditions
    if (conditions.length > 0) {
      const combinedConditions = conditions.length === 1 ? conditions[0] : sql`${sql.join(conditions, sql` AND `)}`;
      query = query.where(combinedConditions);
      countQuery = countQuery.where(combinedConditions);
    }

    const rawData = await query.orderBy(desc(opt.createdAt)).limit(pageSize).offset(offset);
    
    // Преобразуем данные в нужный формат
    const data = rawData.map(row => ({
      ...row.opt,
      supplierId: row.supplierName || row.opt.supplierId,
      buyerId: row.buyerName || row.opt.buyerId,
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