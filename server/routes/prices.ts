import type { Express } from "express";
import { storage } from "../storage/index";
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
        counterpartyId: body.counterpartyId, // Оставляем как есть, это уже UUID строка
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
      const id = req.params.id;
      const body = req.body;

      // Process priceValues if they exist
      const processedData = {
        ...body,
        priceValues: body.priceValues?.map((pv: { price: string }) => JSON.stringify({ price: parseFloat(pv.price) })),
        volume: body.volume ? String(body.volume) : null,
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

  app.delete("/api/prices/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
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
        counterpartyId as string,
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
        counterpartyId as string,
        counterpartyType as string,
        counterpartyRole as string,
        basis as string,
        dateFrom as string,
        dateTo as string,
        excludeId as string | undefined
      );

      res.json(result);
    } catch (error) {
      console.error("Date overlap check error:", error);
      res.status(500).json({ message: "Ошибка проверки дат" });
    }
  });

  // ============ DELIVERY COST ROUTES ============

  // Получить все тарифы доставки
  app.get("/api/delivery-costs", requireAuth, async (req: Request, res: Response) => {
    try {
      const costs = await db.select().from(deliveryCost);
      res.json(costs);
    } catch (error) {
      console.error("Error fetching delivery costs:", error);
      res.status(500).json({ message: "Ошибка получения тарифов доставки" });
    }
  });

  // Создать тариф доставки
  app.post("/api/delivery-costs", requireAuth, async (req: Request, res: Response) => {
    try {
      const data = insertDeliveryCostSchema.parse(req.body);

      const [created] = await db.insert(deliveryCost).values({
        carrierId: data.carrierId,
        fromEntityType: data.fromEntityType,
        fromEntityId: data.fromEntityId,
        fromLocation: data.fromLocation,
        toEntityType: data.toEntityType,
        toEntityId: data.toEntityId,
        toLocation: data.toLocation,
        costPerKg: data.costPerKg,
        distance: data.distance || null,
      }).returning();

      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error creating delivery cost:", error);
      res.status(500).json({ message: "Ошибка создания тарифа доставки" });
    }
  });

  // Обновить тариф доставки
  app.patch("/api/delivery-costs/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const data = insertDeliveryCostSchema.partial().parse(req.body);

      const [updated] = await db.update(deliveryCost)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(deliveryCost.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Тариф доставки не найден" });
      }

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error updating delivery cost:", error);
      res.status(500).json({ message: "Ошибка обновления тарифа доставки" });
    }
  });

  // Удалить тариф доставки
  app.delete("/api/delivery-costs/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      await db.delete(deliveryCost).where(eq(deliveryCost.id, id));
      res.json({ message: "Тариф доставки удален" });
    } catch (error) {
      console.error("Error deleting delivery cost:", error);
      res.status(500).json({ message: "Ошибка удаления тарифа доставки" });
    }
  });

}