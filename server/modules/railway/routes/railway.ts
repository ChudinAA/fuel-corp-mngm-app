import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertRailwayStationSchema, insertRailwayTariffSchema } from "../entities/railway";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";

export function registerRailwayRoutes(app: Express) {
  // ============ RAILWAY STATIONS ============

  app.get(
    "/api/railway/stations",
    requireAuth,
    requirePermission("directories", "view"),
    async (req, res) => {
      try {
        const search = req.query.search as string | undefined;
        const data = await storage.railway.getAllStations(search);
        res.json(data);
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка получения ЖД станций" });
      }
    },
  );

  app.get(
    "/api/railway/stations/:id",
    requireAuth,
    requirePermission("directories", "view"),
    async (req, res) => {
      try {
        const station = await storage.railway.getStation(req.params.id);
        if (!station) return res.status(404).json({ message: "Станция не найдена" });
        res.json(station);
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка получения станции" });
      }
    },
  );

  app.post(
    "/api/railway/stations",
    requireAuth,
    requirePermission("directories", "create"),
    auditLog({
      entityType: ENTITY_TYPES.RAILWAY_STATION,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const data = insertRailwayStationSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const station = await storage.railway.createStation(data);
        res.status(201).json(station);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({ message: "Ошибка создания ЖД станции" });
      }
    },
  );

  app.patch(
    "/api/railway/stations/:id",
    requireAuth,
    requirePermission("directories", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.RAILWAY_STATION,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => storage.railway.getStation(req.params.id),
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const station = await storage.railway.updateStation(
          req.params.id,
          req.body,
          req.session.userId,
        );
        if (!station) return res.status(404).json({ message: "Станция не найдена" });
        res.json(station);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({ message: "Ошибка обновления ЖД станции" });
      }
    },
  );

  app.delete(
    "/api/railway/stations/:id",
    requireAuth,
    requirePermission("directories", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.RAILWAY_STATION,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => storage.railway.getStation(req.params.id),
    }),
    async (req, res) => {
      try {
        const success = await storage.railway.deleteStation(req.params.id, req.session.userId);
        if (!success) return res.status(404).json({ message: "Станция не найдена" });
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка удаления ЖД станции" });
      }
    },
  );

  // ============ RAILWAY TARIFFS ============

  app.get(
    "/api/railway/tariffs",
    requireAuth,
    requirePermission("directories", "view"),
    async (req, res) => {
      try {
        const search = req.query.search as string | undefined;
        const data = await storage.railway.getAllTariffs(search);
        res.json(data);
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка получения тарифов ЖД" });
      }
    },
  );

  app.get(
    "/api/railway/tariffs/:id",
    requireAuth,
    requirePermission("directories", "view"),
    async (req, res) => {
      try {
        const tariff = await storage.railway.getTariff(req.params.id);
        if (!tariff) return res.status(404).json({ message: "Тариф не найден" });
        res.json(tariff);
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка получения тарифа" });
      }
    },
  );

  app.post(
    "/api/railway/tariffs",
    requireAuth,
    requirePermission("directories", "create"),
    auditLog({
      entityType: ENTITY_TYPES.RAILWAY_TARIFF,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const data = insertRailwayTariffSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const tariff = await storage.railway.createTariff(data);
        res.status(201).json(tariff);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({ message: "Ошибка создания тарифа ЖД" });
      }
    },
  );

  app.patch(
    "/api/railway/tariffs/:id",
    requireAuth,
    requirePermission("directories", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.RAILWAY_TARIFF,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => storage.railway.getTariff(req.params.id),
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const tariff = await storage.railway.updateTariff(
          req.params.id,
          req.body,
          req.session.userId,
        );
        if (!tariff) return res.status(404).json({ message: "Тариф не найден" });
        res.json(tariff);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({ message: "Ошибка обновления тарифа ЖД" });
      }
    },
  );

  app.delete(
    "/api/railway/tariffs/:id",
    requireAuth,
    requirePermission("directories", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.RAILWAY_TARIFF,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => storage.railway.getTariff(req.params.id),
    }),
    async (req, res) => {
      try {
        const success = await storage.railway.deleteTariff(req.params.id, req.session.userId);
        if (!success) return res.status(404).json({ message: "Тариф не найден" });
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка удаления тарифа ЖД" });
      }
    },
  );
}
