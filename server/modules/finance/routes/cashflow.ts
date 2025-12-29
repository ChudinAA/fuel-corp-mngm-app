
import type { Express } from "express";
import { requireAuth, requirePermission } from "../../users/routes/auth";
import { logAudit } from "../../audit/middleware/audit-middleware";
import * as storage from "../storage/cashflow-storage";

export function registerCashflowRoutes(app: Express) {
  // Get all cashflow transactions
  app.get("/api/cashflow", requireAuth, requirePermission("finance", "view"), async (req, res) => {
    try {
      const { startDate, endDate, category } = req.query;
      const transactions = await storage.getCashflowTransactions({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        category: category as string | undefined,
      });
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get cashflow summary
  app.get("/api/cashflow/summary", requireAuth, requirePermission("finance", "view"), async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(new Date().setMonth(new Date().getMonth() - 1));
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const summary = await storage.getCashflowSummary(start, end);
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create cashflow transaction
  app.post("/api/cashflow", requireAuth, requirePermission("finance", "create"), logAudit, async (req, res) => {
    try {
      const userId = req.user!.id;
      const transaction = await storage.createCashflowTransaction({
        ...req.body,
        createdById: userId,
      });
      res.status(201).json(transaction);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update cashflow transaction
  app.patch("/api/cashflow/:id", requireAuth, requirePermission("finance", "edit"), logAudit, async (req, res) => {
    try {
      const userId = req.user!.id;
      const updated = await storage.updateCashflowTransaction(req.params.id, {
        ...req.body,
        updatedById: userId,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete cashflow transaction
  app.delete("/api/cashflow/:id", requireAuth, requirePermission("finance", "delete"), logAudit, async (req, res) => {
    try {
      const userId = req.user!.id;
      const deleted = await storage.deleteCashflowTransaction(req.params.id, userId);
      res.json(deleted);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
