import type { Express } from "express";
import { z } from "zod";
import { storage } from "../../../storage/index";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import {
  insertPlanEntrySchema,
  insertFreeVolumeAllocationSchema,
  insertSupplierAllocatedVolumeSchema,
} from "@shared/schema";

export function registerPlanningRoutes(app: Express) {
  // ---- Plan entries ----
  app.get(
    "/api/planning/entries",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { warehouseId, dateFrom, dateTo } = req.query as Record<string, string>;
        if (!warehouseId || !dateFrom || !dateTo) {
          return res.status(400).json({ message: "warehouseId, dateFrom и dateTo обязательны" });
        }
        const entries = await storage.planning.getPlanEntries(warehouseId, dateFrom, dateTo);
        res.json(entries);
      } catch (error: any) {
        console.error("Error fetching plan entries:", error);
        res.status(500).json({ message: "Ошибка получения плановых записей" });
      }
    },
  );

  app.post(
    "/api/planning/entries",
    requireAuth,
    requirePermission("planning", "create"),
    async (req, res) => {
      try {
        const data = insertPlanEntrySchema.parse({
          ...req.body,
          createdById: String(req.session.userId),
        });
        const created = await storage.planning.createPlanEntry(data);
        res.status(201).json(created);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Error creating plan entry:", error);
        res.status(500).json({ message: "Ошибка создания плановой записи" });
      }
    },
  );

  app.patch(
    "/api/planning/entries/:id",
    requireAuth,
    requirePermission("planning", "edit"),
    async (req, res) => {
      try {
        const updated = await storage.planning.updatePlanEntry(
          req.params.id,
          { ...req.body, updatedById: String(req.session.userId) },
          String(req.session.userId),
        );
        if (!updated) {
          return res.status(404).json({ message: "Запись не найдена" });
        }
        res.json(updated);
      } catch (error: any) {
        console.error("Error updating plan entry:", error);
        res.status(400).json({ message: error.message || "Ошибка обновления записи" });
      }
    },
  );

  app.delete(
    "/api/planning/entries/:id",
    requireAuth,
    requirePermission("planning", "delete"),
    async (req, res) => {
      try {
        await storage.planning.deletePlanEntry(req.params.id, String(req.session.userId));
        res.json({ message: "Запись удалена" });
      } catch (error: any) {
        console.error("Error deleting plan entry:", error);
        res.status(400).json({ message: error.message || "Ошибка удаления записи" });
      }
    },
  );

  // ---- Free volume allocations ----
  app.get(
    "/api/planning/allocations",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { warehouseId, dateFrom, dateTo } = req.query as Record<string, string>;
        if (!warehouseId || !dateFrom || !dateTo) {
          return res.status(400).json({ message: "warehouseId, dateFrom и dateTo обязательны" });
        }
        const allocations = await storage.planning.getFreeVolumeAllocations(
          warehouseId,
          dateFrom,
          dateTo,
        );
        res.json(allocations);
      } catch (error: any) {
        console.error("Error fetching allocations:", error);
        res.status(500).json({ message: "Ошибка получения распределений" });
      }
    },
  );

  app.post(
    "/api/planning/allocations",
    requireAuth,
    requirePermission("planning", "create"),
    async (req, res) => {
      try {
        const data = insertFreeVolumeAllocationSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const created = await storage.planning.createFreeVolumeAllocation(data);
        res.status(201).json(created);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Error creating allocation:", error);
        res.status(500).json({ message: "Ошибка создания распределения" });
      }
    },
  );

  app.patch(
    "/api/planning/allocations/:id",
    requireAuth,
    requirePermission("planning", "edit"),
    async (req, res) => {
      try {
        const updated = await storage.planning.updateFreeVolumeAllocation(
          req.params.id,
          req.body,
          String(req.session.userId),
        );
        if (!updated) return res.status(404).json({ message: "Запись не найдена" });
        res.json(updated);
      } catch (error: any) {
        console.error("Error updating allocation:", error);
        res.status(500).json({ message: "Ошибка обновления распределения" });
      }
    },
  );

  app.delete(
    "/api/planning/allocations/:id",
    requireAuth,
    requirePermission("planning", "delete"),
    async (req, res) => {
      try {
        await storage.planning.deleteFreeVolumeAllocation(req.params.id, String(req.session.userId));
        res.json({ message: "Запись удалена" });
      } catch (error: any) {
        console.error("Error deleting allocation:", error);
        res.status(500).json({ message: "Ошибка удаления распределения" });
      }
    },
  );

  // ---- Supplier allocated volumes ----
  app.get(
    "/api/planning/allocated-volumes",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { periodFrom, periodTo } = req.query as Record<string, string>;
        if (!periodFrom || !periodTo) {
          return res.status(400).json({ message: "periodFrom и periodTo обязательны" });
        }
        const volumes = await storage.planning.getSupplierAllocatedVolumes(periodFrom, periodTo);
        res.json(volumes);
      } catch (error: any) {
        console.error("Error fetching allocated volumes:", error);
        res.status(500).json({ message: "Ошибка получения выделенных объемов" });
      }
    },
  );

  app.post(
    "/api/planning/allocated-volumes",
    requireAuth,
    requirePermission("planning", "allocate"),
    async (req, res) => {
      try {
        const data = insertSupplierAllocatedVolumeSchema.parse({
          ...req.body,
          createdById: String(req.session.userId),
        });
        const result = await storage.planning.upsertSupplierAllocatedVolume(data);
        res.status(201).json(result);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Error upserting allocated volume:", error);
        res.status(500).json({ message: "Ошибка сохранения выделенного объема" });
      }
    },
  );

  // ---- Actuals ----
  app.get(
    "/api/planning/actuals",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { warehouseId, dateFrom, dateTo } = req.query as Record<string, string>;
        if (!warehouseId || !dateFrom || !dateTo) {
          return res.status(400).json({ message: "warehouseId, dateFrom и dateTo обязательны" });
        }
        const actuals = await storage.planning.getActuals(warehouseId, dateFrom, dateTo);
        res.json(actuals);
      } catch (error: any) {
        console.error("Error fetching actuals:", error);
        res.status(500).json({ message: "Ошибка получения фактических данных" });
      }
    },
  );

  // ---- Summaries ----
  app.get(
    "/api/planning/summary/resources",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { periodFrom, periodTo } = req.query as Record<string, string>;
        if (!periodFrom || !periodTo) {
          return res.status(400).json({ message: "periodFrom и periodTo обязательны" });
        }
        const summary = await storage.planning.getResourcesSummary(periodFrom, periodTo);
        res.json(summary);
      } catch (error: any) {
        console.error("Error fetching resources summary:", error);
        res.status(500).json({ message: "Ошибка получения сводки по ресурсам" });
      }
    },
  );

  app.get(
    "/api/planning/summary/warehouses",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { periodFrom, periodTo } = req.query as Record<string, string>;
        if (!periodFrom || !periodTo) {
          return res.status(400).json({ message: "periodFrom и periodTo обязательны" });
        }
        const summary = await storage.planning.getWarehousesSummary(periodFrom, periodTo);
        res.json(summary);
      } catch (error: any) {
        console.error("Error fetching warehouses summary:", error);
        res.status(500).json({ message: "Ошибка получения сводки по складам" });
      }
    },
  );

  app.get(
    "/api/planning/summary/customers",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { periodFrom, periodTo } = req.query as Record<string, string>;
        if (!periodFrom || !periodTo) {
          return res.status(400).json({ message: "periodFrom и periodTo обязательны" });
        }
        const summary = await storage.planning.getCustomersSummary(periodFrom, periodTo);
        res.json(summary);
      } catch (error: any) {
        console.error("Error fetching customers summary:", error);
        res.status(500).json({ message: "Ошибка получения сводки по клиентам" });
      }
    },
  );
}
