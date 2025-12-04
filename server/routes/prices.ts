import type { Express } from "express";
import { storage } from "../storage";
import { insertPriceSchema, insertDeliveryCostSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth } from "./middleware";

export function registerPricesRoutes(app: Express) {
  // ============ PRICES ROUTES ============

  app.get("/api/prices", requireAuth, async (req, res) => {
    const { counterpartyRole, counterpartyType } = req.query;
    if (counterpartyRole && counterpartyType) {
      const data = await storage.prices.getPricesByRole(counterpartyRole as string, counterpartyType as string);
      return res.json(data);
    }
    const data = await storage.prices.getAllPrices();
    res.json(data);
  });

  app.post("/api/prices", requireAuth, async (req, res) => {
    try {
      const body = req.body;
      const processedData = {
        ...body,
        priceValues: body.priceValues?.map((pv: { price: string }) => JSON.stringify({ price: parseFloat(pv.price) })),
        volume: body.volume ? String(body.volume) : null,
        counterpartyId: typeof body.counterpartyId === 'string' ? parseInt(body.counterpartyId) : body.counterpartyId,
      };

      const data = insertPriceSchema.parse(processedData);
      const item = await storage.prices.createPrice(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Price creation error:", error);
      res.status(500).json({ message: "Ошибка создания цены" });
    }
  });

  app.patch("/api/prices/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.prices.updatePrice(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Цена не найдена" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления цены" });
    }
  });

  app.delete("/api/prices/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.prices.deletePrice(id);
      res.json({ message: "Цена удалена" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления цены" });
    }
  });

  app.get("/api/prices/calculate-selection", requireAuth, async (req, res) => {
    try {
      const { counterpartyId, counterpartyType, basis, dateFrom, dateTo } = req.query;

      if (!counterpartyId || !counterpartyType || !basis || !dateFrom || !dateTo) {
        return res.status(400).json({ message: "Не указаны обязательные параметры" });
      }

      const totalVolume = await storage.prices.calculatePriceSelection(
        parseInt(counterpartyId as string),
        counterpartyType as string,
        basis as string,
        dateFrom as string,
        dateTo as string
      );

      res.json({ totalVolume: totalVolume.toFixed(2) });
    } catch (error) {
      console.error("Selection calculation error:", error);
      res.status(500).json({ message: "Ошибка расчета выборки" });
    }
  });

  app.get("/api/prices/check-date-overlaps", requireAuth, async (req, res) => {
    try {
      const { counterpartyId, counterpartyType, counterpartyRole, basis, dateFrom, dateTo, excludeId } = req.query;

      if (!counterpartyId || !counterpartyType || !counterpartyRole || !basis || !dateFrom || !dateTo) {
        return res.status(400).json({ message: "Не указаны обязательные параметры" });
      }

      const result = await storage.prices.checkPriceDateOverlaps(
        parseInt(counterpartyId as string),
        counterpartyType as string,
        counterpartyRole as string,
        basis as string,
        dateFrom as string,
        dateTo as string,
        excludeId ? parseInt(excludeId as string) : undefined
      );

      res.json(result);
    } catch (error) {
      console.error("Date overlap check error:", error);
      res.status(500).json({ message: "Ошибка проверки дат" });
    }
  });

  // ============ DELIVERY COST ROUTES ============

  app.get("/api/delivery-costs", requireAuth, async (req, res) => {
    const data = await storage.prices.getAllDeliveryCosts();
    res.json(data);
  });

  app.post("/api/delivery-costs", requireAuth, async (req, res) => {
    try {
      const data = insertDeliveryCostSchema.parse(req.body);
      const item = await storage.prices.createDeliveryCost(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания тарифа" });
    }
  });

  app.patch("/api/delivery-costs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.prices.updateDeliveryCost(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Тариф не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления тарифа" });
    }
  });

  app.delete("/api/delivery-costs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.prices.deleteDeliveryCost(id);
      res.json({ message: "Тариф удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления тарифа" });
    }
  });
}