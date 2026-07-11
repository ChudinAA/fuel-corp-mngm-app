import type { Express } from "express";
import { z } from "zod";
import { storage } from "../../../storage/index";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";
import {
  insertPlanEntrySchema,
  insertFreeVolumeAllocationSchema,
  insertSupplierAllocatedVolumeSchema,
  insertPlanningResourceSchema,
  insertPlanningCommentSchema,
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
    auditLog({
      entityType: ENTITY_TYPES.PLAN_ENTRY,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
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
    auditLog({
      entityType: ENTITY_TYPES.PLAN_ENTRY,
      operation: AUDIT_OPERATIONS.UPDATE,
      getEntityId: (req) => req.params.id,
      getOldData: async (req) => storage.planning.getPlanEntry(req.params.id),
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        // Check global lock setting
        const settings = await storage.planning.getPlanningSettings();
        const lockEnabled = settings["editLockEnabled"] === "true";
        if (lockEnabled) {
          const entry = await storage.planning.getPlanEntry(req.params.id);
          if (entry) {
            const entryDate = new Date(entry.date);
            const now = new Date();
            const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            if (entryDate < curMonthStart) {
              return res.status(403).json({ message: "Редактирование записей прошлых месяцев заблокировано" });
            }
          }
        }
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
    auditLog({
      entityType: ENTITY_TYPES.PLAN_ENTRY,
      operation: AUDIT_OPERATIONS.DELETE,
      getEntityId: (req) => req.params.id,
      getOldData: async (req) => storage.planning.getPlanEntry(req.params.id),
    }),
    async (req, res) => {
      try {
        // Check global lock setting
        const settings = await storage.planning.getPlanningSettings();
        const lockEnabled = settings["editLockEnabled"] === "true";
        if (lockEnabled) {
          const entry = await storage.planning.getPlanEntry(req.params.id);
          if (entry) {
            const entryDate = new Date(entry.date);
            const now = new Date();
            const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            if (entryDate < curMonthStart) {
              return res.status(403).json({ message: "Удаление записей прошлых месяцев заблокировано" });
            }
          }
        }
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
    auditLog({
      entityType: ENTITY_TYPES.FREE_VOLUME_ALLOCATION,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
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
    auditLog({
      entityType: ENTITY_TYPES.FREE_VOLUME_ALLOCATION,
      operation: AUDIT_OPERATIONS.UPDATE,
      getEntityId: (req) => req.params.id,
      getOldData: async (req) => {
        const rows = await storage.planning.getFreeVolumeAllocations("", "", "");
        return rows.find((r: any) => r.id === req.params.id);
      },
      getNewData: (req) => req.body,
    }),
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
    auditLog({
      entityType: ENTITY_TYPES.FREE_VOLUME_ALLOCATION,
      operation: AUDIT_OPERATIONS.DELETE,
      getEntityId: (req) => req.params.id,
    }),
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

  app.get(
    "/api/planning/allocated-volumes/by-supplier/:supplierId",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const volumes = await storage.planning.getSupplierAllocatedVolumesBySupplier(req.params.supplierId);
        res.json(volumes);
      } catch (error: any) {
        console.error("Error fetching allocated volumes by supplier:", error);
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

  // ---- Planning resources ----
  app.get(
    "/api/planning/resources",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const resources = await storage.planning.getPlanningResources();
        res.json(resources);
      } catch (error: any) {
        console.error("Error fetching planning resources:", error);
        res.status(500).json({ message: "Ошибка получения ресурсов" });
      }
    },
  );

  app.post(
    "/api/planning/resources",
    requireAuth,
    requirePermission("planning", "allocate"),
    async (req, res) => {
      try {
        const data = insertPlanningResourceSchema.parse({
          ...req.body,
          createdById: String(req.session.userId),
        });
        const created = await storage.planning.createPlanningResource(data);
        res.status(201).json(created);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Error creating planning resource:", error);
        res.status(500).json({ message: "Ошибка создания ресурса" });
      }
    },
  );

  app.patch(
    "/api/planning/resources/:id",
    requireAuth,
    requirePermission("planning", "allocate"),
    async (req, res) => {
      try {
        const updated = await storage.planning.updatePlanningResource(
          req.params.id,
          req.body,
          String(req.session.userId),
        );
        if (!updated) return res.status(404).json({ message: "Ресурс не найден" });
        res.json(updated);
      } catch (error: any) {
        console.error("Error updating planning resource:", error);
        res.status(500).json({ message: "Ошибка обновления ресурса" });
      }
    },
  );

  app.delete(
    "/api/planning/resources/:id",
    requireAuth,
    requirePermission("planning", "allocate"),
    async (req, res) => {
      try {
        await storage.planning.deletePlanningResource(req.params.id, String(req.session.userId));
        res.json({ message: "Ресурс удалён" });
      } catch (error: any) {
        console.error("Error deleting planning resource:", error);
        res.status(500).json({ message: "Ошибка удаления ресурса" });
      }
    },
  );

  // ---- Planning settings ----
  app.get(
    "/api/planning/settings",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const settings = await storage.planning.getPlanningSettings();
        res.json(settings);
      } catch (error: any) {
        console.error("Error fetching planning settings:", error);
        res.status(500).json({ message: "Ошибка получения настроек" });
      }
    },
  );

  app.patch(
    "/api/planning/settings",
    requireAuth,
    requirePermission("planning", "allocate"),
    async (req, res) => {
      try {
        const { key, value } = req.body;
        if (!key || value === undefined) {
          return res.status(400).json({ message: "key и value обязательны" });
        }
        await storage.planning.upsertPlanningSetting(key, String(value), String(req.session.userId));
        res.json({ message: "Настройка сохранена" });
      } catch (error: any) {
        console.error("Error updating planning setting:", error);
        res.status(500).json({ message: "Ошибка сохранения настройки" });
      }
    },
  );

  // ---- Planning comments ----
  app.get(
    "/api/planning/comments",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { entityType, entityId, fieldKey } = req.query as Record<string, string>;
        if (!entityType || !entityId || !fieldKey) {
          return res.status(400).json({ message: "entityType, entityId и fieldKey обязательны" });
        }
        const comments = await storage.planning.getPlanningComments(entityType, entityId, fieldKey);
        res.json(comments);
      } catch (error: any) {
        console.error("Error fetching planning comments:", error);
        res.status(500).json({ message: "Ошибка получения комментариев" });
      }
    },
  );

  app.post(
    "/api/planning/comments",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const data = insertPlanningCommentSchema.parse({
          ...req.body,
          userId: String(req.session.userId),
        });
        const created = await storage.planning.createPlanningComment(data);
        res.status(201).json(created);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Error creating planning comment:", error);
        res.status(500).json({ message: "Ошибка создания комментария" });
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
