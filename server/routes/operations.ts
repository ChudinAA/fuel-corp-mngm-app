
import type { Express } from "express";
import { storage } from "../storage";
import {
  insertWarehouseSchema,
  insertExchangeSchema,
  insertMovementSchema,
  insertOptSchema,
  insertAircraftRefuelingSchema,
} from "@shared/schema";
import { z } from "zod";
import { requireAuth } from "./middleware";

export function registerOperationsRoutes(app: Express) {
  // ============ WAREHOUSES ROUTES ============

  app.get("/api/warehouses", requireAuth, async (req, res) => {
    const data = await storage.getAllWarehouses();
    res.json(data);
  });

  app.get("/api/warehouses/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const warehouse = await storage.getWarehouse(id);
    if (!warehouse) {
      return res.status(404).json({ message: "Склад не найден" });
    }
    res.json(warehouse);
  });

  app.post("/api/warehouses", requireAuth, async (req, res) => {
    try {
      const data = insertWarehouseSchema.parse(req.body);
      const item = await storage.createWarehouse(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания склада" });
    }
  });

  app.patch("/api/warehouses/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateWarehouse(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Склад не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления склада" });
    }
  });

  app.delete("/api/warehouses/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWarehouse(id);
      res.json({ message: "Склад удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления склада" });
    }
  });

  // ============ EXCHANGE ROUTES ============

  app.get("/api/exchange", requireAuth, async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const result = await storage.getExchangeDeals(page, pageSize);
    res.json(result);
  });

  app.post("/api/exchange", requireAuth, async (req, res) => {
    try {
      const data = insertExchangeSchema.parse({
        ...req.body,
        createdById: req.session.userId,
      });
      const item = await storage.createExchange(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания сделки" });
    }
  });

  app.patch("/api/exchange/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateExchange(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Сделка не найдена" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления сделки" });
    }
  });

  app.delete("/api/exchange/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteExchange(id);
      res.json({ message: "Сделка удалена" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления сделки" });
    }
  });

  // ============ MOVEMENT ROUTES ============

  app.get("/api/movement", requireAuth, async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const result = await storage.getMovements(page, pageSize);
    res.json(result);
  });

  app.post("/api/movement", requireAuth, async (req, res) => {
    try {
      const data = insertMovementSchema.parse({
        ...req.body,
        createdById: req.session.userId,
      });
      const item = await storage.createMovement(data);
      res.status(201).json(item);
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
      const item = await storage.updateMovement(id, req.body);
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
      await storage.deleteMovement(id);
      res.json({ message: "Перемещение удалено" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления перемещения" });
    }
  });

  // ============ OPT ROUTES ============

  app.get("/api/opt", requireAuth, async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const result = await storage.getOptDeals(page, pageSize);
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
      const item = await storage.createOpt(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания сделки" });
    }
  });

  app.patch("/api/opt/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateOpt(id, req.body);
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
      const id = parseInt(req.params.id);
      await storage.deleteOpt(id);
      res.json({ message: "Сделка удалена" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления сделки" });
    }
  });

  // ============ REFUELING ROUTES ============

  app.get("/api/refueling", requireAuth, async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const result = await storage.getRefuelings(page, pageSize);
    res.json(result);
  });

  app.post("/api/refueling", requireAuth, async (req, res) => {
    try {
      const data = insertAircraftRefuelingSchema.parse({
        ...req.body,
        createdById: req.session.userId,
        warehouseStatus: "OK",
        priceStatus: "OK",
      });
      const item = await storage.createRefueling(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания заправки" });
    }
  });

  app.patch("/api/refueling/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateRefueling(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Заправка не найдена" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления заправки" });
    }
  });

  app.delete("/api/refueling/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteRefueling(id);
      res.json({ message: "Заправка удалена" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления заправки" });
    }
  });

  // ============ DASHBOARD ROUTES ============

  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });
}
