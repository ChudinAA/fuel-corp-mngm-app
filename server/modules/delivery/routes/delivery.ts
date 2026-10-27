import type { Express, Request, Response } from "express";
import { insertDeliveryCostSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog, auditView } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";
import { storage } from "../../../storage/index";
import {
  deliveryCostsToApi,
  DeliveryApiInputError,
  toLegacyDeliveryCostInput,
} from "../delivery-api-adapters";

export function registerDeliveryRoutes(app: Express) {
  // Получить все тарифы доставки
  app.get(
    "/api/delivery-costs",
    requireAuth,
    requirePermission("delivery", "view"),
    async (req: Request, res: Response) => {
      try {
        const costs = await storage.delivery.getAllDeliveryCosts();
        res.json(deliveryCostsToApi(costs));
      } catch (error) {
        console.error("Error fetching delivery costs:", error);
        res.status(500).json({ message: "Ошибка получения тарифов доставки" });
      }
    },
  );

  // Получить один тариф доставки
  app.get(
    "/api/delivery-costs/:id",
    requireAuth,
    requirePermission("delivery", "view"),
    async (req: Request, res: Response) => {
      try {
        const id = req.params.id;
        const cost = await storage.delivery.getDeliveryCost(id);
        if (!cost) {
          return res.status(404).json({ message: "Тариф доставки не найден" });
        }
        res.json(deliveryCostsToApi(cost));
      } catch (error) {
        console.error("Error fetching delivery cost:", error);
        res.status(500).json({ message: "Ошибка получения тарифа доставки" });
      }
    },
  );

  // Создать тариф доставки
  app.post(
    "/api/delivery-costs",
    requireAuth,
    requirePermission("delivery", "create"),
    auditLog({
      entityType: ENTITY_TYPES.DELIVERY_COST,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req: Request, res: Response) => {
      try {
        // Coerce numeric fields sent as strings from the form
        const coerced = {
          ...req.body,
          transitDays: req.body.transitDays != null && req.body.transitDays !== "" ? Number(req.body.transitDays) : undefined,
          priority: req.body.priority != null && req.body.priority !== "" ? Number(req.body.priority) : undefined,
        };
        const normalized = toLegacyDeliveryCostInput(coerced);
        const data = insertDeliveryCostSchema.parse(normalized);
        if (data.contractId) {
          const contract = await storage.catalogs.getContract(data.contractId);
          if (!contract || contract.carrierId !== data.carrierId) {
            return res.status(400).json({ message: "Выберите договор выбранного перевозчика" });
          }
        }
        const created = await storage.delivery.createDeliveryCost(
          data,
          req.session.userId
        );
        res.status(201).json(deliveryCostsToApi(created));
      } catch (error: any) {
        if (error instanceof DeliveryApiInputError) {
          return res.status(400).json({ message: error.message });
        }
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        if (error.message === "Такая запись уже существует") {
          return res.status(400).json({ message: error.message });
        }
        console.error("Error creating delivery cost:", error);
        res.status(500).json({ message: "Ошибка создания тарифа доставки" });
      }
    },
  );

  // Обновить тариф доставки
  app.patch(
    "/api/delivery-costs/:id",
    requireAuth,
    requirePermission("delivery", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.DELIVERY_COST,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        return await storage.delivery.getDeliveryCost(req.params.id);
      },
      getNewData: (req) => req.body,
    }),
    async (req: Request, res: Response) => {
      try {
        const id = req.params.id;
        const coercedPatch = {
          ...req.body,
          transitDays: req.body.transitDays != null && req.body.transitDays !== "" ? Number(req.body.transitDays) : undefined,
          priority: req.body.priority != null && req.body.priority !== "" ? Number(req.body.priority) : undefined,
        };
        const current = await storage.delivery.getDeliveryCost(id);
        if (!current) return res.status(404).json({ message: "Тариф доставки не найден" });
        const normalized = toLegacyDeliveryCostInput(coercedPatch, current);
        const rawData = insertDeliveryCostSchema.partial().parse(normalized);
        const effectiveContractId = rawData.contractId === undefined ? current.contractId : rawData.contractId;
        if (effectiveContractId) {
          const contract = await storage.catalogs.getContract(effectiveContractId);
          if (!contract || contract.carrierId !== (rawData.carrierId ?? current.carrierId)) {
            return res.status(400).json({ message: "Выберите договор выбранного перевозчика" });
          }
        }
        const data = {
          ...rawData,
          costPerKg: rawData.costPerKg === "" ? undefined : rawData.costPerKg,
          distance: rawData.distance === "" ? null : rawData.distance,
        };

        const updated = await storage.delivery.updateDeliveryCost(
          id,
          data,
          req.session.userId
        );

        if (!updated) {
          return res.status(404).json({ message: "Тариф доставки не найден" });
        }

        res.json(deliveryCostsToApi(updated));
      } catch (error) {
        if (error instanceof DeliveryApiInputError) {
          return res.status(400).json({ message: error.message });
        }
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Error updating delivery cost:", error);
        res.status(500).json({ message: "Ошибка обновления тарифа доставки" });
      }
    },
  );

  // Удалить тариф доставки
  app.delete(
    "/api/delivery-costs/:id",
    requireAuth,
    requirePermission("delivery", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.DELIVERY_COST,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        return await storage.delivery.getDeliveryCost(req.params.id);
      },
    }),
    async (req: Request, res: Response) => {
      try {
        const id = req.params.id;
        await storage.delivery.deleteDeliveryCost(id, req.session.userId);
        res.json({ message: "Тариф доставки удален" });
      } catch (error) {
        console.error("Error deleting delivery cost:", error);
        res.status(500).json({ message: "Ошибка удаления тарифа доставки" });
      }
    },
  );
}