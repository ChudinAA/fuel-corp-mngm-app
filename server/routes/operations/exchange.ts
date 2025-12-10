import type { Express } from "express";
import { storage } from "../../storage/index";
import { requireAuth } from "../middleware";
import { insertExchangeSchema } from "@shared/schema";
import { z } from "zod";

export function registerExchangeRoutes(app: Express) {
  app.get("/api/exchange", requireAuth, async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const result = await storage.exchange.getExchangeDeals(page, pageSize);
    res.json(result);
  });

  app.post("/api/exchange", requireAuth, async (req, res) => {
    try {
      const data = insertExchangeSchema.parse({
        ...req.body,
        createdById: req.session.userId,
      });
      const item = await storage.exchange.createExchange(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания сделки" });
    }
  });

  app.put("/api/exchange/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const data = insertExchangeSchema.partial().parse(req.body);
      const item = await storage.exchange.updateExchange(id, data);
      if (!item) {
        return res.status(404).json({ message: "Сделка не найдена" });
      }
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка обновления сделки" });
    }
  });

  app.delete("/api/exchange/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      await storage.exchange.deleteExchange(id);
      res.json({ message: "Сделка удалена" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления сделки" });
    }
  });
}