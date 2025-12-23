import { eq, sql } from "drizzle-orm";
import { db } from "../../../db";
import {
  opt,
  aircraftRefueling,
  warehouses,
  movement,
  suppliers,
  customers,
} from "@shared/schema";
import { IDashboardStorage } from "../../../storage/types";
import { MOVEMENT_TYPE, SOURCE_TYPE } from "@shared/constants";

export class DashboardStorage implements IDashboardStorage {
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
    const todayStr = today.toISOString().split("T")[0];

    // Начало текущего месяца
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split("T")[0];

    // Оптовые сделки сегодня
    const [optTodayResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(opt)
      .where(eq(opt.createdAt, todayStr));
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
      const maxCapacity = parseFloat(wh.storageCost || "100000");
      if (maxCapacity > 0 && currentBalance / maxCapacity < 0.2) {
        warehouseAlerts++;
      }
    }

    // Прибыль за месяц - суммируем поле profit из opt и aircraftRefueling
    const [optProfitResult] = await db
      .select({ total: sql<number>`sum(CAST(${opt.profit} AS DECIMAL))` })
      .from(opt)
      .where(sql`${opt.createdAt} >= ${monthStartStr}`);

    const [refuelingProfitResult] = await db
      .select({
        total: sql<number>`sum(CAST(${aircraftRefueling.profit} AS DECIMAL))`,
      })
      .from(aircraftRefueling)
      .where(sql`${aircraftRefueling.refuelingDate} >= ${monthStartStr}`);

    const totalProfitMonth =
      Number(optProfitResult?.total || 0) +
      Number(refuelingProfitResult?.total || 0);

    // Количество перемещений в статусе ожидания (используем движения за последние 7 дней)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    const [movementsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(movement)
      .where(sql`${movement.movementDate} >= ${sevenDaysAgoStr}`);
    const pendingDeliveries = Number(movementsResult?.count || 0);

    // Общий объем продаж за месяц
    const [volumeResult] = await db
      .select({ total: sql<number>`sum(CAST(${opt.quantityKg} AS DECIMAL))` })
      .from(opt)
      .where(sql`${opt.createdAt} >= ${monthStartStr}`);
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

  async getRecentOperations(): Promise<any[]> {
    const operations: any[] = [];

    // Получаем последние оптовые сделки
    const optDeals = await db
      .select()
      .from(opt)
      .orderBy(sql`${opt.createdAt} DESC`)
      .limit(3);

    for (const deal of optDeals) {
      const [supplier] = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, deal.supplierId))
        .limit(1);
      const [buyer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, deal.buyerId))
        .limit(1);

      operations.push({
        type: SOURCE_TYPE.OPT,
        description: `${supplier?.name || deal.supplierId} → ${
          buyer?.name || deal.buyerId
        }: ${parseFloat(deal.quantityKg || "0").toLocaleString("ru-RU")} кг`,
        time: deal.createdAt,
        status: "success",
      });
    }

    // Получаем последние заправки
    const refuelings = await db
      .select()
      .from(aircraftRefueling)
      .orderBy(sql`${aircraftRefueling.createdAt} DESC`)
      .limit(2);

    for (const refueling of refuelings) {
      operations.push({
        type: SOURCE_TYPE.REFUELING,
        description: `${refueling.basis || "База"}: ${
          refueling.aircraftNumber || "ВС"
        }, ${parseFloat(refueling.quantityKg || "0").toLocaleString(
          "ru-RU"
        )} кг`,
        time: refueling.createdAt,
        status: "success",
      });
    }

    // Получаем последние перемещения
    const movements = await db
      .select()
      .from(movement)
      .orderBy(sql`${movement.createdAt} DESC`)
      .limit(2);

    for (const mov of movements) {
      let fromName = "Источник";
      let toName = "Назначение";

      if (mov.toWarehouseId) {
        const [toWarehouse] = await db
          .select()
          .from(warehouses)
          .where(eq(warehouses.id, mov.toWarehouseId))
          .limit(1);
        toName = toWarehouse?.name || mov.toWarehouseId;
      }

      if (mov.movementType === MOVEMENT_TYPE.SUPPLY && mov.supplierId) {
        const [supplier] = await db
          .select()
          .from(suppliers)
          .where(eq(suppliers.id, mov.supplierId))
          .limit(1);
        fromName = supplier?.name || mov.supplierId;
      } else if (mov.fromWarehouseId) {
        const [fromWarehouse] = await db
          .select()
          .from(warehouses)
          .where(eq(warehouses.id, mov.fromWarehouseId))
          .limit(1);
        fromName = fromWarehouse?.name || mov.fromWarehouseId;
      }

      operations.push({
        type: SOURCE_TYPE.MOVEMENT,
        description: `${fromName} → ${toName}: ${parseFloat(
          mov.quantityKg || "0"
        ).toLocaleString("ru-RU")} кг`,
        time: mov.createdAt,
        status:
          mov.movementType === MOVEMENT_TYPE.SUPPLY ? "success" : "pending",
      });
    }

    // Сортируем по времени
    operations.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
    );

    return operations.slice(0, 5);
  }

  async getWeekStats(): Promise<{
    optDealsWeek: number;
    refuelingsWeek: number;
    volumeSoldWeek: number;
    profitWeek: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];

    // Оптовые сделки за неделю
    const [optWeekResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(opt)
      .where(sql`${opt.createdAt} >= ${weekAgoStr}`);
    const optDealsWeek = Number(optWeekResult?.count || 0);

    // Заправки за неделю
    const [refuelingsWeekResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aircraftRefueling)
      .where(sql`${aircraftRefueling.refuelingDate} >= ${weekAgoStr}`);
    const refuelingsWeek = Number(refuelingsWeekResult?.count || 0);

    // Объем продаж за неделю
    const [volumeWeekResult] = await db
      .select({ total: sql<number>`sum(CAST(${opt.quantityKg} AS DECIMAL))` })
      .from(opt)
      .where(sql`${opt.createdAt} >= ${weekAgoStr}`);
    const volumeSoldWeek = Number(volumeWeekResult?.total || 0);

    // Прибыль за неделю
    const [optProfitWeek] = await db
      .select({ total: sql<number>`sum(CAST(${opt.profit} AS DECIMAL))` })
      .from(opt)
      .where(sql`${opt.createdAt} >= ${weekAgoStr}`);

    const [refuelingProfitWeek] = await db
      .select({
        total: sql<number>`sum(CAST(${aircraftRefueling.profit} AS DECIMAL))`,
      })
      .from(aircraftRefueling)
      .where(sql`${aircraftRefueling.refuelingDate} >= ${weekAgoStr}`);

    const profitWeek =
      Number(optProfitWeek?.total || 0) +
      Number(refuelingProfitWeek?.total || 0);

    return {
      optDealsWeek,
      refuelingsWeek,
      volumeSoldWeek,
      profitWeek,
    };
  }
}
