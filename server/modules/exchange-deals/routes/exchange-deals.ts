import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertExchangeDealSchema } from "../entities/exchange-deals";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";

export function registerExchangeDealsRoutes(app: Express) {
  app.get(
    "/api/exchange-deals",
    requireAuth,
    requirePermission("exchange-deals", "view"),
    async (req, res) => {
      try {
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

        const result = await storage.exchangeDeals.getDeals(offset, pageSize, search, filters);
        res.json(result);
      } catch (error: any) {
        console.error("Error fetching exchange deals:", error);
        res.status(500).json({ message: "Ошибка получения сделок биржи" });
      }
    },
  );

  app.get(
    "/api/exchange-deals/:id",
    requireAuth,
    requirePermission("exchange-deals", "view"),
    async (req, res) => {
      try {
        const deal = await storage.exchangeDeals.getDeal(req.params.id);
        if (!deal) return res.status(404).json({ message: "Сделка не найдена" });
        res.json(deal);
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка получения сделки" });
      }
    },
  );

  app.post(
    "/api/exchange-deals",
    requireAuth,
    requirePermission("exchange-deals", "create"),
    auditLog({
      entityType: ENTITY_TYPES.EXCHANGE_DEAL,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const data = insertExchangeDealSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const deal = await storage.exchangeDeals.createDeal(data);

        // Auto-create advance card for seller if not exists
        if (deal.sellerId) {
          await storage.exchangeAdvances.ensureCardForSeller(
            deal.sellerId,
            req.session.userId,
          );
        }

        res.status(201).json(deal);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          console.error("Validation error:", error.errors);
          return res.status(400).json({ message: error.errors[0].message, errors: error.errors });
        }
        console.error("Error creating exchange deal:", error);
        res.status(500).json({ message: "Ошибка создания сделки биржи" });
      }
    },
  );

  app.patch(
    "/api/exchange-deals/:id",
    requireAuth,
    requirePermission("exchange-deals", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.EXCHANGE_DEAL,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => storage.exchangeDeals.getDeal(req.params.id),
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const validatedData = insertExchangeDealSchema.partial().parse(req.body);
        const deal = await storage.exchangeDeals.updateDeal(
          req.params.id,
          validatedData,
          req.session.userId,
        );
        if (!deal) return res.status(404).json({ message: "Сделка не найдена" });

        // Ensure advance card for seller
        if (deal.sellerId) {
          await storage.exchangeAdvances.ensureCardForSeller(
            deal.sellerId,
            req.session.userId,
          );
        }

        res.json(deal);
      } catch (error: any) {
        console.error("Error updating exchange deal:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({ message: "Ошибка обновления сделки биржи" });
      }
    },
  );

  app.delete(
    "/api/exchange-deals/:id",
    requireAuth,
    requirePermission("exchange-deals", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.EXCHANGE_DEAL,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => storage.exchangeDeals.getDeal(req.params.id),
    }),
    async (req, res) => {
      try {
        const success = await storage.exchangeDeals.deleteDeal(
          req.params.id,
          req.session.userId,
        );
        if (!success) return res.status(404).json({ message: "Сделка не найдена" });
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка удаления сделки биржи" });
      }
    },
  );

  app.post(
    "/api/exchange-deals/:id/copy",
    requireAuth,
    requirePermission("exchange-deals", "create"),
    async (req, res) => {
      try {
        const copy = await storage.exchangeDeals.copyDeal(
          req.params.id,
          req.session.userId,
        );
        if (!copy) return res.status(404).json({ message: "Сделка не найдена" });
        res.status(201).json(copy);
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка копирования сделки" });
      }
    },
  );
}
