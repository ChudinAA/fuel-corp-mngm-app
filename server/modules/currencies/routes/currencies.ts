import type { Express } from "express";
import { storage } from "../../../storage/index";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { insertCurrencySchema } from "../entities/currencies";

export function registerCurrenciesRoutes(app: Express) {
  app.get(
    "/api/currencies",
    requireAuth,
    async (req, res) => {
      try {
        const data = await storage.currencies.getActiveCurrencies();
        res.json(data);
      } catch (error: any) {
        console.error("Error fetching currencies:", error);
        res.status(500).json({ message: "Ошибка получения списка валют" });
      }
    }
  );

  app.get(
    "/api/currencies/all",
    requireAuth,
    requirePermission("directories", "view"),
    async (req, res) => {
      try {
        const data = await storage.currencies.getAllCurrencies();
        res.json(data);
      } catch (error: any) {
        console.error("Error fetching all currencies:", error);
        res.status(500).json({ message: "Ошибка получения списка валют" });
      }
    }
  );

  app.get(
    "/api/currencies/:id",
    requireAuth,
    async (req, res) => {
      try {
        const currency = await storage.currencies.getCurrency(req.params.id);
        if (!currency) {
          return res.status(404).json({ message: "Валюта не найдена" });
        }
        res.json(currency);
      } catch (error: any) {
        console.error("Error fetching currency:", error);
        res.status(500).json({ message: "Ошибка получения валюты" });
      }
    }
  );

  app.post(
    "/api/currencies",
    requireAuth,
    requirePermission("directories", "create"),
    async (req, res) => {
      try {
        const validatedData = insertCurrencySchema.parse(req.body);
        const data = {
          ...validatedData,
          createdById: req.session.userId ? String(req.session.userId) : undefined,
        };

        const item = await storage.currencies.createCurrency(data);
        res.status(201).json(item);
      } catch (error: any) {
        console.error("Currency creation error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        if (error.message?.includes("уже существует")) {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({
          message: "Ошибка создания валюты",
          error: error.message,
        });
      }
    }
  );

  app.patch(
    "/api/currencies/:id",
    requireAuth,
    requirePermission("directories", "edit"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const updateData = {
          ...req.body,
          updatedById: req.session.userId ? String(req.session.userId) : undefined,
        };

        const item = await storage.currencies.updateCurrency(id, updateData);
        if (!item) {
          return res.status(404).json({ message: "Валюта не найдена" });
        }
        res.json(item);
      } catch (error: any) {
        console.error("Currency update error:", error);
        res.status(500).json({
          message: "Ошибка обновления валюты",
          error: error.message,
        });
      }
    }
  );

  app.delete(
    "/api/currencies/:id",
    requireAuth,
    requirePermission("directories", "delete"),
    async (req, res) => {
      try {
        const success = await storage.currencies.deleteCurrency(
          req.params.id,
          req.session.userId ? String(req.session.userId) : undefined
        );
        if (!success) {
          return res.status(404).json({ message: "Валюта не найдена" });
        }
        res.json({ success: true });
      } catch (error: any) {
        console.error("Currency delete error:", error);
        res.status(500).json({
          message: "Ошибка удаления валюты",
          error: error.message,
        });
      }
    }
  );
}
