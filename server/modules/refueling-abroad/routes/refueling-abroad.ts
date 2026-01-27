import type { Express } from "express";
import { refuelingAbroadStorage } from "../storage/refueling-abroad-storage";
import { insertRefuelingAbroadSchema } from "../entities/refueling-abroad";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";

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
    async (req, res) => {
      try {
        const validatedData = insertRefuelingAbroadSchema.parse(req.body);
        const userId = req.user?.id;
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
    async (req, res) => {
      try {
        const validatedData = insertRefuelingAbroadSchema.partial().parse(req.body);
        const userId = req.user?.id;
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
    async (req, res) => {
      try {
        const userId = req.user?.id;
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
}
