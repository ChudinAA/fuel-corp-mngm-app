import { eq, desc, sql, asc, or } from "drizzle-orm";
import { db } from "../db";
import {
  warehouses,
  warehouseTransactions,
  exchange,
  movement,
  opt,
  aircraftRefueling,
  wholesaleBases,
  refuelingBases,
  wholesaleSuppliers,
  refuelingProviders,
  customers,
  type Warehouse,
  type InsertWarehouse,
  type WarehouseTransaction,
  type Exchange,
  type InsertExchange,
  type Movement,
  type InsertMovement,
  type Opt,
  type InsertOpt,
  type AircraftRefueling,
  type InsertAircraftRefueling,
} from "@shared/schema";
import type { IOperationsStorage } from "./types";

export class OperationsStorage implements IOperationsStorage {
  async getAllWarehouses(): Promise<Warehouse[]> {
    const warehousesList = await db.select().from(warehouses).orderBy(asc(warehouses.name));

    // Enrich with basis name
    const enrichedWarehouses = await Promise.all(
      warehousesList.map(async (wh) => {
        if (wh.baseId) {
          // Try to find in wholesale bases first
          const [wholesaleBase] = await db.select().from(wholesaleBases).where(eq(wholesaleBases.id, wh.baseId)).limit(1);
          if (wholesaleBase) {
            return { ...wh, basis: wholesaleBase.name };
          }

          // Try refueling bases
          const [refuelingBase] = await db.select().from(refuelingBases).where(eq(refuelingBases.id, wh.baseId)).limit(1);
          if (refuelingBase) {
            return { ...wh, basis: refuelingBase.name };
          }
        }
        return wh;
      })
    );

    return enrichedWarehouses;
  }

  async getWarehouse(id: string): Promise<Warehouse | undefined> {
    const [wh] = await db.select().from(warehouses).where(eq(warehouses.id, id)).limit(1);

    if (!wh) return undefined;

    if (wh.baseId) {
      // Try to find in wholesale bases first
      const [wholesaleBase] = await db.select().from(wholesaleBases).where(eq(wholesaleBases.id, wh.baseId)).limit(1);
      if (wholesaleBase) {
        return { ...wh, basis: wholesaleBase.name };
      }

      // Try refueling bases
      const [refuelingBase] = await db.select().from(refuelingBases).where(eq(refuelingBases.id, wh.baseId)).limit(1);
      if (refuelingBase) {
        return { ...wh, basis: refuelingBase.name };
      }
    }

    return wh;
  }

  async createWarehouse(data: InsertWarehouse): Promise<Warehouse> {
    const [created] = await db.insert(warehouses).values(data).returning();
    return created;
  }

  async updateWarehouse(id: string, data: Partial<InsertWarehouse>): Promise<Warehouse | undefined> {
    const [updated] = await db.update(warehouses).set(data).where(eq(warehouses.id, id)).returning();
    return updated;
  }

  async deleteWarehouse(id: string): Promise<boolean> {
    await db.delete(warehouses).where(eq(warehouses.id, id));
    return true;
  }

  async getExchangeDeals(page: number, pageSize: number): Promise<{ data: Exchange[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const data = await db.select().from(exchange).orderBy(desc(exchange.dealDate)).limit(pageSize).offset(offset);
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(exchange);
    return { data, total: Number(countResult?.count || 0) };
  }

  async createExchange(data: InsertExchange): Promise<Exchange> {
    const [created] = await db.insert(exchange).values(data).returning();
    return created;
  }

  async updateExchange(id: string, data: Partial<InsertExchange>): Promise<Exchange | undefined> {
    const [updated] = await db.update(exchange).set(data).where(eq(exchange.id, id)).returning();
    return updated;
  }

  async deleteExchange(id: string): Promise<boolean> {
    await db.delete(exchange).where(eq(exchange.id, id));
    return true;
  }

  async getMovements(page: number, pageSize: number): Promise<{ data: Movement[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const data = await db.select().from(movement).orderBy(desc(movement.movementDate)).limit(pageSize).offset(offset);

    // Обогащаем данные названиями складов и поставщиков
    const enrichedData = await Promise.all(
      data.map(async (mov) => {
        let fromName = null;
        let toName = null;

        // Получаем название склада назначения
        if (mov.toWarehouseId) {
          const [toWarehouse] = await db.select().from(warehouses).where(eq(warehouses.id, mov.toWarehouseId)).limit(1);
          toName = toWarehouse?.name || mov.toWarehouseId;
        }

        // Получаем название источника (склад или поставщик)
        if (mov.movementType === 'supply' && mov.supplierId) {
          // Ищем в оптовых поставщиках
          const [wholesaleSupplier] = await db.select().from(wholesaleSuppliers).where(eq(wholesaleSuppliers.id, mov.supplierId)).limit(1);
          if (wholesaleSupplier) {
            fromName = wholesaleSupplier.name;
          } else {
            // Ищем в заправочных провайдерах
            const [refuelingProvider] = await db.select().from(refuelingProviders).where(eq(refuelingProviders.id, mov.supplierId)).limit(1);
            fromName = refuelingProvider?.name || mov.supplierId;
          }
        } else if (mov.fromWarehouseId) {
          const [fromWarehouse] = await db.select().from(warehouses).where(eq(warehouses.id, mov.fromWarehouseId)).limit(1);
          fromName = fromWarehouse?.name || mov.fromWarehouseId;
        }

        return {
          ...mov,
          fromName,
          toName
        };
      })
    );

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(movement);
    return { data: enrichedData, total: Number(countResult?.count || 0) };
  }

  async createMovement(data: InsertMovement): Promise<Movement> {
    const [created] = await db.insert(movement).values(data).returning();

    // Обновляем остатки на складах
    const quantityKg = parseFloat(created.quantityKg);

    // Если это поставка или внутреннее перемещение - увеличиваем остаток на складе назначения
    if (created.toWarehouseId) {
      const [targetWarehouse] = await db.select().from(warehouses).where(eq(warehouses.id, created.toWarehouseId)).limit(1);

      if (targetWarehouse) {
        const currentBalance = parseFloat(targetWarehouse.currentBalance || "0");
        const currentCost = parseFloat(targetWarehouse.averageCost || "0");
        const totalCost = parseFloat(created.totalCost || "0");

        // Рассчитываем новую среднюю стоимость
        const newBalance = currentBalance + quantityKg;
        const newAverageCost = newBalance > 0
          ? ((currentBalance * currentCost) + totalCost) / newBalance
          : 0;

        await db.update(warehouses)
          .set({
            currentBalance: newBalance.toFixed(2),
            averageCost: newAverageCost.toFixed(4)
          })
          .where(eq(warehouses.id, created.toWarehouseId));

        // Создаем запись транзакции (приход)
        await db.insert(warehouseTransactions).values({
          warehouseId: created.toWarehouseId,
          transactionType: created.movementType === 'supply' ? 'receipt' : 'transfer_in',
          sourceType: 'movement',
          sourceId: created.id,
          quantity: quantityKg.toString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          averageCostBefore: currentCost.toString(),
          averageCostAfter: newAverageCost.toString(),
          transactionDate: created.movementDate,
        });
      }
    }

    // Если это внутреннее перемещение - уменьшаем остаток на складе-источнике
    if (created.movementType === 'internal' && created.fromWarehouseId) {
      const [sourceWarehouse] = await db.select().from(warehouses).where(eq(warehouses.id, created.fromWarehouseId)).limit(1);

      if (sourceWarehouse) {
        const currentBalance = parseFloat(sourceWarehouse.currentBalance || "0");
        const currentCost = parseFloat(sourceWarehouse.averageCost || "0");
        const newBalance = Math.max(0, currentBalance - quantityKg);

        await db.update(warehouses)
          .set({
            currentBalance: newBalance.toFixed(2)
          })
          .where(eq(warehouses.id, created.fromWarehouseId));

        // Создаем запись транзакции (расход)
        await db.insert(warehouseTransactions).values({
          warehouseId: created.fromWarehouseId,
          transactionType: 'transfer_out',
          sourceType: 'movement',
          sourceId: created.id,
          quantity: (-quantityKg).toString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          averageCostBefore: currentCost.toString(),
          averageCostAfter: currentCost.toString(),
          transactionDate: created.movementDate,
        });
      }
    }

    return created;
  }

  async updateMovement(id: string, data: Partial<InsertMovement>): Promise<Movement | undefined> {
    const [updated] = await db.update(movement).set(data).where(eq(movement.id, id)).returning();
    return updated;
  }

  async deleteMovement(id: string): Promise<boolean> {
    await db.delete(movement).where(eq(movement.id, id));
    return true;
  }

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

  async getRefuelings(page: number, pageSize: number): Promise<{ data: AircraftRefueling[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const data = await db.select().from(aircraftRefueling).orderBy(desc(aircraftRefueling.refuelingDate)).limit(pageSize).offset(offset);
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(aircraftRefueling);
    return { data, total: Number(countResult?.count || 0) };
  }

  async createRefueling(data: InsertAircraftRefueling): Promise<AircraftRefueling> {
    const [created] = await db.insert(aircraftRefueling).values(data).returning();
    return created;
  }

  async updateRefueling(id: string, data: Partial<InsertAircraftRefueling>): Promise<AircraftRefueling | undefined> {
    const [updated] = await db.update(aircraftRefueling).set(data).where(eq(aircraftRefueling.id, id)).returning();
    return updated;
  }

  async deleteRefueling(id: string): Promise<boolean> {
    await db.delete(aircraftRefueling).where(eq(aircraftRefueling.id, id));
    return true;
  }

  async getDashboardStats(): Promise<{
    optDealsToday: number;
    refuelingToday: number;
    warehouseAlerts: number;
    totalProfitMonth: number;
    pendingDeliveries: number;
    totalVolumeSold: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Начало текущего месяца
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    // Оптовые сделки сегодня
    const [optTodayResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(opt)
      .where(eq(opt.dealDate, todayStr));
    const optDealsToday = Number(optTodayResult?.count || 0);

    // Заправки ВС сегодня
    const [refuelingTodayResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aircraftRefueling)
      .where(eq(aircraftRefueling.refuelingDate, todayStr));
    const refuelingToday = Number(refuelingTodayResult?.count || 0);

    // Проверка складов с низким остатком (< 20%)
    const warehousesList = await db.select().from(warehouses);
    let warehouseAlerts = 0;
    for (const wh of warehousesList) {
      const currentBalance = parseFloat(wh.currentBalance || "0");
      const maxCapacity = parseFloat(wh.storageCost || "100000"); // используем storageCost как максимальную вместимость
      if (maxCapacity > 0 && (currentBalance / maxCapacity) < 0.2) {
        warehouseAlerts++;
      }
    }

    // Прибыль за месяц (сумма всех продаж minus себестоимость)
    const optDealsMonth = await db
      .select()
      .from(opt)
      .where(sql`${opt.dealDate} >= ${monthStartStr}`);

    let totalProfitMonth = 0;
    for (const deal of optDealsMonth) {
      const revenue = parseFloat(deal.totalCost || "0");
      const quantity = parseFloat(deal.quantityKg || "0");
      
      // Получаем среднюю себестоимость со склада на момент продажи
      if (deal.warehouseId) {
        const [warehouse] = await db
          .select()
          .from(warehouses)
          .where(eq(warehouses.id, deal.warehouseId))
          .limit(1);
        
        if (warehouse) {
          const averageCost = parseFloat(warehouse.averageCost || "0");
          const cost = quantity * averageCost;
          totalProfitMonth += (revenue - cost);
        }
      }
    }

    // Количество перемещений в статусе ожидания (используем движения за последние 7 дней)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const [movementsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(movement)
      .where(sql`${movement.movementDate} >= ${sevenDaysAgoStr}`);
    const pendingDeliveries = Number(movementsResult?.count || 0);

    // Общий объем продаж за месяц
    const [volumeResult] = await db
      .select({ total: sql<number>`sum(CAST(${opt.quantityKg} AS DECIMAL))` })
      .from(opt)
      .where(sql`${opt.dealDate} >= ${monthStartStr}`);
    const totalVolumeSold = Number(volumeResult?.total || 0);

    return {
      optDealsToday,
      refuelingToday,
      warehouseAlerts,
      totalProfitMonth,
      pendingDeliveries,
      totalVolumeSold,
    };
  }

  async getWarehouseTransactions(warehouseId: string): Promise<WarehouseTransaction[]> {
    const transactions = await db
      .select()
      .from(warehouseTransactions)
      .where(eq(warehouseTransactions.warehouseId, warehouseId))
      .orderBy(desc(warehouseTransactions.transactionDate), desc(warehouseTransactions.createdAt));

    // Маппим поля из БД в формат для фронтенда
    return transactions.map(tx => ({
      id: tx.id,
      warehouseId: tx.warehouseId,
      transactionType: tx.transactionType,
      sourceType: tx.sourceType,
      sourceId: tx.sourceId,
      quantityKg: tx.quantity,
      balanceBefore: tx.balanceBefore || "0",
      balanceAfter: tx.balanceAfter || "0",
      averageCostBefore: tx.averageCostBefore || "0",
      averageCostAfter: tx.averageCostAfter || "0",
      transactionDate: tx.transactionDate,
      createdAt: tx.createdAt,
    }));
  }
}