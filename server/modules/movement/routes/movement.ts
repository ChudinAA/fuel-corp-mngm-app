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
        
        // Создаем объект только с переданными полями
        const dbData: any = {
          updatedById: req.session.userId,
        };

        // Добавляем только те поля, которые были переданы
        if (req.body.movementDate !== undefined) dbData.movementDate = req.body.movementDate;
        if (req.body.movementType !== undefined) dbData.movementType = req.body.movementType;
        if (req.body.productType !== undefined) dbData.productType = req.body.productType;
        if (req.body.supplierId !== undefined) dbData.supplierId = req.body.supplierId;
        if (req.body.fromWarehouseId !== undefined) dbData.fromWarehouseId = req.body.fromWarehouseId;
        if (req.body.toWarehouseId !== undefined) dbData.toWarehouseId = req.body.toWarehouseId;
        if (req.body.carrierId !== undefined) dbData.carrierId = req.body.carrierId;
        if (req.body.notes !== undefined) dbData.notes = req.body.notes;
        if (req.body.vehicleNumber !== undefined) dbData.vehicleNumber = req.body.vehicleNumber;
        if (req.body.trailerNumber !== undefined) dbData.trailerNumber = req.body.trailerNumber;
        if (req.body.driverName !== undefined) dbData.driverName = req.body.driverName;

        // Преобразуем числовые поля в строки для БД
        if (req.body.quantityKg !== undefined) {
          dbData.quantityKg = req.body.quantityKg.toString();
        }
        if (req.body.quantityLiters !== undefined && req.body.quantityLiters !== null) {
          dbData.quantityLiters = req.body.quantityLiters.toString();
        }
        if (req.body.density !== undefined && req.body.density !== null) {
          dbData.density = req.body.density.toString();
        }
        if (req.body.purchasePrice !== undefined && req.body.purchasePrice !== null) {
          dbData.purchasePrice = req.body.purchasePrice.toString();
        }
        if (req.body.deliveryPrice !== undefined && req.body.deliveryPrice !== null) {
          dbData.deliveryPrice = req.body.deliveryPrice.toString();
        }
        if (req.body.deliveryCost !== undefined && req.body.deliveryCost !== null) {
          dbData.deliveryCost = req.body.deliveryCost.toString();
        }
        if (req.body.totalCost !== undefined && req.body.totalCost !== null) {
          dbData.totalCost = req.body.totalCost.toString();
        }
        if (req.body.costPerKg !== undefined && req.body.costPerKg !== null) {
          dbData.costPerKg = req.body.costPerKg.toString();
        }

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
