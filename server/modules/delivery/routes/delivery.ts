import type { Express, Request, Response } from "express";
import { insertDeliveryCostSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog, auditView } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";
import { storage } from "../../../storage/index";

export function registerDeliveryRoutes(app: Express) {
  // Получить все тарифы доставки
  app.get(
    "/api/delivery-costs",
    requireAuth,
    requirePermission("delivery", "view"),
    async (req: Request, res: Response) => {
      try {
        const costs = await storage.delivery.getAllDeliveryCosts();
        res.json(costs);
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
    auditView(ENTITY_TYPES.DELIVERY_COST),
    async (req: Request, res: Response) => {
      try {
        const id = req.params.id;
        const cost = await storage.delivery.getDeliveryCost(id);
        if (!cost) {
          return res.status(404).json({ message: "Тариф доставки не найден" });
        }
        res.json(cost);
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
        const data = insertDeliveryCostSchema.parse(req.body);
        const created = await storage.delivery.createDeliveryCost(
          data,
          req.session.userId
        );
        res.status(201).json(created);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
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
        const data = insertDeliveryCostSchema.partial().parse(req.body);

        const updated = await storage.delivery.updateDeliveryCost(
          id,
          data,
          req.session.userId
        );

        if (!updated) {
          return res.status(404).json({ message: "Тариф доставки не найден" });
        }

        res.json(updated);
      } catch (error) {
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