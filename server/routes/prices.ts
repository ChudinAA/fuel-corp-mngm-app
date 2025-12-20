import type { Express, Request, Response } from "express";
import { storage } from "../storage/index";
import { insertPriceSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth } from "./middleware";
import { COUNTERPARTY_TYPE, COUNTERPARTY_ROLE } from "@shared/constants";

export function registerPricesRoutes(app: Express) {

  app.get("/api/prices", requireAuth, requirePermission("prices", "view"), async (req, res) => {
    const { counterpartyRole, counterpartyType } = req.query;
    if (counterpartyRole && counterpartyType) {
      const data = await storage.prices.getPricesByRole(counterpartyRole as string, counterpartyType as string);
      return res.json(data);
    }
    const data = await storage.prices.getAllPrices();
    res.json(data);
  });

  app.post("/api/prices", requireAuth, requirePermission("prices", "create"), async (req, res) => {
    try {
      const body = req.body;
      const processedData = {
        ...body,
        priceValues: body.priceValues?.map((pv: { price: string }) => JSON.stringify({ price: parseFloat(pv.price) })),
        volume: body.volume ? String(body.volume) : null,
        counterpartyId: body.counterpartyId,
        notes: body.notes || null,
        createdById: req.session.userId,
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

  app.patch("/api/prices/:id", requireAuth, requirePermission("prices", "edit"), async (req, res) => {
    try {
      const id = req.params.id;
      const body = req.body;

      // Process priceValues if they exist
      const processedData = {
        ...body,
        priceValues: body.priceValues?.map((pv: { price: string }) => JSON.stringify({ price: parseFloat(pv.price) })),
        volume: body.volume ? String(body.volume) : null,
        notes: body.notes || null,
        updatedById: req.session.userId,
      };

      const item = await storage.prices.updatePrice(id, processedData);
      if (!item) {
        return res.status(404).json({ message: "Цена не найдена" });
      }
      res.json(item);
    } catch (error) {
      console.error("Price update error:", error);
      res.status(500).json({ message: "Ошибка обновления цены" });
    }
  });

  app.delete("/api/prices/:id", requireAuth, requirePermission("prices", "delete"), async (req, res) => {
    try {
      const id = req.params.id;
      await storage.prices.deletePrice(id);
      res.json({ message: "Цена удалена" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления цены" });
    }
  });

  app.get("/api/prices/calculate-selection", requireAuth, requirePermission("prices", "view"), async (req, res) => {
    try {
      const { counterpartyId, counterpartyType, basis, dateFrom, dateTo, priceId } = req.query;

      if (!counterpartyId || !counterpartyType || !basis || !dateFrom || !dateTo) {
        return res.status(400).json({ message: "Не указаны обязательные параметры" });
      }

      const totalVolume = await storage.prices.calculatePriceSelection(
        counterpartyId as string,
        counterpartyType as string,
        basis as string,
        dateFrom as string,
        dateTo as string,
        priceId as string | undefined
      );

      res.json({ totalVolume: totalVolume.toFixed(2) });
    } catch (error) {
      console.error("Selection calculation error:", error);
      res.status(500).json({ message: "Ошибка расчета выборки" });
    }
  });

  app.get("/api/prices/check-date-overlaps", requireAuth, requirePermission("prices", "view"), async (req, res) => {
    const { counterpartyId, counterpartyType, counterpartyRole, basis, productType, dateFrom, dateTo, excludeId } = req.query;
    const result = await storage.prices.checkPriceDateOverlaps(
      String(counterpartyId),
      String(counterpartyType),
      String(counterpartyRole),
      String(basis),
      String(productType),
      String(dateFrom),
      String(dateTo),
      excludeId ? String(excludeId) : undefined
    );
    res.json(result);
  });

}