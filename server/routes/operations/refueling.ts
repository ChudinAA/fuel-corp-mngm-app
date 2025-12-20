import type { Express } from "express";
import { storage } from "../../storage/index";
import { insertAircraftRefuelingSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission } from "../middleware";

export function registerRefuelingOperationsRoutes(app: Express) {
  app.get("/api/refueling", requireAuth, requirePermission("refueling", "view"), async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const search = req.query.search as string | undefined;
    const result = await storage.aircraftRefueling.getRefuelings(page, pageSize, search);
    res.json(result);
  });

  app.post("/api/refueling", requireAuth, requirePermission("refueling", "create"), async (req, res) => {
    try {
      const data = insertAircraftRefuelingSchema.parse({
        ...req.body,
        createdById: req.session.userId,
      });
      const item = await storage.aircraftRefueling.createRefueling(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания заправки" });
    }
  });

  app.patch("/api/refueling/:id", requireAuth, requirePermission("refueling", "update"), async (req, res) => {
    try {
      const id = req.params.id;
      const item = await storage.aircraftRefueling.updateRefueling(id, {
        ...req.body,
        updatedById: req.session.userId,
      });
      if (!item) {
        return res.status(404).json({ message: "Заправка не найдена" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления заправки" });
    }
  });

  app.delete("/api/refueling/:id", requireAuth, requirePermission("refueling", "delete"), async (req, res) => {
    try {
      const id = req.params.id;
      await storage.aircraftRefueling.deleteRefueling(id);
      res.json({ message: "Заправка удалена" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления заправки" });
    }
  });
}