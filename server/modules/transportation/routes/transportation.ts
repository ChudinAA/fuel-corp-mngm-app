import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertTransportationSchema } from "../entities/transportation";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";

export function registerTransportationRoutes(app: Express) {
  app.get(
    "/api/transportation",
    requireAuth,
    requirePermission("opt", "view"),
    async (req, res) => {
      const offset = parseInt(req.query.offset as string) || 0;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const search = req.query.search as string | undefined;

      const filters: Record<string, string[]> = {};
      Object.keys(req.query).forEach((key) => {
        if (key.startsWith("filter_")) {
          const columnId = key.replace("filter_", "");
          const value = req.query[key] as string;
          filters[columnId] = value.split(",").filter(Boolean);
        }
      });

      const result = await (storage as any).transportation.getTransportationDeals(
        offset,
        pageSize,
        search,
        filters,
      );
      res.json(result);
    },
  );

  app.get(
    "/api/transportation/:id",
    requireAuth,
    requirePermission("opt", "view"),
    async (req, res) => {
      const id = req.params.id;
      const item = await (storage as any).transportation.getTransportation(id);
      if (!item) {
        return res.status(404).json({ message: "Сделка не найдена" });
      }
      res.json(item);
    },
  );

  app.post(
    "/api/transportation/check-duplicate",
    requireAuth,
    async (req, res) => {
      try {
        const isDuplicate = await (storage as any).transportation.checkDuplicate(req.body);
        res.json({ isDuplicate });
      } catch (error) {
        console.error("Error checking duplicate transportation deal:", error);
        res.status(500).json({ message: "Ошибка проверки дубликата" });
      }
    },
  );

  app.post(
    "/api/transportation",
    requireAuth,
    requirePermission("opt", "create"),
    auditLog({
      entityType: ENTITY_TYPES.TRANSPORTATION,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const data = insertTransportationSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const item = await (storage as any).transportation.createTransportation(data);
        res.status(201).json(item);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error("Validation error:", error.errors);
          return res
            .status(400)
            .json({ message: error.errors[0].message, errors: error.errors });
        }
        console.error("Error creating transportation deal:", error);
        res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Ошибка создания сделки",
        });
      }
    },
  );

  app.patch(
    "/api/transportation/:id",
    requireAuth,
    requirePermission("opt", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.TRANSPORTATION,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        const item = await (storage as any).transportation.getTransportation(req.params.id);
        return item;
      },
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        const item = await (storage as any).transportation.updateTransportation(id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!item) {
          return res.status(404).json({ message: "Сделка не найдена" });
        }
        res.json(item);
      } catch (error) {
        res.status(500).json({ message: "Ошибка обновления сделки" });
      }
    },
  );

  app.delete(
    "/api/transportation/:id",
    requireAuth,
    requirePermission("opt", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.TRANSPORTATION,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        const item = await (storage as any).transportation.getTransportation(req.params.id);
        return item;
      },
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        await (storage as any).transportation.deleteTransportation(
          id,
          req.session.userId,
        );
        res.json({ message: "Сделка удалена" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления сделки" });
      }
    },
  );
}
