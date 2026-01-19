import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertOptSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog, auditView } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";

export function registerOptRoutes(app: Express) {
  app.get(
    "/api/opt",
    requireAuth,
    requirePermission("opt", "view"),
    async (req, res) => {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const search = req.query.search as string | undefined;
      const result = await storage.opt.getOptDeals(page, pageSize, search);
      res.json(result);
    }
  );

  app.get(
    "/api/opt/contract-used/:priceId",
    requireAuth,
    async (req, res) => {
      try {
        const { priceId } = req.params;
        const usedVolume = await storage.opt.getUsedVolumeByPrice(priceId);
        res.json({ usedVolume });
      } catch (error) {
        console.error("Error getting used volume:", error);
        res.status(500).json({ message: "Ошибка получения использованного объема" });
      }
    }
  );

  app.get(
    "/api/opt/:id",
    requireAuth,
    requirePermission("opt", "view"),
    auditView(ENTITY_TYPES.OPT),
    async (req, res) => {
      const id = req.params.id;
      const item = await storage.opt.getOpt(id);
      if (!item) {
        return res.status(404).json({ message: "Сделка не найдена" });
      }
      res.json(item);
    }
  );

  app.post(
    "/api/opt/check-duplicate",
    requireAuth,
    async (req, res) => {
      try {
        const isDuplicate = await storage.opt.checkDuplicate(req.body);
        res.json({ isDuplicate });
      } catch (error) {
        console.error("Error checking duplicate opt deal:", error);
        res.status(500).json({ message: "Ошибка проверки дубликата" });
      }
    }
  );

  app.post(
    "/api/opt",
    requireAuth,
    requirePermission("opt", "create"),
    auditLog({
      entityType: ENTITY_TYPES.OPT,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const data = insertOptSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const item = await storage.opt.createOpt(data);
        res.status(201).json(item);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error("Validation error:", error.errors);
          return res
            .status(400)
            .json({ message: error.errors[0].message, errors: error.errors });
        }
        console.error("Error creating opt deal:", error);
        res
          .status(500)
          .json({
            message:
              error instanceof Error ? error.message : "Ошибка создания сделки",
          });
      }
    }
  );

  app.patch(
    "/api/opt/:id",
    requireAuth,
    requirePermission("opt", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.OPT,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        const item = await storage.opt.getOpt(req.params.id);
        return item;
      },
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        const item = await storage.opt.updateOpt(id, {
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
    }
  );

  app.delete(
    "/api/opt/:id",
    requireAuth,
    requirePermission("opt", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.OPT,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        const item = await storage.opt.getOpt(req.params.id);
        return item;
      },
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.opt.deleteOpt(id, req.session.userId);
        res.json({ message: "Сделка удалена" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления сделки" });
      }
    }
  );
}
