import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertAircraftRefuelingSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog, auditView } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";

export function registerRefuelingOperationsRoutes(app: Express) {
  app.get(
    "/api/refueling",
    requireAuth,
    requirePermission("refueling", "view"),
    async (req, res) => {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const search = req.query.search as string | undefined;
      const result = await storage.aircraftRefueling.getRefuelings(
        page,
        pageSize,
        search
      );
      res.json(result);
    }
  );

  app.get(
    "/api/refueling/contract-used/:priceId",
    requireAuth,
    requirePermission("refueling", "view"),
    async (req, res) => {
      try {
        const { priceId } = req.params;
        const usedVolume = await storage.aircraftRefueling.getUsedVolumeByPrice(priceId);
        res.json({ usedVolume });
      } catch (error) {
        console.error("Error getting used volume:", error);
        res.status(500).json({ message: "Ошибка получения использованного объема" });
      }
    }
  );

  app.get(
    "/api/refueling/:id",
    requireAuth,
    requirePermission("refueling", "view"),
    auditView(ENTITY_TYPES.AIRCRAFT_REFUELING),
    async (req, res) => {
      const id = req.params.id;
      const item = await storage.aircraftRefueling.getRefueling(id);
      if (!item) {
        return res.status(404).json({ message: "Заправка не найдена" });
      }
      res.json(item);
    }
  );

  app.post(
    "/api/refueling/check-duplicate",
    requireAuth,
    async (req, res) => {
      try {
        const isDuplicate = await storage.aircraftRefueling.checkDuplicate(req.body);
        res.json({ isDuplicate });
      } catch (error) {
        console.error("Error checking duplicate refueling:", error);
        res.status(500).json({ message: "Ошибка проверки дубликата" });
      }
    }
  );

  app.post(
    "/api/refueling",
    requireAuth,
    requirePermission("refueling", "create"),
    auditLog({
      entityType: ENTITY_TYPES.AIRCRAFT_REFUELING,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const data = insertAircraftRefuelingSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const item = await storage.aircraftRefueling.createRefueling(data);
        res.status(201).json(item);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({ message: "Ошибка создания заправки" });
      }
    }
  );

  app.patch(
    "/api/refueling/:id",
    requireAuth,
    requirePermission("refueling", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.AIRCRAFT_REFUELING,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        const item = await storage.aircraftRefueling.getRefueling(req.params.id);
        return item;
      },
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        const item = await storage.aircraftRefueling.updateRefueling(id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!item) {
          return res.status(404).json({ message: "Заправка не найдена" });
        }
        res.json(item);
      } catch (error) {
        res.status(500).json({ message: "Ошибка обновления заправки" });
      }
    }
  );

  app.delete(
    "/api/refueling/:id",
    requireAuth,
    requirePermission("refueling", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.AIRCRAFT_REFUELING,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        const item = await storage.aircraftRefueling.getRefueling(req.params.id);
        return item;
      },
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.aircraftRefueling.deleteRefueling(id, req.session.userId);
        res.json({ message: "Заправка удалена" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления заправки" });
      }
    }
  );
}
