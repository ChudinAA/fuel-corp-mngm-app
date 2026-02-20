import type { Express } from "express";
import { storage } from "../../../storage/index";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { insertEquipmentMovementSchema } from "@shared/schema";
import { z } from "zod";
import { auditLog } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";

export function registerEquipmentMovementRoutes(app: Express) {
  app.get(
    "/api/equipment-movement",
    requireAuth,
    requirePermission("equipment_movement", "view"),
    async (req, res) => {
      const offset = parseInt(req.query.offset as string) || 0;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const search = req.query.search as string | undefined;
      const result = await (storage as any).equipmentMovement.getMovements(offset, pageSize, search);
      res.json(result);
    }
  );

  app.get(
    "/api/equipment-movement/:id",
    requireAuth,
    requirePermission("equipment_movement", "view"),
    async (req, res) => {
      const item = await (storage as any).equipmentMovement.getMovement(req.params.id);
      if (!item) return res.status(404).json({ message: "Запись не найдена" });
      res.json(item);
    }
  );

  app.post(
    "/api/equipment-movement",
    requireAuth,
    requirePermission("equipment_movement", "create"),
    auditLog({
      entityType: "EQUIPMENT_MOVEMENT" as any,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const data = insertEquipmentMovementSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const record = await (storage as any).equipmentMovement.createMovement(data);
        res.status(201).json(record);
      } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message });
        res.status(500).json({ message: "Ошибка сервера" });
      }
    }
  );

  app.patch(
    "/api/equipment-movement/:id",
    requireAuth,
    requirePermission("equipment_movement", "edit"),
    auditLog({
      entityType: "EQUIPMENT_MOVEMENT" as any,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => (storage as any).equipmentMovement.getMovement(req.params.id),
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      const item = await (storage as any).equipmentMovement.updateMovement(req.params.id, {
        ...req.body,
        updatedById: req.session.userId,
      });
      if (!item) return res.status(404).json({ message: "Запись не найдена" });
      res.json(item);
    }
  );

  app.delete(
    "/api/equipment-movement/:id",
    requireAuth,
    requirePermission("equipment_movement", "delete"),
    auditLog({
      entityType: "EQUIPMENT_MOVEMENT" as any,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => (storage as any).equipmentMovement.getMovement(req.params.id),
    }),
    async (req, res) => {
      await (storage as any).equipmentMovement.deleteMovement(req.params.id, req.session.userId!);
      res.json({ message: "Удалено" });
    }
  );
}
