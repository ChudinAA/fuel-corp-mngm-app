import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertPriceSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog, auditView } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";

export function registerPricesRoutes(app: Express) {
  app.get(
    "/api/prices/calculate-selection",
    requireAuth,
    requirePermission("prices", "view"),
    async (req, res) => {
      try {
        const {
          counterpartyId,
          counterpartyType,
          basis,
          dateFrom,
          dateTo,
          priceId,
        } = req.query;

        if (
          !counterpartyId ||
          !counterpartyType ||
          !basis ||
          !dateFrom ||
          !dateTo
        ) {
          return res
            .status(400)
            .json({ message: "Не указаны обязательные параметры" });
        }

        const totalVolume = await storage.prices.calculatePriceSelection(
          counterpartyId as string,
          counterpartyType as string,
          basis as string,
          dateFrom as string,
          dateTo as string,
          priceId as string | undefined,
        );

        res.json({ totalVolume: totalVolume.toFixed(2) });
      } catch (error) {
        console.error("Selection calculation error:", error);
        res.status(500).json({ message: "Ошибка расчета выборки" });
      }
    },
  );

  app.get(
    "/api/prices/check-date-overlaps",
    requireAuth,
    requirePermission("prices", "view"),
    async (req, res) => {
      const {
        counterpartyId,
        counterpartyType,
        counterpartyRole,
        basis,
        productType,
        dateFrom,
        dateTo,
        excludeId,
      } = req.query;
      const result = await storage.prices.checkPriceDateOverlaps(
        String(counterpartyId),
        String(counterpartyType),
        String(counterpartyRole),
        String(basis),
        String(productType),
        String(dateFrom),
        String(dateTo),
        excludeId ? String(excludeId) : undefined,
      );
      res.json(result);
    },
  );

  app.get(
    "/api/prices/find-active",
    requireAuth,
    requirePermission("prices", "view"),
    async (req, res) => {
      try {
        const {
          counterpartyId,
          counterpartyRole,
          counterpartyType,
          basis,
          productType,
          date,
        } = req.query;

        if (
          !counterpartyId ||
          !counterpartyRole ||
          !counterpartyType ||
          !date
        ) {
          return res
            .status(400)
            .json({ message: "Missing required parameters" });
        }

        const data = await storage.prices.findActivePrices({
          counterpartyId: counterpartyId as string,
          counterpartyRole: counterpartyRole as string,
          counterpartyType: counterpartyType as string,
          basis: basis as string,
          productType: productType as string,
          date: date as string,
        });

        res.json(data);
      } catch (error) {
        console.error("Price lookup error:", error);
        res.status(500).json({ message: "Error looking up prices" });
      }
    },
  );

  app.get(
    "/api/prices/list",
    requireAuth,
    requirePermission("prices", "view"),
    async (req, res) => {
      try {
        const {
          counterpartyRole,
          counterpartyType,
          counterpartyId,
          dateFrom,
          dateTo,
          basis,
          productType,
          offset,
          pageSize,
        } = req.query;

        const data = await storage.prices.getAllPrices(
          offset ? parseInt(offset as string) : 0,
          pageSize ? parseInt(pageSize as string) : 20,
          {
            counterpartyRole: counterpartyRole as string,
            counterpartyType: counterpartyType as string,
            counterpartyId: counterpartyId as string,
            dateFrom: dateFrom as string,
            dateTo: dateTo as string,
            basis: basis as string,
            productType: productType as string,
          },
        );
        res.json(data);
      } catch (error) {
        console.error("GetAllPrices error:", error);
        res.status(500).json({ data: [], total: 0, message: "Internal server error" });
      }
    },
  );

  app.get(
    "/api/prices/:id",
    requireAuth,
    requirePermission("prices", "view"),
    async (req, res) => {
      const id = req.params.id;
      const price = await storage.prices.getPrice(id);
      if (!price) {
        return res.status(404).json({ message: "Цена не найдена" });
      }
      res.json(price);
    },
  );

  app.post(
    "/api/prices",
    requireAuth,
    requirePermission("prices", "create"),
    auditLog({
      entityType: ENTITY_TYPES.PRICE,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const body = req.body;

        if (!body.volume) {
          return res.status(400).json({ message: "Укажите объем по договору" });
        }

        // Валидация пересечения дат перед созданием
        const overlapResult = await storage.prices.checkPriceDateOverlaps(
          String(body.counterpartyId),
          String(body.counterpartyType),
          String(body.counterpartyRole),
          String(body.basis),
          String(body.productType),
          String(body.dateFrom),
          String(body.dateTo),
        );

        if (overlapResult.status === "error") {
          return res.status(400).json({ message: overlapResult.message });
        }

        const processedData = {
          ...body,
          priceValues: body.priceValues?.map((pv: { price: string }) =>
            JSON.stringify({ price: parseFloat(pv.price) }),
          ),
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
    },
  );

  app.patch(
    "/api/prices/:id",
    requireAuth,
    requirePermission("prices", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.PRICE,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        const prices = await storage.prices.getAllPrices();
        return prices.find((p) => p.id === req.params.id);
      },
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        const body = req.body;

        // Валидация пересечения дат перед обновлением
        if (body.dateFrom && body.dateTo) {
          const currentPrice = await storage.prices.getPrice(id);
          if (currentPrice) {
            const overlapResult = await storage.prices.checkPriceDateOverlaps(
              String(body.counterpartyId || currentPrice.counterpartyId),
              String(body.counterpartyType || currentPrice.counterpartyType),
              String(body.counterpartyRole || currentPrice.counterpartyRole),
              String(body.basis || currentPrice.basis),
              String(body.productType || currentPrice.productType),
              String(body.dateFrom),
              String(body.dateTo),
              String(id),
            );

            if (overlapResult.status === "error") {
              return res.status(400).json({
                message:
                  overlapResult.status === "error"
                    ? overlapResult.message
                    : undefined,
              });
            }
          }
        }

        // Process priceValues if they exist
        const processedData = {
          ...body,
          priceValues: body.priceValues?.map((pv: { price: string }) =>
            JSON.stringify({ price: parseFloat(pv.price) }),
          ),
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
    },
  );

  app.delete(
    "/api/prices/:id",
    requireAuth,
    requirePermission("prices", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.PRICE,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        const prices = await storage.prices.getAllPrices();
        return prices.find((p) => p.id === req.params.id);
      },
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.prices.deletePrice(id, req.session.userId);
        res.json({ message: "Цена удалена" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления цены" });
      }
    },
  );
}
