import type { Express } from "express";
import { storage } from "../../storage/index";
import { insertMovementSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth } from "../middleware";

export function registerMovementRoutes(app: Express) {
  app.get("/api/movement", requireAuth, async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const result = await storage.operations.getMovements(page, pageSize);
    res.json(result);
  });

  app.post("/api/movement", requireAuth, async (req, res) => {
    try {
      const data = insertMovementSchema.parse({
        ...req.body,
        createdById: req.session.userId,
      });
      const movementRecord = await storage.operations.createMovement(data);
      res.status(201).json(movementRecord);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания перемещения" });
    }
  });

  app.patch("/api/movement/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.operations.updateMovement(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Перемещение не найдено" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления перемещения" });
    }
  });

  app.delete("/api/movement/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.operations.deleteMovement(id);
      res.json({ message: "Перемещение удалено" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления перемещения" });
    }
  });
}