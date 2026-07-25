import type { Express } from "express";
import { storage } from "../../../storage/index";
import {
  insertLogisticsTransportUnitSchema,
  insertLogisticsDriverScheduleSchema,
  insertLogisticsVehicleAvailabilitySchema,
  insertLogisticsPlanRouteSchema,
  insertLogisticsPlanCommentSchema,
  insertLogisticsMonthlySyncSchema,
  planEntries,
  warehouses,
  bases,
} from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog, auditView } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";
import { db } from "server/db";
import { and, isNull, gte, lte, eq } from "drizzle-orm";

export function registerLogisticsPlanRoutes(app: Express) {

  // ============ TRANSPORT UNITS ============

  app.get(
    "/api/logistics-plan/transport-units",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { carrierId, periodFrom, periodTo } = req.query as Record<string, string | undefined>;
        const units = await storage.logisticsPlan.getAllTransportUnits({ carrierId, periodFrom, periodTo });

        // Enrich with related data
        const [carriers, vehicles, trailers, drivers] = await Promise.all([
          storage.logistics.getAllLogisticsCarriers(),
          storage.logistics.getAllLogisticsVehicles(),
          storage.logistics.getAllLogisticsTrailers(),
          storage.logistics.getAllLogisticsDrivers(),
        ]);

        // Get driver schedules and vehicle availabilities for period
        const [driverSchedules, vehicleAvailabilities] = await Promise.all([
          storage.logisticsPlan.getAllDriverSchedules({ dateFrom: periodFrom, dateTo: periodTo }),
          storage.logisticsPlan.getAllVehicleAvailabilities({ dateFrom: periodFrom, dateTo: periodTo }),
        ]);

        const enriched = units.map((unit) => {
          const carrier = carriers.find((c) => c.id === unit.carrierId);
          const vehicle = vehicles.find((v) => v.id === unit.vehicleId);
          const trailer = trailers.find((t) => t.id === unit.trailerId);
          const driver = drivers.find((d) => d.id === unit.driverId);

          const driverUnavailable = unit.driverId
            ? driverSchedules.some(
                (s) => s.driverId === unit.driverId && s.type !== "available"
              )
            : false;

          const vehicleUnavailable = unit.vehicleId
            ? vehicleAvailabilities.some((a) => a.vehicleId === unit.vehicleId)
            : false;

          const driverScheduleForPeriod = unit.driverId
            ? driverSchedules.filter((s) => s.driverId === unit.driverId)
            : [];

          const vehicleAvailabilityForPeriod = unit.vehicleId
            ? vehicleAvailabilities.filter((a) => a.vehicleId === unit.vehicleId)
            : [];

          return {
            ...unit,
            carrier,
            vehicle,
            trailer,
            driver,
            driverUnavailable,
            vehicleUnavailable,
            driverScheduleForPeriod,
            vehicleAvailabilityForPeriod,
          };
        });

        res.json(enriched);
      } catch (error) {
        res.status(500).json({ message: "Ошибка получения транспортных единиц" });
      }
    }
  );

  app.get(
    "/api/logistics-plan/transport-units/:id",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const unit = await storage.logisticsPlan.getTransportUnit(req.params.id);
        if (!unit) return res.status(404).json({ message: "Транспортная единица не найдена" });
        res.json(unit);
      } catch (error) {
        res.status(500).json({ message: "Ошибка получения транспортной единицы" });
      }
    }
  );

  app.post(
    "/api/logistics-plan/transport-units",
    requireAuth,
    requirePermission("planning", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_TRANSPORT_UNIT,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const data = insertLogisticsTransportUnitSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const unit = await storage.logisticsPlan.createTransportUnit(data);
        res.status(201).json(unit);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({ message: "Ошибка создания транспортной единицы" });
      }
    }
  );

  app.patch(
    "/api/logistics-plan/transport-units/:id",
    requireAuth,
    requirePermission("planning", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_TRANSPORT_UNIT,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => storage.logisticsPlan.getTransportUnit(req.params.id),
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const unit = await storage.logisticsPlan.updateTransportUnit(req.params.id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!unit) return res.status(404).json({ message: "Транспортная единица не найдена" });
        res.json(unit);
      } catch (error) {
        res.status(500).json({ message: "Ошибка обновления транспортной единицы" });
      }
    }
  );

  app.delete(
    "/api/logistics-plan/transport-units/:id",
    requireAuth,
    requirePermission("planning", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_TRANSPORT_UNIT,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => storage.logisticsPlan.getTransportUnit(req.params.id),
    }),
    async (req, res) => {
      try {
        await storage.logisticsPlan.deleteTransportUnit(req.params.id, req.session.userId);
        res.json({ message: "Транспортная единица удалена" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления транспортной единицы" });
      }
    }
  );

  // ============ DRIVER SCHEDULE ============

  app.get(
    "/api/logistics-plan/driver-schedule",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { driverId, dateFrom, dateTo } = req.query as Record<string, string | undefined>;
        const schedules = driverId
          ? await storage.logisticsPlan.getDriverSchedule(driverId)
          : await storage.logisticsPlan.getAllDriverSchedules({ dateFrom, dateTo });
        res.json(schedules);
      } catch (error) {
        res.status(500).json({ message: "Ошибка получения табеля водителей" });
      }
    }
  );

  app.post(
    "/api/logistics-plan/driver-schedule",
    requireAuth,
    requirePermission("planning", "edit"),
    async (req, res) => {
      try {
        const data = insertLogisticsDriverScheduleSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const schedule = await storage.logisticsPlan.createDriverSchedule(data);
        res.status(201).json(schedule);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({ message: "Ошибка создания записи табеля" });
      }
    }
  );

  app.patch(
    "/api/logistics-plan/driver-schedule/:id",
    requireAuth,
    requirePermission("planning", "edit"),
    async (req, res) => {
      try {
        const schedule = await storage.logisticsPlan.updateDriverSchedule(req.params.id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!schedule) return res.status(404).json({ message: "Запись табеля не найдена" });
        res.json(schedule);
      } catch (error) {
        res.status(500).json({ message: "Ошибка обновления записи табеля" });
      }
    }
  );

  app.delete(
    "/api/logistics-plan/driver-schedule/:id",
    requireAuth,
    requirePermission("planning", "edit"),
    async (req, res) => {
      try {
        await storage.logisticsPlan.deleteDriverSchedule(req.params.id, req.session.userId);
        res.json({ message: "Запись табеля удалена" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления записи табеля" });
      }
    }
  );

  // ============ VEHICLE AVAILABILITY ============

  app.get(
    "/api/logistics-plan/vehicle-availability",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { vehicleId, dateFrom, dateTo } = req.query as Record<string, string | undefined>;
        const availabilities = vehicleId
          ? await storage.logisticsPlan.getVehicleAvailability(vehicleId)
          : await storage.logisticsPlan.getAllVehicleAvailabilities({ dateFrom, dateTo });
        res.json(availabilities);
      } catch (error) {
        res.status(500).json({ message: "Ошибка получения доступности транспорта" });
      }
    }
  );

  app.post(
    "/api/logistics-plan/vehicle-availability",
    requireAuth,
    requirePermission("planning", "edit"),
    async (req, res) => {
      try {
        const data = insertLogisticsVehicleAvailabilitySchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const availability = await storage.logisticsPlan.createVehicleAvailability(data);
        res.status(201).json(availability);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({ message: "Ошибка создания записи доступности" });
      }
    }
  );

  app.patch(
    "/api/logistics-plan/vehicle-availability/:id",
    requireAuth,
    requirePermission("planning", "edit"),
    async (req, res) => {
      try {
        const availability = await storage.logisticsPlan.updateVehicleAvailability(req.params.id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!availability) return res.status(404).json({ message: "Запись доступности не найдена" });
        res.json(availability);
      } catch (error) {
        res.status(500).json({ message: "Ошибка обновления записи доступности" });
      }
    }
  );

  app.delete(
    "/api/logistics-plan/vehicle-availability/:id",
    requireAuth,
    requirePermission("planning", "edit"),
    async (req, res) => {
      try {
        await storage.logisticsPlan.deleteVehicleAvailability(req.params.id, req.session.userId);
        res.json({ message: "Запись доступности удалена" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления записи доступности" });
      }
    }
  );

  // ============ PLAN ROUTES ============

  app.get(
    "/api/logistics-plan/routes",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { periodFrom, periodTo, scenarioId, transportUnitId } = req.query as Record<string, string | undefined>;
        const routes = await storage.logisticsPlan.getPlanRoutes({ periodFrom, periodTo, scenarioId, transportUnitId });
        res.json(routes);
      } catch (error) {
        res.status(500).json({ message: "Ошибка получения маршрутов плана" });
      }
    }
  );

  app.get(
    "/api/logistics-plan/routes/unassigned",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { periodFrom, periodTo, scenarioId } = req.query as Record<string, string | undefined>;
        if (!periodFrom || !periodTo) {
          return res.status(400).json({ message: "Необходимо указать период" });
        }
        const unassigned = await storage.logisticsPlan.getUnassignedRoutes(periodFrom, periodTo, scenarioId);
        res.json(unassigned);
      } catch (error) {
        res.status(500).json({ message: "Ошибка получения нераспределённых маршрутов" });
      }
    }
  );

  app.get(
    "/api/logistics-plan/routes/:id",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const route = await storage.logisticsPlan.getPlanRoute(req.params.id);
        if (!route) return res.status(404).json({ message: "Маршрут не найден" });
        res.json(route);
      } catch (error) {
        res.status(500).json({ message: "Ошибка получения маршрута" });
      }
    }
  );

  app.post(
    "/api/logistics-plan/routes",
    requireAuth,
    requirePermission("planning", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_PLAN_ROUTE,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const data = insertLogisticsPlanRouteSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const route = await storage.logisticsPlan.createPlanRoute(data);
        res.status(201).json(route);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({ message: "Ошибка создания маршрута" });
      }
    }
  );

  app.patch(
    "/api/logistics-plan/routes/:id",
    requireAuth,
    requirePermission("planning", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_PLAN_ROUTE,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => storage.logisticsPlan.getPlanRoute(req.params.id),
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const route = await storage.logisticsPlan.updatePlanRoute(req.params.id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!route) return res.status(404).json({ message: "Маршрут не найден" });
        res.json(route);
      } catch (error) {
        res.status(500).json({ message: "Ошибка обновления маршрута" });
      }
    }
  );

  app.delete(
    "/api/logistics-plan/routes/:id",
    requireAuth,
    requirePermission("planning", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_PLAN_ROUTE,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => storage.logisticsPlan.getPlanRoute(req.params.id),
    }),
    async (req, res) => {
      try {
        await storage.logisticsPlan.deletePlanRoute(req.params.id, req.session.userId);
        res.json({ message: "Маршрут удалён" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления маршрута" });
      }
    }
  );

  // ============ PLAN COMMENTS ============

  app.get(
    "/api/logistics-plan/routes/:routeId/comments",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const comments = await storage.logisticsPlan.getRouteComments(req.params.routeId);
        res.json(comments);
      } catch (error) {
        res.status(500).json({ message: "Ошибка получения комментариев" });
      }
    }
  );

  app.post(
    "/api/logistics-plan/routes/:routeId/comments",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const data = insertLogisticsPlanCommentSchema.parse({
          ...req.body,
          routeId: req.params.routeId,
          createdById: req.session.userId,
        });
        const comment = await storage.logisticsPlan.createRouteComment(data);
        res.status(201).json(comment);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({ message: "Ошибка создания комментария" });
      }
    }
  );

  app.delete(
    "/api/logistics-plan/routes/:routeId/comments/:id",
    requireAuth,
    requirePermission("planning", "edit"),
    async (req, res) => {
      try {
        await storage.logisticsPlan.deleteRouteComment(req.params.id, req.session.userId);
        res.json({ message: "Комментарий удалён" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления комментария" });
      }
    }
  );

  app.post(
    "/api/logistics-plan/routes/:routeId/comments/mark-read",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        await storage.logisticsPlan.markCommentsRead(req.params.routeId);
        res.json({ message: "Комментарии отмечены прочитанными" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка обновления статуса комментариев" });
      }
    }
  );

  // ============ MONTHLY SYNC ============

  app.get(
    "/api/logistics-plan/sync",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { periodFrom, periodTo, scenarioId } = req.query as Record<string, string | undefined>;
        const syncs = await storage.logisticsPlan.getActiveSyncs(periodFrom, periodTo);
        const latest = await storage.logisticsPlan.getLatestSync(scenarioId);
        res.json({ syncs, latest });
      } catch (error) {
        res.status(500).json({ message: "Ошибка получения синхронизации" });
      }
    }
  );

  // Check sync status for a specific period+scenario combination
  app.get(
    "/api/logistics-plan/sync/status",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { periodFrom, periodTo, scenarioId } = req.query as Record<string, string | undefined>;
        if (!periodFrom || !periodTo) {
          return res.status(400).json({ message: "periodFrom и periodTo обязательны" });
        }
        const sync = await storage.logisticsPlan.getSyncByPeriodAndScenario(
          periodFrom,
          periodTo,
          scenarioId || null,
        );
        res.json({ isActive: !!sync, sync: sync || null });
      } catch (error) {
        res.status(500).json({ message: "Ошибка получения статуса синхронизации" });
      }
    }
  );

  app.post(
    "/api/logistics-plan/sync",
    requireAuth,
    requirePermission("planning", "edit"),
    async (req, res) => {
      try {
        const { scenarioId, periodFrom, periodTo } = req.body as {
          scenarioId?: string;
          periodFrom: string;
          periodTo: string;
        };

        // Fetch current plan_entries (пятидневки) as snapshot — excludes top-level volumes
        const conditions: any[] = [isNull(planEntries.deletedAt)];
        if (periodFrom) conditions.push(gte(planEntries.date, periodFrom));
        if (periodTo) conditions.push(lte(planEntries.date, periodTo));
        if (scenarioId) conditions.push(eq(planEntries.scenarioId, scenarioId));

        const entries = await db.select().from(planEntries).where(and(...conditions));

        // Check if active sync already exists for this month+scenario — update instead of create
        const existingSync = await storage.logisticsPlan.getSyncByPeriodAndScenario(
          periodFrom,
          periodTo,
          scenarioId || null,
        );

        let sync: any;
        if (existingSync) {
          // Re-sync: update snapshot and add notification
          sync = await storage.logisticsPlan.updateSync(existingSync.id, {
            snapshotData: entries as any,
            periodFrom,
            periodTo,
          });
          await storage.logisticsPlan.createNotification({
            syncId: existingSync.id,
            type: "change",
            message: `План пересинхронизирован. Период: ${periodFrom?.slice(0, 10)} — ${periodTo?.slice(0, 10)}. Записей: ${entries.length}`,
            periodFrom,
            periodTo,
          });
        } else {
          // First sync for this month+scenario
          sync = await storage.logisticsPlan.createSync({
            scenarioId: scenarioId || null,
            periodFrom,
            periodTo,
            status: "active",
            snapshotData: entries as any,
            createdById: req.session.userId,
          });
          await storage.logisticsPlan.createNotification({
            syncId: sync.id,
            type: "change",
            message: `План запущен в логистику. Период: ${periodFrom?.slice(0, 10)} — ${periodTo?.slice(0, 10)}. Записей: ${entries.length}`,
            periodFrom,
            periodTo,
          });
        }

        res.status(existingSync ? 200 : 201).json(sync);
      } catch (error) {
        res.status(500).json({ message: "Ошибка запуска синхронизации" });
      }
    }
  );

  // ============ NOTIFICATIONS ============

  app.get(
    "/api/logistics-plan/notifications",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { periodFrom, periodTo } = req.query as Record<string, string | undefined>;
        const [notifications, unreadCount] = await Promise.all([
          storage.logisticsPlan.getNotifications({ periodFrom, periodTo }),
          storage.logisticsPlan.getUnreadNotificationsCount(periodFrom, periodTo),
        ]);
        res.json({ notifications, unreadCount });
      } catch (error) {
        res.status(500).json({ message: "Ошибка получения уведомлений" });
      }
    }
  );

  app.patch(
    "/api/logistics-plan/notifications/:id/read",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        await storage.logisticsPlan.markNotificationRead(req.params.id);
        res.json({ message: "Уведомление прочитано" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка обновления уведомления" });
      }
    }
  );

  app.post(
    "/api/logistics-plan/notifications/mark-all-read",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { periodFrom, periodTo } = req.body as { periodFrom?: string; periodTo?: string };
        await storage.logisticsPlan.markAllNotificationsRead(periodFrom, periodTo);
        res.json({ message: "Все уведомления отмечены прочитанными" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка обновления уведомлений" });
      }
    }
  );

  // ============ PLAN DATA AGGREGATION (for calendar view) ============

  app.get(
    "/api/logistics-plan/calendar",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { periodFrom, periodTo, scenarioId } = req.query as Record<string, string | undefined>;
        if (!periodFrom || !periodTo) {
          return res.status(400).json({ message: "Необходимо указать период" });
        }

        const [routes, transportUnits, notifications] = await Promise.all([
          storage.logisticsPlan.getPlanRoutes({ periodFrom, periodTo, scenarioId }),
          storage.logisticsPlan.getAllTransportUnits({ periodFrom, periodTo }),
          storage.logisticsPlan.getNotifications({ periodFrom, periodTo }),
        ]);

        const unreadCount = notifications.filter((n) => !n.isRead).length;

        res.json({
          routes,
          transportUnits,
          notifications: notifications.slice(0, 50),
          unreadCount,
        });
      } catch (error) {
        res.status(500).json({ message: "Ошибка получения данных календаря" });
      }
    }
  );

  // ============ SOURCE PLAN ENTRIES for logistics ============

  app.get(
    "/api/logistics-plan/source-entries",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { periodFrom, periodTo, scenarioId } = req.query as Record<string, string | undefined>;
        if (!periodFrom || !periodTo) {
          return res.status(400).json({ message: "Необходимо указать период" });
        }

        const conditions: any[] = [isNull(planEntries.deletedAt)];
        if (periodFrom) conditions.push(gte(planEntries.date, periodFrom));
        if (periodTo) conditions.push(lte(planEntries.date, periodTo));
        if (scenarioId) conditions.push(eq(planEntries.scenarioId, scenarioId));

        const entries = await db.select().from(planEntries).where(and(...conditions));

        // Enrich with warehouse info
        const allWarehouses = await storage.warehouses.getAllWarehouses();
        const allBases = await storage.bases.getAllBases();

        const enriched = entries.map((entry) => ({
          ...entry,
          warehouse: allWarehouses.find((w) => w.id === entry.warehouseId),
          basis: allBases.find((b) => b.id === entry.basisId),
        }));

        res.json(enriched);
      } catch (error) {
        res.status(500).json({ message: "Ошибка получения плановых записей" });
      }
    }
  );
}
