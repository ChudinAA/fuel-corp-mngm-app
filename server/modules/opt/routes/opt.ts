import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertOptSchema } from "@shared/schema";
import { updateOptSchema } from "../entities/opt";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog, auditView } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";
import { SSEService } from "../../../services/sse-service";

class OptApiInputError extends Error {}

function parseOptionalMass(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const mass = Number(value);
  if (!Number.isFinite(mass)) {
    throw new OptApiInputError(`${fieldName} должна быть числом`);
  }
  return mass;
}

function parseOptionalRate(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const rate = Number(value);
  if (!Number.isFinite(rate)) {
    throw new OptApiInputError(`${fieldName} должна быть числом`);
  }
  return rate;
}

function normalizeOptInput(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new OptApiInputError("Тело запроса должно быть объектом");
  }

  const input = body as Record<string, unknown>;
  const normalized = { ...input };
  if (Object.prototype.hasOwnProperty.call(input, "quantityTonnes")) {
    const tonnes = parseOptionalMass(
      input.quantityTonnes,
      "Масса в тоннах",
    );
    normalized.quantityTonnes =
      tonnes === null ? null : Number(tonnes.toFixed(5));
  }
  for (const apiField of [
    "purchasePricePerTonne",
    "salePricePerTonne",
    "deliveryTariffPerTonne",
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(input, apiField)) {
      const rate = parseOptionalRate(input[apiField], apiField);
      normalized[apiField] = rate;
    }
  }
  return normalized;
}

export function registerOptRoutes(app: Express) {
  app.get(
    "/api/opt",
    requireAuth,
    requirePermission("opt", "view"),
    async (req, res) => {
      const offset = parseInt(req.query.offset as string) || 0;
      const pageSize = parseInt(req.query.pageSize as string) || 100;
      const search = req.query.search as string | undefined;
      
      // Extract filters
      const filters: Record<string, string[]> = {};
      Object.keys(req.query).forEach(key => {
        if (key.startsWith('filter_')) {
          const columnId = key.replace('filter_', '');
          const value = req.query[key] as string;
          filters[columnId] = value.split(',').filter(Boolean);
        }
      });

      // Поддержка диапазона дат из фильтра
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      if (dateFrom) filters["dateFrom"] = [dateFrom];
      if (dateTo) filters["dateTo"] = [dateTo];

      const result = await (storage.opt as any).getOptDeals(offset, pageSize, search, filters);
      res.json(result);
    }
  );

  app.get(
    "/api/opt/contract-used/:priceId",
    requireAuth,
    async (req, res) => {
      try {
        const { priceId } = req.params;
        const volume = await storage.opt.getUsedVolumeByPrice(priceId);
        res.json(volume);
      } catch (error) {
        console.error("Error getting used volume:", error);
        res.status(500).json({ message: "Ошибка получения использованного объема" });
      }
    }
  );

  app.get(
    "/api/opt/contract-used-amount/:priceId",
    requireAuth,
    async (req, res) => {
      try {
        const { priceId } = req.params;
        const usedAmount = await storage.opt.getUsedAmountByPrice(priceId);
        res.json({ usedAmount });
      } catch (error) {
        console.error("Error getting used amount:", error);
        res.status(500).json({ message: "Ошибка получения использованной суммы" });
      }
    }
  );

  app.get(
    "/api/opt/:id",
    requireAuth,
    requirePermission("opt", "view"),
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
        const isDuplicate = await storage.opt.checkDuplicate(
          updateOptSchema.parse(normalizeOptInput(req.body)) as Parameters<
            typeof storage.opt.checkDuplicate
          >[0],
        );
        res.json({ isDuplicate });
      } catch (error) {
        if (error instanceof OptApiInputError) {
          return res.status(400).json({ message: error.message });
        }
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
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
          ...normalizeOptInput(req.body),
          createdById: req.session.userId,
        });
        const item = await storage.opt.createOpt(data);
        SSEService.notifyEntityChanged("opt", SSEService.extractClientId(req.headers["x-client-id"]));
        res.status(201).json(item);
      } catch (error) {
        if (error instanceof OptApiInputError) {
          return res.status(400).json({ message: error.message });
        }
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
          ...updateOptSchema.parse(normalizeOptInput(req.body)),
          updatedById: req.session.userId,
        });
        if (!item) {
          return res.status(404).json({ message: "Сделка не найдена" });
        }
        SSEService.notifyEntityChanged("opt", SSEService.extractClientId(req.headers["x-client-id"]));
        res.json(item);
      } catch (error) {
        if (error instanceof OptApiInputError) {
          return res.status(400).json({ message: error.message });
        }
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
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
        SSEService.notifyEntityChanged("opt", SSEService.extractClientId(req.headers["x-client-id"]));
        res.json({ message: "Сделка удалена" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления сделки" });
      }
    }
  );
}
