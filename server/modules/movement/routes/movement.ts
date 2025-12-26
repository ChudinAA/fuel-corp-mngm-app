import type { Express } from "express";
import { storage } from "../../../storage/index";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { insertMovementSchema } from "@shared/schema";
import { z } from "zod";

export function registerMovementRoutes(app: Express) {
  app.get(
    "/api/movement",
    requireAuth,
    requirePermission("movement", "view"),
    async (req, res) => {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const result = await storage.movement.getMovements(page, pageSize);
      res.json(result);
    }
  );

  app.post(
    "/api/movement",
    requireAuth,
    requirePermission("movement", "create"),
    async (req, res) => {
      try {
        const data = insertMovementSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });

        // Преобразуем числовые поля в строки для БД
        const dbData = {
          ...data,
          quantityKg: data.quantityKg.toString(),
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
        res.status(201).json(movementRecord);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({ message: "Ошибка создания перемещения" });
      }
    }
  );

  app.patch(
    "/api/movement/:id",
    requireAuth,
    requirePermission("movement", "edit"),
    async (req, res) => {
      try {
        const id = req.params.id;
        
        // Преобразуем числовые поля в строки для БД
        const dbData = {
          ...req.body,
          quantityKg: req.body.quantityKg ? req.body.quantityKg.toString() : undefined,
          quantityLiters: req.body.quantityLiters !== null && req.body.quantityLiters !== undefined
            ? req.body.quantityLiters.toString()
            : null,
          density: req.body.density !== null && req.body.density !== undefined
            ? req.body.density.toString()
            : null,
          purchasePrice: req.body.purchasePrice !== null && req.body.purchasePrice !== undefined
            ? req.body.purchasePrice.toString()
            : null,
          deliveryPrice: req.body.deliveryPrice !== null && req.body.deliveryPrice !== undefined
            ? req.body.deliveryPrice.toString()
            : null,
          deliveryCost: req.body.deliveryCost !== null && req.body.deliveryCost !== undefined
            ? req.body.deliveryCost.toString()
            : null,
          totalCost: req.body.totalCost !== null && req.body.totalCost !== undefined
            ? req.body.totalCost.toString()
            : null,
          costPerKg: req.body.costPerKg !== null && req.body.costPerKg !== undefined
            ? req.body.costPerKg.toString()
            : null,
          updatedById: req.session.userId,
        };

        const item = await storage.movement.updateMovement(id, dbData);
        if (!item) {
          return res.status(404).json({ message: "Перемещение не найдено" });
        }
        res.json(item);
      } catch (error) {
        console.error("Error updating movement:", error);
        res.status(500).json({ message: "Ошибка обновления перемещения" });
      }
    }
  );

  app.delete(
    "/api/movement/:id",
    requireAuth,
    requirePermission("movement", "delete"),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.movement.deleteMovement(id);
        res.json({ message: "Перемещение удалено" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления перемещения" });
      }
    }
  );
}
