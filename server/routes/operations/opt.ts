
import type { Express } from "express";
import { storage } from "../../storage/index";
import { insertOptSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth } from "../middleware";

export function registerOptRoutes(app: Express) {
  app.get("/api/opt", requireAuth, async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const result = await storage.operations.getOptDeals(page, pageSize);
    res.json(result);
  });

  app.post("/api/opt", requireAuth, async (req, res) => {
    try {
      const body = { ...req.body };
      
      console.log("=== POST /api/opt - Original body ===", JSON.stringify(body, null, 2));
      
      // Преобразуем числовые поля из строк в числа
      if (body.quantityKg !== null && body.quantityKg !== undefined) body.quantityKg = parseFloat(body.quantityKg);
      if (body.quantityLiters !== null && body.quantityLiters !== undefined) body.quantityLiters = parseFloat(body.quantityLiters);
      if (body.density !== null && body.density !== undefined) body.density = parseFloat(body.density);
      if (body.purchasePrice !== null && body.purchasePrice !== undefined) body.purchasePrice = parseFloat(body.purchasePrice);
      if (body.salePrice !== null && body.salePrice !== undefined) body.salePrice = parseFloat(body.salePrice);
      if (body.purchaseAmount !== null && body.purchaseAmount !== undefined) body.purchaseAmount = parseFloat(body.purchaseAmount);
      if (body.saleAmount !== null && body.saleAmount !== undefined) body.saleAmount = parseFloat(body.saleAmount);
      if (body.deliveryCost !== null && body.deliveryCost !== undefined) body.deliveryCost = parseFloat(body.deliveryCost);
      if (body.deliveryTariff !== null && body.deliveryTariff !== undefined) body.deliveryTariff = parseFloat(body.deliveryTariff);
      if (body.profit !== null && body.profit !== undefined) body.profit = parseFloat(body.profit);
      
      const dataToValidate = {
        ...body,
        createdById: req.session.userId,
        warehouseStatus: "OK",
        priceStatus: "OK",
      };
      
      console.log("=== POST /api/opt - Data to validate ===", JSON.stringify(dataToValidate, null, 2));
      
      const data = insertOptSchema.parse(dataToValidate);
      const item = await storage.operations.createOpt(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("=== Zod Validation Error ===", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: error.errors[0].message, errors: error.errors });
      }
      console.error("=== Server Error ===", error);
      res.status(500).json({ message: "Ошибка создания сделки" });
    }
  });

  app.patch("/api/opt/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const body = { ...req.body };
      
      // Преобразуем числовые поля из строк в числа
      if (body.quantityKg) body.quantityKg = parseFloat(body.quantityKg);
      if (body.quantityLiters) body.quantityLiters = parseFloat(body.quantityLiters);
      if (body.density) body.density = parseFloat(body.density);
      if (body.purchasePrice) body.purchasePrice = parseFloat(body.purchasePrice);
      if (body.salePrice) body.salePrice = parseFloat(body.salePrice);
      if (body.purchaseAmount) body.purchaseAmount = parseFloat(body.purchaseAmount);
      if (body.saleAmount) body.saleAmount = parseFloat(body.saleAmount);
      if (body.deliveryCost) body.deliveryCost = parseFloat(body.deliveryCost);
      if (body.deliveryTariff) body.deliveryTariff = parseFloat(body.deliveryTariff);
      if (body.profit) body.profit = parseFloat(body.profit);
      
      const item = await storage.operations.updateOpt(id, body);
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
      await storage.operations.deleteOpt(id);
      res.json({ message: "Сделка удалена" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления сделки" });
    }
  });
}
