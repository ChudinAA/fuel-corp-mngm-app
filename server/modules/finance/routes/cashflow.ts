import type { Express } from "express";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog } from "../../audit/middleware/audit-middleware";
import { AUDIT_OPERATIONS, ENTITY_TYPES } from "../../audit/entities/audit";
import { storage } from "../../../storage/index";

function normalizeTransactionDate(data: any): any {
  if (typeof data.transactionDate !== "string") return data;

  const transactionDate = new Date(data.transactionDate);
  if (Number.isNaN(transactionDate.getTime())) {
    throw new Error("Некорректная дата денежной операции");
  }
  return { ...data, transactionDate };
}

export function registerCashflowRoutes(app: Express) {
  // Get all cashflow transactions
  app.get(
    "/api/cashflow",
    requireAuth,
    requirePermission("finance", "view"),
    async (req, res) => {
      try {
        const { startDate, endDate, category } = req.query;
        const transactions = await storage.cashflow.getCashflowTransactions({
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          category: category as string | undefined,
        });
        res.json(transactions);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  // Get cashflow summary
  app.get(
    "/api/cashflow/summary",
    requireAuth,
    requirePermission("finance", "view"),
    async (req, res) => {
      try {
        const { startDate, endDate } = req.query;
        const start = startDate
          ? new Date(startDate as string)
          : new Date(new Date().setMonth(new Date().getMonth() - 1));
        const end = endDate ? new Date(endDate as string) : new Date();

        const summary = await storage.cashflow.getCashflowSummary(start, end);
        res.json(summary);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  // Create cashflow transaction
  app.post(
    "/api/cashflow",
    requireAuth,
    requirePermission("finance", "create"),
    auditLog({
      entityType: ENTITY_TYPES.CASHFLOW_TRANSACTION,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const userId = req.session.userId;
        const transaction = await storage.cashflow.createCashflowTransaction({
          ...normalizeTransactionDate(req.body),
          createdById: userId,
        });
        res.status(201).json(transaction);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  // Update cashflow transaction
  app.patch(
    "/api/cashflow/:id",
    requireAuth,
    requirePermission("finance", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.CASHFLOW_TRANSACTION,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => storage.cashflow.getCashflowTransaction(req.params.id),
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const userId = req.session.userId;
        const updated = await storage.cashflow.updateCashflowTransaction(
          req.params.id,
          normalizeTransactionDate({
            ...req.body,
            updatedById: userId,
          }),
        );
        res.json(updated);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  // Delete cashflow transaction
  app.delete(
    "/api/cashflow/:id",
    requireAuth,
    requirePermission("finance", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.CASHFLOW_TRANSACTION,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => storage.cashflow.getCashflowTransaction(req.params.id),
    }),
    async (req, res) => {
      try {
        const userId = req.session.userId;
        const deleted = await storage.cashflow.deleteCashflowTransaction(
          req.params.id,
          userId,
        );
        res.json(deleted);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );
}
