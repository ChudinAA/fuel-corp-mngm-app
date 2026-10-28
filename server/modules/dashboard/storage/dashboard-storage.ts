import { eq, sql, and, isNull, inArray } from "drizzle-orm";
import { db } from "server/db";
import {
  opt,
  aircraftRefueling,
  warehouses,
  movement,
  suppliers,
  customers,
} from "@shared/schema";
import { widgetDefinitions, dashboardConfigurations, dashboardTemplates } from "../entities/dashboard";
import { IDashboardStorage, WidgetDefinition, DashboardConfiguration, DashboardLayout, DashboardWidget } from "./types";
import { MOVEMENT_TYPE, SOURCE_TYPE } from "@shared/constants";
import { formatTonnes, tonnesToKilograms } from "@shared/units";
import { optMassTonnesSql } from "../../opt/opt-mass-sql";

export class DashboardStorage implements IDashboardStorage {
  async getDashboardStats(): Promise<{
    optDealsToday: number;
    refuelingToday: number;
    warehouseAlerts: number;
    totalProfitMonth: number;
    pendingDeliveries: number;
    totalVolumeSold: number;
    totalVolumeSoldTonnes: number;
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
      .where(and(eq(opt.createdAt, todayStr), isNull(opt.deletedAt)));
    const optDealsToday = Number(optTodayResult?.count || 0);

    // Заправки ВС сегодня
    const [refuelingTodayResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aircraftRefueling)
      .where(and(eq(aircraftRefueling.refuelingDate, todayStr), isNull(aircraftRefueling.deletedAt)));
    const refuelingToday = Number(refuelingTodayResult?.count || 0);

    // Keep the legacy response field, but disable the alert calculation:
    // storageCost is a price per tonne, not a physical capacity.
    const warehouseAlerts = 0;

    // Прибыль за месяц - суммируем поле profit из opt и aircraftRefueling
    const [optProfitResult] = await db
      .select({ total: sql<number>`sum(CAST(${opt.profit} AS DECIMAL))` })
      .from(opt)
      .where(and(sql`${opt.createdAt} >= ${monthStartStr}`, isNull(opt.deletedAt)));

    const [refuelingProfitResult] = await db
      .select({
        total: sql<number>`sum(CAST(${aircraftRefueling.profit} AS DECIMAL))`,
      })
      .from(aircraftRefueling)
      .where(and(sql`${aircraftRefueling.refuelingDate} >= ${monthStartStr}`, isNull(aircraftRefueling.deletedAt)));

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
      .where(and(
        sql`${movement.movementDate} >= ${sevenDaysAgoStr}`,
        isNull(movement.deletedAt)
      ));
    const pendingDeliveries = Number(movementsResult?.count || 0);

    // Общий объем продаж за месяц
    const [volumeResult] = await db
      .select({
        totalTonnes: sql<number>`COALESCE(SUM(${optMassTonnesSql()}), 0)`,
      })
      .from(opt)
      .where(and(sql`${opt.createdAt} >= ${monthStartStr}`, isNull(opt.deletedAt)));
    const totalVolumeSoldTonnes = Number(volumeResult?.totalTonnes || 0);
    const totalVolumeSold = tonnesToKilograms(totalVolumeSoldTonnes);

    return {
      optDealsToday,
      refuelingToday,
      warehouseAlerts,
      totalProfitMonth,
      pendingDeliveries,
      totalVolumeSold,
      totalVolumeSoldTonnes,
    };
  }

  async getRecentOperations(): Promise<any[]> {
    const operations: any[] = [];

    // Получаем последние оптовые сделки
    const optDeals = await db
      .select()
      .from(opt)
      .where(isNull(opt.deletedAt))
      .orderBy(sql`${opt.createdAt} DESC`)
      .limit(3);

    for (const deal of optDeals) {
      const [supplier] = await db
        .select()
        .from(suppliers)
        .where(and(
          eq(suppliers.id, deal.supplierId),
          isNull(suppliers.deletedAt)
        ))
        .limit(1);
      const [buyer] = await db
        .select()
        .from(customers)
        .where(and(
          eq(customers.id, deal.buyerId),
          isNull(customers.deletedAt)
        ))
        .limit(1);

      operations.push({
        type: SOURCE_TYPE.OPT,
        description: `${supplier?.name || deal.supplierId} → ${
          buyer?.name || deal.buyerId
        }: ${formatTonnes(Number(deal.quantityTonnes || 0))} т`,
        time: deal.createdAt,
        status: "success",
      });
    }

    // Получаем последние заправки
    const refuelings = await db
      .select()
      .from(aircraftRefueling)
      .where(isNull(aircraftRefueling.deletedAt))
      .orderBy(sql`${aircraftRefueling.createdAt} DESC`)
      .limit(2);

    for (const refueling of refuelings) {
      operations.push({
        type: SOURCE_TYPE.REFUELING,
        description: `${refueling.basis || "База"}: ${
          refueling.aircraftNumber || "ВС"
        }, ${formatTonnes(Number(refueling.quantityTonnes || "0"))} т`,
        time: refueling.createdAt,
        status: "success",
      });
    }

    // Получаем последние перемещения
    const movements = await db
      .select()
      .from(movement)
      .where(isNull(movement.deletedAt))
      .orderBy(sql`${movement.createdAt} DESC`)
      .limit(2);

    for (const mov of movements) {
      let fromName = "Источник";
      let toName = "Назначение";

      if (mov.toWarehouseId) {
        const [toWarehouse] = await db
          .select()
          .from(warehouses)
          .where(and(
            eq(warehouses.id, mov.toWarehouseId),
            isNull(warehouses.deletedAt)
          ))
          .limit(1);
        toName = toWarehouse?.name || mov.toWarehouseId;
      }

      if (mov.movementType === MOVEMENT_TYPE.SUPPLY && mov.supplierId) {
        const [supplier] = await db
          .select()
          .from(suppliers)
          .where(and(
            eq(suppliers.id, mov.supplierId),
            isNull(suppliers.deletedAt)
          ))
          .limit(1);
        fromName = supplier?.name || mov.supplierId;
      } else if (mov.fromWarehouseId) {
        const [fromWarehouse] = await db
          .select()
          .from(warehouses)
          .where(and(
            eq(warehouses.id, mov.fromWarehouseId),
            isNull(warehouses.deletedAt)
          ))
          .limit(1);
        fromName = fromWarehouse?.name || mov.fromWarehouseId;
      }

      operations.push({
        type: SOURCE_TYPE.MOVEMENT,
        description: `${fromName} → ${toName}: ${formatTonnes(Number(mov.quantityTonnes || "0"))} т`,
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
    volumeSoldWeekTonnes: number;
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
      .where(and(
        sql`${opt.createdAt} >= ${weekAgoStr}`,
        isNull(opt.deletedAt)
      ));
    const optDealsWeek = Number(optWeekResult?.count || 0);

    // Заправки за неделю
    const [refuelingsWeekResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aircraftRefueling)
      .where(and(
        sql`${aircraftRefueling.refuelingDate} >= ${weekAgoStr}`,
        isNull(aircraftRefueling.deletedAt)
      ));
    const refuelingsWeek = Number(refuelingsWeekResult?.count || 0);

    // Объем продаж за неделю
    const [volumeWeekResult] = await db
      .select({
        totalTonnes: sql<number>`COALESCE(SUM(${optMassTonnesSql()}), 0)`,
      })
      .from(opt)
      .where(and(
        sql`${opt.createdAt} >= ${weekAgoStr}`,
        isNull(opt.deletedAt)
      ));
    const volumeSoldWeekTonnes = Number(volumeWeekResult?.totalTonnes || 0);
    const volumeSoldWeek = tonnesToKilograms(volumeSoldWeekTonnes);

    // Прибыль за неделю
    const [optProfitWeek] = await db
      .select({ total: sql<number>`sum(CAST(${opt.profit} AS DECIMAL))` })
      .from(opt)
      .where(and(
        sql`${opt.createdAt} >= ${weekAgoStr}`,
        isNull(opt.deletedAt)
      ));

    const [refuelingProfitWeek] = await db
      .select({
        total: sql<number>`sum(CAST(${aircraftRefueling.profit} AS DECIMAL))`,
      })
      .from(aircraftRefueling)
      .where(and(
        sql`${aircraftRefueling.refuelingDate} >= ${weekAgoStr}`,
        isNull(aircraftRefueling.deletedAt)
      ));

    const profitWeek =
      Number(optProfitWeek?.total || 0) +
      Number(refuelingProfitWeek?.total || 0);

    return {
      optDealsWeek,
      refuelingsWeek,
      volumeSoldWeek,
      volumeSoldWeekTonnes,
      profitWeek,
    };
  }

  // ============ НОВЫЕ МЕТОДЫ ДЛЯ ВИДЖЕТОВ ============

  async getAvailableWidgets(userPermissions: string[]): Promise<WidgetDefinition[]> {
    const allWidgets = await db.select().from(widgetDefinitions).where(eq(widgetDefinitions.isActive, true));

    // Фильтрация виджетов по правам пользователя
    return allWidgets.filter(widget => {
      if (widget.widgetKey === "warehouse_alerts") {
        return false;
      }
      if (!widget.requiredPermissions || widget.requiredPermissions.length === 0) {
        return true;
      }
      return widget.requiredPermissions.some(perm => userPermissions.includes(perm));
    });
  }

  // Admin: Widget definitions management
  async getAllWidgetDefinitions() {
    return await db.select().from(widgetDefinitions);
  }

  async createWidgetDefinition(data: any) {
    const [widget] = await db.insert(widgetDefinitions)
      .values(data)
      .returning();
    return widget;
  }

  async updateWidgetDefinition(id: string, data: any) {
    const [widget] = await db.update(widgetDefinitions)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(widgetDefinitions.id, id))
      .returning();
    return widget;
  }

  // Template management
  async getTemplates(category?: string) {
    if (category) {
      return await db.select().from(dashboardTemplates)
        .where(and(
          eq(dashboardTemplates.category, category),
          eq(dashboardTemplates.isActive, true)
        ));
    }
    return await db.select().from(dashboardTemplates)
      .where(eq(dashboardTemplates.isActive, true));
  }

  async getTemplate(id: string) {
    const [template] = await db.select().from(dashboardTemplates)
      .where(eq(dashboardTemplates.id, id));
    return template;
  }

  async createTemplate(data: any) {
    const [template] = await db.insert(dashboardTemplates)
      .values(data)
      .returning();
    return template;
  }

  async updateTemplate(id: string, data: any) {
    const [template] = await db.update(dashboardTemplates)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(dashboardTemplates.id, id))
      .returning();
    return template;
  }

  async deleteTemplate(id: string) {
    await db.delete(dashboardTemplates)
      .where(eq(dashboardTemplates.id, id));
  }

  async applyTemplate(userId: string, templateId: string) {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    // Применяем шаблон к конфигурации пользователя
    const [config] = await db.update(dashboardConfigurations)
      .set({
        layout: template.layout,
        widgets: template.widgets,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(dashboardConfigurations.userId, userId))
      .returning();

    return config;
  }


  async getUserDashboard(userId: string): Promise<DashboardConfiguration | null> {
    const [config] = await db
      .select()
      .from(dashboardConfigurations)
      .where(eq(dashboardConfigurations.userId, userId))
      .limit(1);

    return config || null;
  }

  async saveDashboardConfiguration(
    userId: string, 
    layout: DashboardLayout[], 
    widgets: DashboardWidget[]
  ): Promise<DashboardConfiguration> {
    const existing = await this.getUserDashboard(userId);

    if (existing) {
      // Обновляем существующую конфигурацию
      const [updated] = await db
        .update(dashboardConfigurations)
        .set({
          layout,
          widgets,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(dashboardConfigurations.id, existing.id))
        .returning();

      return updated;
    } else {
      // Создаём новую конфигурацию
      const [created] = await db
        .insert(dashboardConfigurations)
        .values({
          userId,
          layout,
          widgets,
          isDefault: true,
        })
        .returning();

      return created;
    }
  }

  async getWidgetData(widgetKey: string, config?: any): Promise<any> {
    switch (widgetKey) {
      case 'opt_stats':
        return this.getOptStatsWidget();
      case 'refueling_stats':
        return this.getRefuelingStatsWidget();
      case 'profit_month':
        return this.getProfitMonthWidget();
      case 'warehouse_alerts':
        return this.getWarehouseAlertsWidget();
      case 'recent_operations':
        return this.getRecentOperations();
      case 'warehouse_balances':
        return this.getWarehouseBalancesWidget();
      case 'week_stats':
        return this.getWeekStats();
      default:
        return null;
    }
  }

  // Вспомогательные методы для виджетов
  private async getOptStatsWidget() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(opt)
      .where(and(eq(opt.createdAt, todayStr), isNull(opt.deletedAt)));

    return { value: Number(result?.count || 0) };
  }

  private async getRefuelingStatsWidget() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aircraftRefueling)
      .where(and(eq(aircraftRefueling.refuelingDate, todayStr), isNull(aircraftRefueling.deletedAt)));

    return { value: Number(result?.count || 0) };
  }

  private async getProfitMonthWidget() {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split("T")[0];

    const [optProfit] = await db
      .select({ total: sql<number>`sum(CAST(${opt.profit} AS DECIMAL))` })
      .from(opt)
      .where(and(sql`${opt.createdAt} >= ${monthStartStr}`, isNull(opt.deletedAt)));

    const [refuelingProfit] = await db
      .select({ total: sql<number>`sum(CAST(${aircraftRefueling.profit} AS DECIMAL))` })
      .from(aircraftRefueling)
      .where(and(sql`${aircraftRefueling.refuelingDate} >= ${monthStartStr}`, isNull(aircraftRefueling.deletedAt)));

    const total = Number(optProfit?.total || 0) + Number(refuelingProfit?.total || 0);

    return { value: total };
  }

  private async getWarehouseAlertsWidget() {
    return { value: 0, enabled: false };
  }

  private async getWarehouseBalancesWidget() {
    const warehousesList = await db
      .select()
      .from(warehouses)
      .where(isNull(warehouses.deletedAt))
      .limit(5);

    return warehousesList.map(wh => ({
      name: wh.name,
      current: parseFloat(wh.currentBalance || "0"),
    }));
  }
}