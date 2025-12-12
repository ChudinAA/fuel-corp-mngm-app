
import type { Express } from "express";
import { storage } from "../../storage/index";
import { insertBaseSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth } from "../middleware";

export function registerBasesRoutes(app: Express) {
  app.get("/api/bases", requireAuth, async (req, res) => {
    const baseType = req.query.baseType as string | undefined;
    const data = await storage.bases.getAllBases(baseType);
    res.json(data);
  });

  app.get("/api/bases/:id", requireAuth, async (req, res) => {
    const id = req.params.id;
    const base = await storage.bases.getBase(id);
    if (!base) {
      return res.status(404).json({ message: "Базис не найден" });
    }
    res.json(base);
  });

  app.post("/api/bases", requireAuth, async (req, res) => {
    try {
      const data = insertBaseSchema.parse({
        ...req.body,
        createdById: req.session.userId,
      });
      const item = await storage.bases.createBase(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания базиса" });
    }
  });

  app.patch("/api/bases/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const item = await storage.bases.updateBase(id, {
        ...req.body,
        updatedById: req.session.userId,
      });
      if (!item) {
        return res.status(404).json({ message: "Базис не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления базиса" });
    }
  });

  app.delete("/api/bases/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      await storage.bases.deleteBase(id);
      res.json({ message: "Базис удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления базиса" });
    }
  });
}
