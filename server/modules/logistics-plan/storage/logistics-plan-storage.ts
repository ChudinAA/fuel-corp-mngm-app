import { eq, asc, desc, isNull, and, gte, lte, sql, or } from "drizzle-orm";
import { db } from "server/db";
import {
  logisticsTransportUnits,
  logisticsDriverSchedule,
  logisticsVehicleAvailability,
  logisticsPlanRoutes,
  logisticsPlanComments,
  logisticsMonthlySyncs,
  logisticsPlanNotifications,
  logisticsUnitExtraDrivers,
  planEntries,
  type LogisticsTransportUnit,
  type InsertLogisticsTransportUnit,
  type LogisticsDriverSchedule,
  type InsertLogisticsDriverSchedule,
  type LogisticsVehicleAvailability,
  type InsertLogisticsVehicleAvailability,
  type LogisticsPlanRoute,
  type InsertLogisticsPlanRoute,
  type LogisticsPlanComment,
  type InsertLogisticsPlanComment,
  type LogisticsMonthlySync,
  type InsertLogisticsMonthlySync,
  type LogisticsPlanNotification,
  type InsertLogisticsPlanNotification,
} from "@shared/schema";
import type { ILogisticsPlanStorage } from "./types";

export class LogisticsPlanStorage implements ILogisticsPlanStorage {
  // ========== TRANSPORT UNITS ==========

  async getAllTransportUnits(filters?: { carrierId?: string; periodFrom?: string; periodTo?: string }): Promise<LogisticsTransportUnit[]> {
    const conditions = [isNull(logisticsTransportUnits.deletedAt)];
    if (filters?.carrierId) {
      conditions.push(eq(logisticsTransportUnits.carrierId, filters.carrierId));
    }
    return db
      .select()
      .from(logisticsTransportUnits)
      .where(and(...conditions))
      .orderBy(asc(logisticsTransportUnits.createdAt));
  }

  async getTransportUnit(id: string): Promise<LogisticsTransportUnit | undefined> {
    const [unit] = await db
      .select()
      .from(logisticsTransportUnits)
      .where(and(eq(logisticsTransportUnits.id, id), isNull(logisticsTransportUnits.deletedAt)))
      .limit(1);
    return unit;
  }

  async createTransportUnit(data: InsertLogisticsTransportUnit): Promise<LogisticsTransportUnit> {
    const [created] = await db.insert(logisticsTransportUnits).values(data).returning();
    return created;
  }

  async updateTransportUnit(id: string, data: Partial<InsertLogisticsTransportUnit>): Promise<LogisticsTransportUnit | undefined> {
    const [updated] = await db
      .update(logisticsTransportUnits)
      .set({ ...data, updatedAt: sql`NOW()` })
      .where(eq(logisticsTransportUnits.id, id))
      .returning();
    return updated;
  }

  async deleteTransportUnit(id: string, userId?: string): Promise<boolean> {
    await db
      .update(logisticsTransportUnits)
      .set({ deletedAt: sql`NOW()`, deletedById: userId })
      .where(eq(logisticsTransportUnits.id, id));
    return true;
  }

  // ========== DRIVER SCHEDULE ==========

  async getDriverSchedule(driverId: string): Promise<LogisticsDriverSchedule[]> {
    return db
      .select()
      .from(logisticsDriverSchedule)
      .where(and(eq(logisticsDriverSchedule.driverId, driverId), isNull(logisticsDriverSchedule.deletedAt)))
      .orderBy(asc(logisticsDriverSchedule.dateFrom));
  }

  async getAllDriverSchedules(filters?: { dateFrom?: string; dateTo?: string }): Promise<LogisticsDriverSchedule[]> {
    const conditions = [isNull(logisticsDriverSchedule.deletedAt)];
    if (filters?.dateFrom) {
      conditions.push(gte(logisticsDriverSchedule.dateTo, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(logisticsDriverSchedule.dateFrom, filters.dateTo));
    }
    return db
      .select()
      .from(logisticsDriverSchedule)
      .where(and(...conditions))
      .orderBy(asc(logisticsDriverSchedule.dateFrom));
  }

  async createDriverSchedule(data: InsertLogisticsDriverSchedule): Promise<LogisticsDriverSchedule> {
    const [created] = await db.insert(logisticsDriverSchedule).values(data).returning();
    return created;
  }

  async updateDriverSchedule(id: string, data: Partial<InsertLogisticsDriverSchedule>): Promise<LogisticsDriverSchedule | undefined> {
    const [updated] = await db
      .update(logisticsDriverSchedule)
      .set({ ...data, updatedAt: sql`NOW()` })
      .where(eq(logisticsDriverSchedule.id, id))
      .returning();
    return updated;
  }

  async deleteDriverSchedule(id: string, userId?: string): Promise<boolean> {
    await db
      .update(logisticsDriverSchedule)
      .set({ deletedAt: sql`NOW()`, deletedById: userId })
      .where(eq(logisticsDriverSchedule.id, id));
    return true;
  }

  // ========== VEHICLE AVAILABILITY ==========

  async getVehicleAvailability(vehicleId: string): Promise<LogisticsVehicleAvailability[]> {
    return db
      .select()
      .from(logisticsVehicleAvailability)
      .where(and(eq(logisticsVehicleAvailability.vehicleId, vehicleId), isNull(logisticsVehicleAvailability.deletedAt)))
      .orderBy(asc(logisticsVehicleAvailability.dateFrom));
  }

  async getAllVehicleAvailabilities(filters?: { dateFrom?: string; dateTo?: string }): Promise<LogisticsVehicleAvailability[]> {
    const conditions = [isNull(logisticsVehicleAvailability.deletedAt)];
    if (filters?.dateFrom) {
      conditions.push(gte(logisticsVehicleAvailability.dateTo, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(logisticsVehicleAvailability.dateFrom, filters.dateTo));
    }
    return db
      .select()
      .from(logisticsVehicleAvailability)
      .where(and(...conditions))
      .orderBy(asc(logisticsVehicleAvailability.dateFrom));
  }

  async createVehicleAvailability(data: InsertLogisticsVehicleAvailability): Promise<LogisticsVehicleAvailability> {
    const [created] = await db.insert(logisticsVehicleAvailability).values(data).returning();
    return created;
  }

  async updateVehicleAvailability(id: string, data: Partial<InsertLogisticsVehicleAvailability>): Promise<LogisticsVehicleAvailability | undefined> {
    const [updated] = await db
      .update(logisticsVehicleAvailability)
      .set({ ...data, updatedAt: sql`NOW()` })
      .where(eq(logisticsVehicleAvailability.id, id))
      .returning();
    return updated;
  }

  async deleteVehicleAvailability(id: string, userId?: string): Promise<boolean> {
    await db
      .update(logisticsVehicleAvailability)
      .set({ deletedAt: sql`NOW()`, deletedById: userId })
      .where(eq(logisticsVehicleAvailability.id, id));
    return true;
  }

  // ========== PLAN ROUTES ==========

  async getPlanRoutes(filters?: { periodFrom?: string; periodTo?: string; scenarioId?: string; transportUnitId?: string }): Promise<LogisticsPlanRoute[]> {
    const conditions = [isNull(logisticsPlanRoutes.deletedAt)];
    if (filters?.periodFrom) {
      conditions.push(gte(logisticsPlanRoutes.dateStart, filters.periodFrom));
    }
    if (filters?.periodTo) {
      conditions.push(lte(logisticsPlanRoutes.dateStart, filters.periodTo));
    }
    if (filters?.scenarioId) {
      conditions.push(eq(logisticsPlanRoutes.scenarioId, filters.scenarioId));
    }
    if (filters?.transportUnitId) {
      conditions.push(eq(logisticsPlanRoutes.transportUnitId, filters.transportUnitId));
    }
    return db
      .select()
      .from(logisticsPlanRoutes)
      .where(and(...conditions))
      .orderBy(asc(logisticsPlanRoutes.dateStart));
  }

  async getPlanRoute(id: string): Promise<LogisticsPlanRoute | undefined> {
    const [route] = await db
      .select()
      .from(logisticsPlanRoutes)
      .where(and(eq(logisticsPlanRoutes.id, id), isNull(logisticsPlanRoutes.deletedAt)))
      .limit(1);
    return route;
  }

  async createPlanRoute(data: InsertLogisticsPlanRoute): Promise<LogisticsPlanRoute> {
    const [created] = await db.insert(logisticsPlanRoutes).values(data).returning();
    return created;
  }

  async updatePlanRoute(id: string, data: Partial<InsertLogisticsPlanRoute>): Promise<LogisticsPlanRoute | undefined> {
    const [updated] = await db
      .update(logisticsPlanRoutes)
      .set({ ...data, updatedAt: sql`NOW()` })
      .where(eq(logisticsPlanRoutes.id, id))
      .returning();
    return updated;
  }

  async deletePlanRoute(id: string, userId?: string): Promise<boolean> {
    await db
      .update(logisticsPlanRoutes)
      .set({ deletedAt: sql`NOW()`, deletedById: userId })
      .where(eq(logisticsPlanRoutes.id, id));
    return true;
  }

  async getUnassignedRoutes(periodFrom: string, periodTo: string, scenarioId?: string): Promise<any[]> {
    const conditions = [
      isNull(planEntries.deletedAt),
      gte(planEntries.date, periodFrom),
      lte(planEntries.date, periodTo),
    ];
    if (scenarioId) {
      conditions.push(eq(planEntries.scenarioId, scenarioId));
    }
    const entries = await db.select().from(planEntries).where(and(...conditions));

    // Fetch route planEntryIds that fall within this period (avoid cross-period false positives)
    const routeConds = [
      isNull(logisticsPlanRoutes.deletedAt),
      gte(logisticsPlanRoutes.dateStart, periodFrom),
      lte(logisticsPlanRoutes.dateStart, periodTo),
    ];
    if (scenarioId) {
      routeConds.push(eq(logisticsPlanRoutes.scenarioId, scenarioId));
    }
    const assignedEntryIds = await db
      .select({ planEntryId: logisticsPlanRoutes.planEntryId })
      .from(logisticsPlanRoutes)
      .where(and(...routeConds));

    const assignedSet = new Set(
      assignedEntryIds.map((r) => r.planEntryId).filter(Boolean),
    );
    return entries.filter((e) => !assignedSet.has(e.id));
  }

  // ========== PLAN COMMENTS ==========

  async getRouteComments(routeId: string): Promise<LogisticsPlanComment[]> {
    return db
      .select()
      .from(logisticsPlanComments)
      .where(and(eq(logisticsPlanComments.routeId, routeId), isNull(logisticsPlanComments.deletedAt)))
      .orderBy(asc(logisticsPlanComments.createdAt));
  }

  async createRouteComment(data: InsertLogisticsPlanComment): Promise<LogisticsPlanComment> {
    const [created] = await db.insert(logisticsPlanComments).values(data).returning();
    return created;
  }

  async deleteRouteComment(id: string, userId?: string): Promise<boolean> {
    await db
      .update(logisticsPlanComments)
      .set({ deletedAt: sql`NOW()`, deletedById: userId })
      .where(eq(logisticsPlanComments.id, id));
    return true;
  }

  async markCommentsRead(routeId: string): Promise<void> {
    await db
      .update(logisticsPlanComments)
      .set({ isRead: true })
      .where(eq(logisticsPlanComments.routeId, routeId));
  }

  // ========== MONTHLY SYNCS ==========

  async getActiveSyncs(periodFrom?: string, periodTo?: string): Promise<LogisticsMonthlySync[]> {
    const conditions = [eq(logisticsMonthlySyncs.status, "active")];
    if (periodFrom) conditions.push(gte(logisticsMonthlySyncs.periodTo, periodFrom));
    if (periodTo) conditions.push(lte(logisticsMonthlySyncs.periodFrom, periodTo));
    return db
      .select()
      .from(logisticsMonthlySyncs)
      .where(and(...conditions))
      .orderBy(desc(logisticsMonthlySyncs.createdAt));
  }

  async getSync(id: string): Promise<LogisticsMonthlySync | undefined> {
    const [sync] = await db
      .select()
      .from(logisticsMonthlySyncs)
      .where(eq(logisticsMonthlySyncs.id, id))
      .limit(1);
    return sync;
  }

  async createSync(data: InsertLogisticsMonthlySync): Promise<LogisticsMonthlySync> {
    const [created] = await db.insert(logisticsMonthlySyncs).values(data).returning();
    return created;
  }

  async updateSync(id: string, data: Partial<InsertLogisticsMonthlySync>): Promise<LogisticsMonthlySync | undefined> {
    const [updated] = await db
      .update(logisticsMonthlySyncs)
      .set({ ...data, updatedAt: sql`NOW()` })
      .where(eq(logisticsMonthlySyncs.id, id))
      .returning();
    return updated;
  }

  async getLatestSync(scenarioId?: string): Promise<LogisticsMonthlySync | undefined> {
    const conditions = scenarioId
      ? [eq(logisticsMonthlySyncs.scenarioId, scenarioId)]
      : [];
    const [sync] = await db
      .select()
      .from(logisticsMonthlySyncs)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(logisticsMonthlySyncs.createdAt))
      .limit(1);
    return sync;
  }

  async getSyncByPeriodAndScenario(periodFrom: string, periodTo: string, scenarioId?: string | null): Promise<LogisticsMonthlySync | undefined> {
    const conditions: any[] = [
      eq(logisticsMonthlySyncs.status, "active"),
      sql`date_trunc('month', ${logisticsMonthlySyncs.periodFrom}) = date_trunc('month', ${periodFrom}::timestamp)`,
    ];
    if (scenarioId) {
      conditions.push(eq(logisticsMonthlySyncs.scenarioId, scenarioId));
    } else {
      conditions.push(isNull(logisticsMonthlySyncs.scenarioId));
    }
    const [sync] = await db
      .select()
      .from(logisticsMonthlySyncs)
      .where(and(...conditions))
      .orderBy(desc(logisticsMonthlySyncs.createdAt))
      .limit(1);
    return sync;
  }

  // ========== NOTIFICATIONS ==========

  async getNotifications(filters?: { periodFrom?: string; periodTo?: string; isRead?: boolean }): Promise<LogisticsPlanNotification[]> {
    const conditions: any[] = [];
    if (filters?.periodFrom) conditions.push(gte(logisticsPlanNotifications.createdAt, filters.periodFrom));
    if (filters?.periodTo) conditions.push(lte(logisticsPlanNotifications.createdAt, filters.periodTo));
    if (filters?.isRead !== undefined) conditions.push(eq(logisticsPlanNotifications.isRead, filters.isRead));
    return db
      .select()
      .from(logisticsPlanNotifications)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(logisticsPlanNotifications.createdAt));
  }

  async createNotification(data: InsertLogisticsPlanNotification): Promise<LogisticsPlanNotification> {
    const [created] = await db.insert(logisticsPlanNotifications).values(data).returning();
    return created;
  }

  async markNotificationRead(id: string): Promise<void> {
    await db
      .update(logisticsPlanNotifications)
      .set({ isRead: true })
      .where(eq(logisticsPlanNotifications.id, id));
  }

  async markAllNotificationsRead(periodFrom?: string, periodTo?: string): Promise<void> {
    const conditions: any[] = [eq(logisticsPlanNotifications.isRead, false)];
    if (periodFrom) conditions.push(gte(logisticsPlanNotifications.createdAt, periodFrom));
    if (periodTo) conditions.push(lte(logisticsPlanNotifications.createdAt, periodTo));
    await db
      .update(logisticsPlanNotifications)
      .set({ isRead: true })
      .where(and(...conditions));
  }

  async getUnreadNotificationsCount(periodFrom?: string, periodTo?: string): Promise<number> {
    const conditions: any[] = [eq(logisticsPlanNotifications.isRead, false)];
    if (periodFrom) conditions.push(gte(logisticsPlanNotifications.periodFrom, periodFrom));
    if (periodTo) conditions.push(lte(logisticsPlanNotifications.periodTo, periodTo));
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(logisticsPlanNotifications)
      .where(and(...conditions));
    return result?.count ?? 0;
  }

  // ========== EXTRA DRIVERS ==========

  async getExtraDriversForUnit(transportUnitId: string): Promise<any[]> {
    return db
      .select()
      .from(logisticsUnitExtraDrivers)
      .where(
        and(
          eq(logisticsUnitExtraDrivers.transportUnitId, transportUnitId),
          isNull(logisticsUnitExtraDrivers.deletedAt),
        ),
      )
      .orderBy(asc(logisticsUnitExtraDrivers.createdAt));
  }

  async addExtraDriver(data: {
    transportUnitId: string;
    driverId: string;
    notes?: string | null;
    createdById?: string;
  }): Promise<any> {
    const [created] = await db
      .insert(logisticsUnitExtraDrivers)
      .values(data)
      .returning();
    return created;
  }

  async removeExtraDriver(id: string): Promise<boolean> {
    await db
      .update(logisticsUnitExtraDrivers)
      .set({ deletedAt: sql`NOW()` })
      .where(eq(logisticsUnitExtraDrivers.id, id));
    return true;
  }
}
