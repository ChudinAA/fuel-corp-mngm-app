import type { Express } from "express";
import { storage } from "../../../storage/index";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";
import { insertExchangeRateSchema } from "../entities/exchange-rates";

export function registerExchangeRatesRoutes(app: Express) {
  app.get(
    "/api/exchange-rates",
    requireAuth,
    requirePermission("directories", "view"),
    async (req, res) => {
      try {
        const data = await storage.exchangeRates.getAllExchangeRates();
        res.json(data);
      } catch (error: any) {
        console.error("Error fetching exchange rates:", error);
        res.status(500).json({ message: "Ошибка получения курсов валют" });
      }
    }
  );

  app.get(
    "/api/exchange-rates/latest/:currency",
    requireAuth,
    async (req, res) => {
      try {
        const { currency } = req.params;
        const targetCurrency = String(req.query.targetCurrency || "RUB");
        const rate = await storage.exchangeRates.getLatestRateByCurrencyPair(currency, targetCurrency);
        if (!rate) {
          return res.status(404).json({ message: "Курс не найден" });
        }
        res.json(rate);
      } catch (error: any) {
        console.error("Error fetching latest rate:", error);
        res.status(500).json({ message: "Ошибка получения курса" });
      }
    }
  );

  app.get(
    "/api/exchange-rates/by-date",
    requireAuth,
    async (req, res) => {
      try {
        const { currency, date, targetCurrency } = req.query;
        if (!currency || !date) {
          return res.status(400).json({ message: "Требуется указать валюту и дату" });
        }
        const target = String(targetCurrency || "RUB");
        const rate = await storage.exchangeRates.getRateByDateAndCurrencyPair(
          String(currency),
          target,
          String(date)
        );
        if (!rate) {
          return res.status(404).json({ message: "Курс не найден" });
        }
        res.json(rate);
      } catch (error: any) {
        console.error("Error fetching rate by date:", error);
        res.status(500).json({ message: "Ошибка получения курса" });
      }
    }
  );

  app.get(
    "/api/exchange-rates/:id",
    requireAuth,
    requirePermission("directories", "view"),
    async (req, res) => {
      try {
        const rate = await storage.exchangeRates.getExchangeRate(req.params.id);
        if (!rate) {
          return res.status(404).json({ message: "Курс не найден" });
        }
        res.json(rate);
      } catch (error: any) {
        console.error("Error fetching exchange rate:", error);
        res.status(500).json({ message: "Ошибка получения курса" });
      }
    }
  );

  app.post(
    "/api/exchange-rates",
    requireAuth,
    requirePermission("directories", "create"),
    auditLog({
      entityType: ENTITY_TYPES.EXCHANGE_RATE,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const validatedData = insertExchangeRateSchema.parse(req.body);
        
        const baseCurrency = await storage.currencies.getCurrencyByCode(validatedData.currency);
        if (!baseCurrency) {
          return res.status(400).json({ message: `Валюта ${validatedData.currency} не найдена в справочнике` });
        }
        
        const targetCurrency = await storage.currencies.getCurrencyByCode(validatedData.targetCurrency);
        if (!targetCurrency) {
          return res.status(400).json({ message: `Валюта ${validatedData.targetCurrency} не найдена в справочнике` });
        }

        if (validatedData.currency === validatedData.targetCurrency) {
          return res.status(400).json({ message: "Базовая и целевая валюты должны отличаться" });
        }
        
        const data = {
          ...validatedData,
          createdById: req.session.userId ? String(req.session.userId) : undefined,
        };

        const item = await storage.exchangeRates.createExchangeRate(data);
        res.status(201).json(item);
      } catch (error: any) {
        console.error("Exchange rate creation error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        if (error.message?.includes("уже существует")) {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({
          message: "Ошибка создания курса валюты",
          error: error.message,
        });
      }
    }
  );

  app.patch(
    "/api/exchange-rates/:id",
    requireAuth,
    requirePermission("directories", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.EXCHANGE_RATE,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        return await storage.exchangeRates.getExchangeRate(req.params.id);
      },
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        const updateData = {
          ...req.body,
          updatedById: req.session.userId,
        };

        const item = await storage.exchangeRates.updateExchangeRate(id, updateData);
        if (!item) {
          return res.status(404).json({ message: "Курс не найден" });
        }
        res.json(item);
      } catch (error: any) {
        console.error("Exchange rate update error:", error);
        res.status(500).json({
          message: "Ошибка обновления курса валюты",
          error: error.message,
        });
      }
    }
  );

  app.delete(
    "/api/exchange-rates/:id",
    requireAuth,
    requirePermission("directories", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.EXCHANGE_RATE,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        return await storage.exchangeRates.getExchangeRate(req.params.id);
      },
    }),
    async (req, res) => {
      try {
        const success = await storage.exchangeRates.deleteExchangeRate(
          req.params.id,
          req.session.userId ? String(req.session.userId) : undefined
        );
        if (!success) {
          return res.status(404).json({ message: "Курс не найден" });
        }
        res.json({ success: true });
      } catch (error: any) {
        console.error("Exchange rate delete error:", error);
        res.status(500).json({
          message: "Ошибка удаления курса валюты",
          error: error.message,
        });
      }
    }
  );
}
