import type { Express } from "express";
import { storage } from "../../../storage/index";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { insertMovementSchema } from "@shared/schema";
import { z } from "zod";
import { auditLog, auditView } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";
import { SSEService } from "../../../services/sse-service";
import {
  MovementApiInputError,
  movementResultToApi,
  toLegacyMovementInput,
} from "../movement-api-adapters";

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
      res.json(movementResultToApi(result));
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
      res.json(movementResultToApi(item));
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
        const normalized = toLegacyMovementInput(
          req.body as Record<string, unknown>,
        );
        const data = insertMovementSchema.parse({
          ...normalized,
          createdById: req.session.userId,
        });

        const quantityKgValue = data.quantityKg;
        if (quantityKgValue === null || quantityKgValue === undefined) {
          throw new Error("Количество (т) обязательно");
        }

        // Преобразуем числовые поля в строки для БД
        const dbData = {
          ...data,
          quantityKg: quantityKgValue.toString(),
          quantityLiters:
            data.quantityLiters !== null && data.quantityLiters !== undefined
              ? data.quantityLiters.toString()
              : null,
          density:
            data.density !== null && data.density !== undefined
              ? data.density.toString()
              : null,
          purchasePrice:
            data.purchasePrice !== null && data.purchasePrice !== undefined
              ? data.purchasePrice.toString()
              : null,
          deliveryPrice:
            data.deliveryPrice !== null && data.deliveryPrice !== undefined
              ? data.deliveryPrice.toString()
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
          costPerKg:
            data.costPerKg !== null && data.costPerKg !== undefined
              ? data.costPerKg.toString()
              : null,
        };

        const movementRecord = await storage.movement.createMovement(dbData);
        SSEService.notifyEntityChanged("movement", SSEService.extractClientId(req.headers["x-client-id"]));
        res.status(201).json(movementResultToApi(movementRecord));
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

        const normalized = toLegacyMovementInput(
          req.body as Record<string, unknown>,
        );

        // Преобразуем числовые поля в строки для БД
        const dbData = {
          ...normalized,
          quantityKg:
            normalized.quantityKg !== null &&
            normalized.quantityKg !== undefined
              ? String(normalized.quantityKg)
              : undefined,
          quantityLiters:
            normalized.quantityLiters !== null &&
            normalized.quantityLiters !== undefined
              ? normalized.quantityLiters.toString()
              : null,
          density:
            normalized.density !== null && normalized.density !== undefined
              ? String(normalized.density)
              : null,
          purchasePrice:
            normalized.purchasePrice !== null &&
            normalized.purchasePrice !== undefined
              ? String(normalized.purchasePrice)
              : null,
          deliveryPrice:
            normalized.deliveryPrice !== null &&
            normalized.deliveryPrice !== undefined
              ? String(normalized.deliveryPrice)
              : null,
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
          costPerKg:
            normalized.costPerKg !== null && normalized.costPerKg !== undefined
              ? String(normalized.costPerKg)
              : null,
          updatedById: req.session.userId,
        };

        const item = await storage.movement.updateMovement(id, dbData as any);
        if (!item) {
          return res.status(404).json({ message: "Перемещение не найдено" });
        }
        SSEService.notifyEntityChanged("movement", SSEService.extractClientId(req.headers["x-client-id"]));
        res.json(movementResultToApi(item));
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
