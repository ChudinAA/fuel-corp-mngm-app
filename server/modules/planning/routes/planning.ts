import type { Express } from "express";
import { z } from "zod";
import { eq, and, isNull, gte, lte } from "drizzle-orm";
import { storage } from "../../../storage/index";
import { db } from "server/db";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";
import {
  insertPlanEntrySchema,
  insertFreeVolumeAllocationSchema,
  insertSupplierAllocatedVolumeSchema,
  insertPlanningResourceSchema,
  insertPlanningCommentSchema,
  insertPlanningScenarioSchema,
  insertPlanningTopLevelVolumeSchema,
  insertWarehouseSupplyTagSchema,
  supplierBases,
  bases,
  planEntries,
} from "@shared/schema";

// Auto-sync helper: if an active sync exists for the same month+scenario, refresh it
async function autoResyncIfNeeded(entryDate: string, scenarioId?: string | null) {
  try {
    const d = new Date(entryDate);
    const periodFrom = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    const periodTo = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);

    const existingSync = await storage.logisticsPlan.getSyncByPeriodAndScenario(
      periodFrom,
      periodTo,
      scenarioId || null,
    );
    if (!existingSync) return;

    // Refresh snapshot
    const conditions: any[] = [isNull(planEntries.deletedAt), gte(planEntries.date, periodFrom), lte(planEntries.date, periodTo)];
    if (scenarioId) conditions.push(eq(planEntries.scenarioId, scenarioId));
    const entries = await db.select().from(planEntries).where(and(...conditions));

    await storage.logisticsPlan.updateSync(existingSync.id, {
      snapshotData: entries as any,
      periodFrom,
      periodTo,
    });
    await storage.logisticsPlan.createNotification({
      syncId: existingSync.id,
      type: "change",
      message: `Автосинхронизация: план обновлён. Период: ${periodFrom} — ${periodTo}. Записей: ${entries.length}`,
      periodFrom,
      periodTo,
    });
  } catch (e) {
    // Auto-sync is best-effort — don't break the main request
    console.error("Auto-sync failed:", e);
  }
}

export function registerPlanningRoutes(app: Express) {
  // ---- Plan entries ----
  app.get(
    "/api/planning/entries",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { warehouseId, dateFrom, dateTo, scenarioId } = req.query as Record<string, string>;
        if (!warehouseId || !dateFrom || !dateTo) {
          return res.status(400).json({ message: "warehouseId, dateFrom и dateTo обязательны" });
        }
        const entries = await storage.planning.getPlanEntries(
          warehouseId,
          dateFrom,
          dateTo,
          scenarioId || null,
        );
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
        const body = req.body;
        const data = insertPlanEntrySchema.parse({
          ...body,
          counterpartyId: body.counterpartyId || undefined,
          basisId: body.basisId || undefined,
          scenarioId: body.scenarioId || undefined,
          createdById: String(req.session.userId),
        });
        const created = await storage.planning.createPlanEntry(data);
        res.status(201).json(created);
        // Auto-resync if this period is already active in logistics
        autoResyncIfNeeded(created.date, created.scenarioId || undefined).catch(() => {});
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
        // Fetch pre-update state for cross-scope resync detection
        const entryBeforeUpdate = await storage.planning.getPlanEntry(req.params.id);
        const body = req.body;
        const sanitized = {
          ...body,
          counterpartyId: body.counterpartyId || null,
          basisId: body.basisId || null,
          updatedById: String(req.session.userId),
        };
        const updated = await storage.planning.updatePlanEntry(
          req.params.id,
          sanitized,
          String(req.session.userId),
        );
        if (!updated) {
          return res.status(404).json({ message: "Запись не найдена" });
        }
        res.json(updated);
        // Auto-resync: trigger for both old and new (month, scenario) scopes.
        // If date or scenario changed, the old scope's snapshot also becomes stale.
        const oldDate = entryBeforeUpdate?.date;
        const oldScenario = entryBeforeUpdate?.scenarioId || undefined;
        const newDate = updated.date;
        const newScenario = updated.scenarioId || undefined;
        const toMonth = (d: string) => d.slice(0, 7); // "yyyy-mm"
        const oldScope = `${toMonth(oldDate ?? newDate)}|${oldScenario ?? ""}`;
        const newScope = `${toMonth(newDate)}|${newScenario ?? ""}`;
        autoResyncIfNeeded(newDate, newScenario).catch(() => {});
        if (oldDate && oldScope !== newScope) {
          autoResyncIfNeeded(oldDate, oldScenario).catch(() => {});
        }
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
        // Fetch entry before delete for auto-sync
        const entryBeforeDelete = await storage.planning.getPlanEntry(req.params.id);
        await storage.planning.deletePlanEntry(req.params.id, String(req.session.userId));
        res.json({ message: "Запись удалена" });
        // Auto-resync if this period is already active in logistics
        if (entryBeforeDelete) {
          autoResyncIfNeeded(entryBeforeDelete.date, entryBeforeDelete.scenarioId || undefined).catch(() => {});
        }
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

  // ---- Supplier bases lookup ----
  app.get(
    "/api/planning/supplier-bases/:supplierId",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { supplierId } = req.params;
        const rows = await db
          .select({ id: bases.id, name: bases.name, iataCode: (bases as any).iataCode })
          .from(supplierBases)
          .innerJoin(bases, eq(supplierBases.baseId, bases.id))
          .where(eq(supplierBases.supplierId, supplierId));
        res.json(rows);
      } catch (error: any) {
        console.error("Error fetching supplier bases:", error);
        res.status(500).json({ message: "Ошибка получения баз поставщика" });
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

  app.patch(
    "/api/planning/comments/:id",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const userId = String(req.session.userId);
        const { text, isHighPriority } = req.body as { text?: string; isHighPriority?: boolean };
        const updated = await storage.planning.updatePlanningComment(id, userId, {
          ...(text !== undefined ? { text } : {}),
          ...(isHighPriority !== undefined ? { isHighPriority } : {}),
        });
        if (!updated) {
          return res.status(403).json({ message: "Комментарий не найден или нет прав на редактирование" });
        }
        res.json(updated);
      } catch (error: any) {
        console.error("Error updating planning comment:", error);
        res.status(500).json({ message: "Ошибка обновления комментария" });
      }
    },
  );

  app.delete(
    "/api/planning/comments/:id",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const userId = String(req.session.userId);
        const deleted = await storage.planning.deletePlanningComment(id, userId);
        if (!deleted) {
          return res.status(403).json({ message: "Комментарий не найден или нет прав на удаление" });
        }
        res.json({ ok: true });
      } catch (error: any) {
        console.error("Error deleting planning comment:", error);
        res.status(500).json({ message: "Ошибка удаления комментария" });
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
        const { periodFrom, periodTo, scenarioId } = req.query as Record<string, string>;
        if (!periodFrom || !periodTo) {
          return res.status(400).json({ message: "periodFrom и periodTo обязательны" });
        }
        const summary = await storage.planning.getResourcesSummary(periodFrom, periodTo, scenarioId || null);
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
        const { periodFrom, periodTo, scenarioId } = req.query as Record<string, string>;
        if (!periodFrom || !periodTo) {
          return res.status(400).json({ message: "periodFrom и periodTo обязательны" });
        }
        const summary = await storage.planning.getWarehousesSummary(periodFrom, periodTo, scenarioId || null);
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
        const { periodFrom, periodTo, scenarioId } = req.query as Record<string, string>;
        if (!periodFrom || !periodTo) {
          return res.status(400).json({ message: "periodFrom и periodTo обязательны" });
        }
        const summary = await storage.planning.getCustomersSummary(periodFrom, periodTo, scenarioId || null);
        res.json(summary);
      } catch (error: any) {
        console.error("Error fetching customers summary:", error);
        res.status(500).json({ message: "Ошибка получения сводки по клиентам" });
      }
    },
  );

  // ---- Planning scenarios ----
  app.get(
    "/api/planning/scenarios",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const scenarios = await storage.planning.getPlanningScenarios();
        res.json(scenarios);
      } catch (error: any) {
        console.error("Error fetching planning scenarios:", error);
        res.status(500).json({ message: "Ошибка получения сценариев" });
      }
    },
  );

  app.post(
    "/api/planning/scenarios",
    requireAuth,
    requirePermission("planning", "allocate"),
    async (req, res) => {
      try {
        const { name, description, basedOnScenarioId, cloneFrom } = req.body as {
          name: string;
          description?: string;
          basedOnScenarioId?: string | null;
          cloneFrom?: string | null;
        };
        if (!name) {
          return res.status(400).json({ message: "Название сценария обязательно" });
        }
        const scenarioData = {
          name,
          description: description || null,
          isActive: false,
          basedOnScenarioId: basedOnScenarioId || null,
          createdById: String(req.session.userId),
        };
        let scenario;
        if (cloneFrom !== undefined) {
          scenario = await storage.planning.clonePlanningScenario(cloneFrom, scenarioData);
        } else {
          scenario = await storage.planning.createPlanningScenario(scenarioData);
        }
        res.status(201).json(scenario);
      } catch (error: any) {
        console.error("Error creating planning scenario:", error);
        res.status(500).json({ message: "Ошибка создания сценария" });
      }
    },
  );

  app.patch(
    "/api/planning/scenarios/:id",
    requireAuth,
    requirePermission("planning", "allocate"),
    async (req, res) => {
      try {
        const updated = await storage.planning.updatePlanningScenario(
          req.params.id,
          req.body,
          String(req.session.userId),
        );
        if (!updated) return res.status(404).json({ message: "Сценарий не найден" });
        res.json(updated);
      } catch (error: any) {
        console.error("Error updating planning scenario:", error);
        res.status(500).json({ message: "Ошибка обновления сценария" });
      }
    },
  );

  app.delete(
    "/api/planning/scenarios/:id",
    requireAuth,
    requirePermission("planning", "allocate"),
    async (req, res) => {
      try {
        await storage.planning.deletePlanningScenario(req.params.id, String(req.session.userId));
        res.json({ ok: true });
      } catch (error: any) {
        console.error("Error deleting planning scenario:", error);
        res.status(500).json({ message: "Ошибка удаления сценария" });
      }
    },
  );

  // ---- Top-level volumes ----
  app.get(
    "/api/planning/top-level-volumes",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { supplierId, periodFrom, periodTo, scenarioId } = req.query as Record<string, string>;
        if (!supplierId || !periodFrom || !periodTo) {
          return res.status(400).json({ message: "supplierId, periodFrom и periodTo обязательны" });
        }
        const volumes = await storage.planning.getTopLevelVolumes(
          supplierId,
          periodFrom,
          periodTo,
          scenarioId || null,
        );
        res.json(volumes);
      } catch (error: any) {
        console.error("Error fetching top-level volumes:", error);
        res.status(500).json({ message: "Ошибка получения верхнеуровневых объёмов" });
      }
    },
  );

  app.get(
    "/api/planning/top-level-volumes/warehouse-summary",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { warehouseId, periodFrom, periodTo, scenarioId } = req.query as Record<string, string>;
        if (!warehouseId || !periodFrom || !periodTo) {
          return res.status(400).json({ message: "warehouseId, periodFrom и periodTo обязательны" });
        }
        const summary = await storage.planning.getTopLevelWarehouseSummary(
          warehouseId,
          periodFrom,
          periodTo,
          scenarioId || null,
        );
        res.json(summary);
      } catch (error: any) {
        console.error("Error fetching top-level warehouse summary:", error);
        res.status(500).json({ message: "Ошибка получения сводки верхнеуровневого плана" });
      }
    },
  );

  app.post(
    "/api/planning/top-level-volumes",
    requireAuth,
    requirePermission("planning", "allocate"),
    async (req, res) => {
      try {
        const data = insertPlanningTopLevelVolumeSchema.parse({
          ...req.body,
          counterpartyId: req.body.counterpartyId || undefined,
          scenarioId: req.body.scenarioId || undefined,
          createdById: String(req.session.userId),
        });
        const created = await storage.planning.createTopLevelVolume(data);
        res.status(201).json(created);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Error creating top-level volume:", error);
        res.status(500).json({ message: "Ошибка создания верхнеуровневого объёма" });
      }
    },
  );

  app.patch(
    "/api/planning/top-level-volumes/:id",
    requireAuth,
    requirePermission("planning", "allocate"),
    async (req, res) => {
      try {
        const updated = await storage.planning.updateTopLevelVolume(
          req.params.id,
          req.body,
          String(req.session.userId),
        );
        if (!updated) return res.status(404).json({ message: "Запись не найдена" });
        res.json(updated);
      } catch (error: any) {
        console.error("Error updating top-level volume:", error);
        res.status(500).json({ message: "Ошибка обновления верхнеуровневого объёма" });
      }
    },
  );

  app.delete(
    "/api/planning/top-level-volumes/:id",
    requireAuth,
    requirePermission("planning", "allocate"),
    async (req, res) => {
      try {
        await storage.planning.deleteTopLevelVolume(req.params.id, String(req.session.userId));
        res.json({ ok: true });
      } catch (error: any) {
        console.error("Error deleting top-level volume:", error);
        res.status(500).json({ message: "Ошибка удаления верхнеуровневого объёма" });
      }
    },
  );

  // ---- Warehouse supply tags ----
  app.get(
    "/api/planning/warehouse-tags",
    requireAuth,
    requirePermission("planning", "view"),
    async (req, res) => {
      try {
        const { warehouseId, scenarioId } = req.query as Record<string, string>;
        if (!warehouseId) {
          return res.status(400).json({ message: "warehouseId обязателен" });
        }
        const tags = await storage.planning.getWarehouseSupplyTags(warehouseId, scenarioId || null);
        res.json(tags);
      } catch (error: any) {
        console.error("Error fetching warehouse supply tags:", error);
        res.status(500).json({ message: "Ошибка получения меток склада" });
      }
    },
  );

  app.post(
    "/api/planning/warehouse-tags",
    requireAuth,
    requirePermission("planning", "allocate"),
    async (req, res) => {
      try {
        const data = insertWarehouseSupplyTagSchema.parse({
          ...req.body,
          supplierId: req.body.supplierId || undefined,
          scenarioId: req.body.scenarioId || undefined,
          createdById: String(req.session.userId),
        });
        const created = await storage.planning.createWarehouseSupplyTag(data);
        res.status(201).json(created);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Error creating warehouse supply tag:", error);
        res.status(500).json({ message: "Ошибка создания метки склада" });
      }
    },
  );

  app.delete(
    "/api/planning/warehouse-tags/:id",
    requireAuth,
    requirePermission("planning", "allocate"),
    async (req, res) => {
      try {
        await storage.planning.deleteWarehouseSupplyTag(req.params.id, String(req.session.userId));
        res.json({ ok: true });
      } catch (error: any) {
        console.error("Error deleting warehouse supply tag:", error);
        res.status(500).json({ message: "Ошибка удаления метки склада" });
      }
    },
  );
}
