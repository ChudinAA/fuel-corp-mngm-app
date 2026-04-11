import type { Express } from "express";
import { storage } from "../../../storage/index";
import {
  insertExchangeAdvanceCardSchema,
  insertExchangeAdvanceTransactionSchema,
} from "../entities/exchange-advances";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";

export function registerExchangeAdvancesRoutes(app: Express) {
  // ===== CARDS =====

  app.get(
    "/api/exchange-advances",
    requireAuth,
    requirePermission("exchange-advances", "view"),
    async (req, res) => {
      try {
        const data = await storage.exchangeAdvances.getAllCards();
        res.json(data);
      } catch (error: any) {
        console.error("Error fetching exchange advance cards:", error);
        res.status(500).json({ message: "Ошибка получения авансовых карт биржи" });
      }
    },
  );

  app.get(
    "/api/exchange-advances/by-seller",
    requireAuth,
    requirePermission("exchange-advances", "view"),
    async (req, res) => {
      try {
        const { sellerId } = req.query as { sellerId?: string };
        if (!sellerId) return res.json(null);
        const card = await storage.exchangeAdvances.getCardBySeller(sellerId);
        res.json(card || null);
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка получения карты продавца" });
      }
    },
  );

  app.get(
    "/api/exchange-advances/:id",
    requireAuth,
    requirePermission("exchange-advances", "view"),
    async (req, res) => {
      try {
        const card = await storage.exchangeAdvances.getCard(req.params.id);
        if (!card) return res.status(404).json({ message: "Карта не найдена" });
        res.json(card);
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка получения карты" });
      }
    },
  );

  app.post(
    "/api/exchange-advances",
    requireAuth,
    requirePermission("exchange-advances", "create"),
    auditLog({
      entityType: ENTITY_TYPES.EXCHANGE_ADVANCE,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const data = insertExchangeAdvanceCardSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const card = await storage.exchangeAdvances.createCard(data);
        res.status(201).json(card);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({ message: "Ошибка создания карты аванса" });
      }
    },
  );

  app.patch(
    "/api/exchange-advances/:id",
    requireAuth,
    requirePermission("exchange-advances", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.EXCHANGE_ADVANCE,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => storage.exchangeAdvances.getCard(req.params.id),
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const card = await storage.exchangeAdvances.updateCard(
          req.params.id,
          req.body,
          req.session.userId,
        );
        if (!card) return res.status(404).json({ message: "Карта не найдена" });
        res.json(card);
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка обновления карты" });
      }
    },
  );

  app.delete(
    "/api/exchange-advances/:id",
    requireAuth,
    requirePermission("exchange-advances", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.EXCHANGE_ADVANCE,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => storage.exchangeAdvances.getCard(req.params.id),
    }),
    async (req, res) => {
      try {
        const success = await storage.exchangeAdvances.deleteCard(
          req.params.id,
          req.session.userId,
        );
        if (!success) return res.status(404).json({ message: "Карта не найдена" });
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка удаления карты" });
      }
    },
  );

  // ===== TRANSACTIONS =====

  app.get(
    "/api/exchange-advances/:id/transactions",
    requireAuth,
    requirePermission("exchange-advances", "view"),
    async (req, res) => {
      try {
        const transactions = await storage.exchangeAdvances.getTransactions(req.params.id);
        res.json(transactions);
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка получения транзакций" });
      }
    },
  );

  app.post(
    "/api/exchange-advances/:id/transactions",
    requireAuth,
    requirePermission("exchange-advances", "create"),
    async (req, res) => {
      try {
        const data = insertExchangeAdvanceTransactionSchema.parse({
          ...req.body,
          cardId: req.params.id,
          createdById: req.session.userId,
        });
        const transaction = await storage.exchangeAdvances.createTransaction(data);
        res.status(201).json(transaction);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({ message: "Ошибка создания транзакции" });
      }
    },
  );

  app.delete(
    "/api/exchange-advances/transactions/:txnId",
    requireAuth,
    requirePermission("exchange-advances", "delete"),
    async (req, res) => {
      try {
        const success = await storage.exchangeAdvances.deleteTransaction(
          req.params.txnId,
          req.session.userId,
        );
        if (!success) return res.status(404).json({ message: "Транзакция не найдена" });
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка удаления транзакции" });
      }
    },
  );
}
