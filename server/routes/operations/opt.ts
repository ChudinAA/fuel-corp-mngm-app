
import type { Express } from "express";
import { storage } from "../../storage/index";
import { insertOptSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth } from "../middleware";

export function registerOptRoutes(app: Express) {
  app.get("/api/opt", requireAuth, async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const search = req.query.search as string | undefined;
    
    const filters = {
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      supplierId: req.query.supplierId as string | undefined,
      buyerId: req.query.buyerId as string | undefined,
      warehouseId: req.query.warehouseId as string | undefined,
    };
    
    const result = await storage.opt.getOptDeals(page, pageSize, search, filters);
    res.json(result);
  });

  app.post("/api/opt", requireAuth, async (req, res) => {
    try {
      const data = insertOptSchema.parse({
        ...req.body,
        createdById: req.session.userId,
        warehouseStatus: "OK",
        priceStatus: "OK",
      });
      const item = await storage.opt.createOpt(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res.status(400).json({ message: error.errors[0].message, errors: error.errors });
      }
      console.error("Error creating opt deal:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Ошибка создания сделки" });
    }
  });

  app.patch("/api/opt/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const item = await storage.opt.updateOpt(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Сделка не найдена" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления сделки" });
    }
  });

  app.delete("/api/opt/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      await storage.opt.deleteOpt(id);
      res.json({ message: "Сделка удалена" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления сделки" });
    }
  });
}
