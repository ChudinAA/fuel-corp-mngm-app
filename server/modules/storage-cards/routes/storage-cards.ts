import type { Express } from "express";
import { storage } from "../../../storage/index";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";
import {
  insertStorageCardSchema,
  insertStorageCardTransactionSchema,
} from "../entities/storage-cards";

export function registerStorageCardsRoutes(app: Express) {
  app.get(
    "/api/storage-cards",
    requireAuth,
    requirePermission("storage-cards", "view"),
    async (req, res) => {
      try {
        const data = await storage.storageCards.getAllStorageCards();
        res.json(data);
      } catch (error: any) {
        console.error("Error fetching storage cards:", error);
        res.status(500).json({ message: "Ошибка получения карт хранения" });
      }
    }
  );

  app.get(
    "/api/storage-cards/:id",
    requireAuth,
    requirePermission("storage-cards", "view"),
    async (req, res) => {
      try {
        const card = await storage.storageCards.getStorageCard(req.params.id);
        if (!card) {
          return res.status(404).json({ message: "Карта хранения не найдена" });
        }
        res.json(card);
      } catch (error: any) {
        console.error("Error fetching storage card:", error);
        res.status(500).json({ message: "Ошибка получения карты хранения" });
      }
    }
  );

  app.post(
    "/api/storage-cards",
    requireAuth,
    requirePermission("storage-cards", "create"),
    auditLog({
      entityType: ENTITY_TYPES.STORAGE_CARD,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const validatedData = insertStorageCardSchema.parse(req.body);
        const data = {
          ...validatedData,
          createdById: req.session.userId,
        };

        const item = await storage.storageCards.createStorageCard(data);
        res.status(201).json(item);
      } catch (error: any) {
        console.error("Storage card creation error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        if (error.message?.includes("уже существует")) {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({
          message: "Ошибка создания карты хранения",
          error: error.message,
        });
      }
    }
  );

  app.patch(
    "/api/storage-cards/:id",
    requireAuth,
    requirePermission("storage-cards", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.STORAGE_CARD,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        return await storage.storageCards.getStorageCard(req.params.id);
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

        const item = await storage.storageCards.updateStorageCard(id, updateData);
        if (!item) {
          return res.status(404).json({ message: "Карта хранения не найдена" });
        }
        res.json(item);
      } catch (error: any) {
        console.error("Storage card update error:", error);
        res.status(500).json({
          message: "Ошибка обновления карты хранения",
          error: error.message,
        });
      }
    }
  );

  app.delete(
    "/api/storage-cards/:id",
    requireAuth,
    requirePermission("storage-cards", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.STORAGE_CARD,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        return await storage.storageCards.getStorageCard(req.params.id);
      },
    }),
    async (req, res) => {
      try {
        const success = await storage.storageCards.deleteStorageCard(
          req.params.id,
          req.session.userId
        );
        if (!success) {
          return res.status(404).json({ message: "Карта хранения не найдена" });
        }
        res.json({ success: true });
      } catch (error: any) {
        console.error("Storage card delete error:", error);
        res.status(500).json({
          message: "Ошибка удаления карты хранения",
          error: error.message,
        });
      }
    }
  );

  app.get(
    "/api/storage-cards/:id/transactions",
    requireAuth,
    requirePermission("storage-cards", "view"),
    async (req, res) => {
      try {
        const transactions = await storage.storageCards.getCardTransactions(
          req.params.id
        );
        res.json(transactions);
      } catch (error: any) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({ message: "Ошибка получения транзакций" });
      }
    }
  );

  app.post(
    "/api/storage-cards/:id/transactions",
    requireAuth,
    requirePermission("storage-cards", "create"),
    auditLog({
      entityType: ENTITY_TYPES.STORAGE_CARD,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        return await storage.storageCards.getStorageCard(req.params.id);
      },
      getNewData: (req) => ({ ...req.body, type: "transaction" }),
    }),
    async (req, res) => {
      try {
        const validatedData = insertStorageCardTransactionSchema.parse({
          ...req.body,
          storageCardId: req.params.id,
        });
        const data = {
          ...validatedData,
          createdById: req.session.userId,
        };

        const transaction = await storage.storageCards.createTransaction(data);
        res.status(201).json(transaction);
      } catch (error: any) {
        console.error("Transaction creation error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({
          message: "Ошибка создания транзакции",
          error: error.message,
        });
      }
    }
  );

  app.delete(
    "/api/storage-cards/transactions/:id",
    requireAuth,
    requirePermission("storage-cards", "delete"),
    async (req, res) => {
      try {
        const success = await storage.storageCards.deleteTransaction(
          req.params.id,
          req.session.userId
        );
        if (!success) {
          return res.status(404).json({ message: "Транзакция не найдена" });
        }
        res.json({ success: true });
      } catch (error: any) {
        console.error("Transaction delete error:", error);
        res.status(500).json({
          message: "Ошибка удаления транзакции",
          error: error.message,
        });
      }
    }
  );
}
