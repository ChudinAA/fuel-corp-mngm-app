import type { Express } from "express";
import { storage } from "../../../storage/index";
import {
  getOperationNomenclatureError,
  getOperationNomenclatureUpdateError,
} from "../../catalogs/nomenclature-validation";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { insertMovementSchema } from "@shared/schema";
import { z } from "zod";
import { auditLog, auditView } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";
import { SSEService } from "../../../services/sse-service";
import {
  MovementApiInputError,
  normalizeMovementInput,
} from "../movement-input-validation";

export function registerMovementRoutes(app: Express) {
  app.get(
    "/api/movement",
    requireAuth,
    requirePermission("movement", "view"),
    async (req, res) => {
      const offset = parseInt(req.query.offset as string) || 0;
      const pageSize = parseInt(req.query.pageSize as string) || 100;
      const search = req.query.search as string | undefined;

      const filters: Record<string, string[]> = {};
      Object.entries(req.query).forEach(([key, value]) => {
        if (key.startsWith("filter_")) {
          const columnId = key.replace("filter_", "");
          if (Array.isArray(value)) {
            filters[columnId] = value as string[];
          } else if (typeof value === "string") {
            filters[columnId] = value.split(",").filter(Boolean);
          }
        }
      });

      // Поддержка диапазона дат из фильтра
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      if (dateFrom) filters["dateFrom"] = [dateFrom];
      if (dateTo) filters["dateTo"] = [dateTo];

      const result = await (storage.movement as any).getMovements(
        offset,
        pageSize,
        search,
        filters,
      );
      res.json(result);
    },
  );

  app.get(
    "/api/movement/:id",
    requireAuth,
    requirePermission("movement", "view"),
    async (req, res) => {
      const id = req.params.id;
      const item = await storage.movement.getMovement(id);
      if (!item) {
        return res.status(404).json({ message: "Перемещение не найдено" });
      }
      res.json(item);
    },
  );

  app.post(
    "/api/movement",
    requireAuth,
    requirePermission("movement", "create"),
    auditLog({
      entityType: ENTITY_TYPES.MOVEMENT,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const normalized = normalizeMovementInput(
          req.body as Record<string, unknown>,
        );
        const data = insertMovementSchema.parse({
          ...normalized,
          createdById: req.session.userId,
        });
        const nomenclatureError = await getOperationNomenclatureError(
          data,
          (id) => storage.catalogs.getNomenclatureItem(id),
        );
        if (nomenclatureError) {
          return res.status(400).json({ message: nomenclatureError });
        }

        if (data.quantityTonnes === null || data.quantityTonnes === undefined) {
          throw new Error("Количество (т) обязательно");
        }

        // Преобразуем числовые поля в строки для БД
        const dbData = {
          ...data,
          quantityTonnes:
            data.quantityTonnes === null || data.quantityTonnes === undefined
              ? null
              : data.quantityTonnes.toString(),
          quantityLiters:
            data.quantityLiters !== null && data.quantityLiters !== undefined
              ? data.quantityLiters.toString()
              : null,
          density:
            data.density !== null && data.density !== undefined
              ? data.density.toString()
              : null,
          purchasePricePerTonne:
            data.purchasePricePerTonne !== null &&
            data.purchasePricePerTonne !== undefined
              ? data.purchasePricePerTonne.toString()
              : null,
          deliveryPricePerTonne:
            data.deliveryPricePerTonne !== null &&
            data.deliveryPricePerTonne !== undefined
              ? data.deliveryPricePerTonne.toString()
              : null,
          deliveryCost:
            data.deliveryCost !== null && data.deliveryCost !== undefined
              ? data.deliveryCost.toString()
              : null,
          warehouseServicesCost:
            data.warehouseServicesCost !== null && data.warehouseServicesCost !== undefined
              ? data.warehouseServicesCost.toString()
              : null,
          totalCost:
            data.totalCost !== null && data.totalCost !== undefined
              ? data.totalCost.toString()
              : null,
          costPerTonne:
            data.costPerTonne !== null && data.costPerTonne !== undefined
              ? data.costPerTonne.toString()
              : null,
        };

        const movementRecord = await storage.movement.createMovement(dbData);
        SSEService.notifyEntityChanged("movement", SSEService.extractClientId(req.headers["x-client-id"]));
        res.status(201).json(movementRecord);
      } catch (error) {
        if (error instanceof MovementApiInputError) {
          return res.status(400).json({ message: error.message });
        }
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({ message: "Ошибка создания перемещения" });
      }
    },
  );

  app.patch(
    "/api/movement/:id",
    requireAuth,
    requirePermission("movement", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.MOVEMENT,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        const item = await storage.movement.getMovement(req.params.id);
        return item;
      },
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const id = req.params.id;

        const normalized = normalizeMovementInput(
          req.body as Record<string, unknown>,
        );
        const current = await storage.movement.getMovement(id);
        if (!current) {
          return res.status(404).json({ message: "Перемещение не найдено" });
        }
        const nomenclatureError = await getOperationNomenclatureUpdateError(
          current,
          normalized,
          (nomenclatureId) =>
            storage.catalogs.getNomenclatureItem(nomenclatureId),
        );
        if (nomenclatureError) {
          return res.status(400).json({ message: nomenclatureError });
        }

        // Преобразуем числовые поля в строки для БД
        const dbData = {
          ...normalized,
          quantityTonnes:
            normalized.quantityTonnes !== null &&
            normalized.quantityTonnes !== undefined
              ? String(normalized.quantityTonnes)
              : normalized.quantityTonnes,
          quantityLiters:
            normalized.quantityLiters !== null &&
            normalized.quantityLiters !== undefined
              ? normalized.quantityLiters.toString()
              : null,
          density:
            normalized.density !== null && normalized.density !== undefined
              ? String(normalized.density)
              : null,
          purchasePricePerTonne:
            normalized.purchasePricePerTonne !== null &&
            normalized.purchasePricePerTonne !== undefined
              ? String(normalized.purchasePricePerTonne)
              : normalized.purchasePricePerTonne,
          deliveryPricePerTonne:
            normalized.deliveryPricePerTonne !== null &&
            normalized.deliveryPricePerTonne !== undefined
              ? String(normalized.deliveryPricePerTonne)
              : normalized.deliveryPricePerTonne,
          deliveryCost:
            normalized.deliveryCost !== null &&
            normalized.deliveryCost !== undefined
              ? String(normalized.deliveryCost)
              : null,
          warehouseServicesCost:
            normalized.warehouseServicesCost !== null &&
            normalized.warehouseServicesCost !== undefined
              ? String(normalized.warehouseServicesCost)
              : null,
          totalCost:
            normalized.totalCost !== null && normalized.totalCost !== undefined
              ? String(normalized.totalCost)
              : null,
          costPerTonne:
            normalized.costPerTonne !== null &&
            normalized.costPerTonne !== undefined
              ? String(normalized.costPerTonne)
              : normalized.costPerTonne,
          updatedById: req.session.userId,
        };

        const item = await storage.movement.updateMovement(id, dbData as any);
        if (!item) {
          return res.status(404).json({ message: "Перемещение не найдено" });
        }
        SSEService.notifyEntityChanged("movement", SSEService.extractClientId(req.headers["x-client-id"]));
        res.json(item);
      } catch (error) {
        if (error instanceof MovementApiInputError) {
          return res.status(400).json({ message: error.message });
        }
        console.error("Error updating movement:", error);
        res.status(500).json({ message: "Ошибка обновления перемещения" });
      }
    },
  );

  app.delete(
    "/api/movement/:id",
    requireAuth,
    requirePermission("movement", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.MOVEMENT,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        const item = await storage.movement.getMovement(req.params.id);
        return item;
      },
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.movement.deleteMovement(id, req.session.userId);
        SSEService.notifyEntityChanged("movement", SSEService.extractClientId(req.headers["x-client-id"]));
        res.json({ message: "Перемещение удалено" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления перемещения" });
      }
    },
  );
}
