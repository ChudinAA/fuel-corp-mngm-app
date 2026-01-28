import type { Express } from "express";
import { refuelingAbroadStorage } from "../storage/refueling-abroad-storage";
import { refuelingAbroadIntermediariesStorage } from "../storage/refueling-abroad-intermediaries-storage";
import { insertRefuelingAbroadSchema } from "../entities/refueling-abroad";
import { insertRefuelingAbroadIntermediarySchema } from "../entities/refueling-abroad-intermediaries";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";

export function registerRefuelingAbroadRoutes(app: Express) {
  app.get(
    "/api/refueling-abroad",
    requireAuth,
    requirePermission("refueling", "view"),
    async (req, res) => {
      try {
        const items = await refuelingAbroadStorage.getAll();
        res.json(items);
      } catch (error: any) {
        console.error("Error fetching refueling abroad records:", error);
        res.status(500).json({ message: "Ошибка получения записей заправки зарубеж" });
      }
    }
  );

  app.get(
    "/api/refueling-abroad/drafts",
    requireAuth,
    requirePermission("refueling", "view"),
    async (req, res) => {
      try {
        const drafts = await refuelingAbroadStorage.getDrafts();
        res.json(drafts);
      } catch (error: any) {
        console.error("Error fetching drafts:", error);
        res.status(500).json({ message: "Ошибка получения черновиков" });
      }
    }
  );

  app.get(
    "/api/refueling-abroad/:id",
    requireAuth,
    requirePermission("refueling", "view"),
    async (req, res) => {
      try {
        const item = await refuelingAbroadStorage.getById(req.params.id);
        if (!item) {
          return res.status(404).json({ message: "Запись не найдена" });
        }
        res.json(item);
      } catch (error: any) {
        console.error("Error fetching refueling abroad record:", error);
        res.status(500).json({ message: "Ошибка получения записи" });
      }
    }
  );

  app.post(
    "/api/refueling-abroad",
    requireAuth,
    requirePermission("refueling", "create"),
    auditLog({
      entityType: ENTITY_TYPES.AIRCRAFT_REFUELING_ABROAD,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const validatedData = insertRefuelingAbroadSchema.parse(req.body);
        const userId = req.session.userId?.toString();
        const item = await refuelingAbroadStorage.create(validatedData, userId);
        res.status(201).json(item);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Ошибка валидации", errors: error.errors });
        }
        console.error("Error creating refueling abroad record:", error);
        res.status(500).json({ message: "Ошибка создания записи" });
      }
    }
  );

  app.patch(
    "/api/refueling-abroad/:id",
    requireAuth,
    requirePermission("refueling", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.AIRCRAFT_REFUELING_ABROAD,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        return await refuelingAbroadStorage.getById(req.params.id);
      },
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const validatedData = insertRefuelingAbroadSchema.parse(req.body);
        const userId = req.session.userId?.toString();
        const item = await refuelingAbroadStorage.update(req.params.id, validatedData, userId);
        if (!item) {
          return res.status(404).json({ message: "Запись не найдена" });
        }
        res.json(item);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Ошибка валидации", errors: error.errors });
        }
        console.error("Error updating refueling abroad record:", error);
        res.status(500).json({ message: "Ошибка обновления записи" });
      }
    }
  );

  app.delete(
    "/api/refueling-abroad/:id",
    requireAuth,
    requirePermission("refueling", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.AIRCRAFT_REFUELING_ABROAD,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        return await refuelingAbroadStorage.getById(req.params.id);
      },
    }),
    async (req, res) => {
      try {
        const userId = req.session.userId?.toString();
        const success = await refuelingAbroadStorage.softDelete(req.params.id, userId);
        if (!success) {
          return res.status(404).json({ message: "Запись не найдена" });
        }
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting refueling abroad record:", error);
        res.status(500).json({ message: "Ошибка удаления записи" });
      }
    }
  );

  app.get(
    "/api/refueling-abroad/by-supplier/:supplierId",
    requireAuth,
    requirePermission("refueling", "view"),
    async (req, res) => {
      try {
        const items = await refuelingAbroadStorage.getBySupplierId(req.params.supplierId);
        res.json(items);
      } catch (error: any) {
        console.error("Error fetching by supplier:", error);
        res.status(500).json({ message: "Ошибка получения записей" });
      }
    }
  );

  app.get(
    "/api/refueling-abroad/by-buyer/:buyerId",
    requireAuth,
    requirePermission("refueling", "view"),
    async (req, res) => {
      try {
        const items = await refuelingAbroadStorage.getByBuyerId(req.params.buyerId);
        res.json(items);
      } catch (error: any) {
        console.error("Error fetching by buyer:", error);
        res.status(500).json({ message: "Ошибка получения записей" });
      }
    }
  );

  app.get(
    "/api/refueling-abroad/by-storage-card/:storageCardId",
    requireAuth,
    requirePermission("refueling", "view"),
    async (req, res) => {
      try {
        const items = await refuelingAbroadStorage.getByStorageCardId(req.params.storageCardId);
        res.json(items);
      } catch (error: any) {
        console.error("Error fetching by storage card:", error);
        res.status(500).json({ message: "Ошибка получения записей" });
      }
    }
  );

  app.get(
    "/api/refueling-abroad/:id/intermediaries",
    requireAuth,
    requirePermission("refueling", "view"),
    async (req, res) => {
      try {
        const items = await refuelingAbroadIntermediariesStorage.getByRefuelingIdWithDetails(req.params.id);
        res.json(items);
      } catch (error: any) {
        console.error("Error fetching intermediaries:", error);
        res.status(500).json({ message: "Ошибка получения посредников" });
      }
    }
  );

  app.put(
    "/api/refueling-abroad/:id/intermediaries",
    requireAuth,
    requirePermission("refueling", "edit"),
    async (req, res) => {
      try {
        const intermediariesSchema = z.array(
          insertRefuelingAbroadIntermediarySchema.omit({ refuelingAbroadId: true })
        );
        const validatedData = intermediariesSchema.parse(req.body);
        const items = await refuelingAbroadIntermediariesStorage.replaceForRefueling(
          req.params.id,
          validatedData
        );
        res.json(items);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Ошибка валидации", errors: error.errors });
        }
        console.error("Error updating intermediaries:", error);
        res.status(500).json({ message: "Ошибка обновления посредников" });
      }
    }
  );

  app.post(
    "/api/refueling-abroad/:id/intermediaries",
    requireAuth,
    requirePermission("refueling", "edit"),
    async (req, res) => {
      try {
        const validatedData = insertRefuelingAbroadIntermediarySchema
          .omit({ refuelingAbroadId: true })
          .parse(req.body);
        const item = await refuelingAbroadIntermediariesStorage.create({
          ...validatedData,
          refuelingAbroadId: req.params.id,
        });
        res.status(201).json(item);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Ошибка валидации", errors: error.errors });
        }
        console.error("Error creating intermediary:", error);
        res.status(500).json({ message: "Ошибка добавления посредника" });
      }
    }
  );

  app.delete(
    "/api/refueling-abroad/:refuelingId/intermediaries/:id",
    requireAuth,
    requirePermission("refueling", "edit"),
    async (req, res) => {
      try {
        const success = await refuelingAbroadIntermediariesStorage.delete(req.params.id);
        if (!success) {
          return res.status(404).json({ message: "Посредник не найден" });
        }
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting intermediary:", error);
        res.status(500).json({ message: "Ошибка удаления посредника" });
      }
    }
  );
}
