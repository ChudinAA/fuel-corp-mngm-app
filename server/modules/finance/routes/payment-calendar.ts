
import type { Express } from "express";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { logAudit } from "../../audit/middleware/audit-middleware";
import { storage } from "../../../storage/index";

export function registerPaymentCalendarRoutes(app: Express) {
  // Get all payment calendar items
  app.get("/api/payment-calendar", requireAuth, requirePermission("finance", "view"), async (req, res) => {
    try {
      const { startDate, endDate, status, category } = req.query;
      const items = await storage.payments.getPaymentCalendarItems({
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        status: status as string | undefined,
        category: category as string | undefined,
      });
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get upcoming payments
  app.get("/api/payment-calendar/upcoming", requireAuth, requirePermission("finance", "view"), async (req, res) => {
    try {
      const daysAhead = req.query.days ? parseInt(req.query.days as string) : 7;
      const upcoming = await storage.payments.getUpcomingPayments(daysAhead);
      res.json(upcoming);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create payment calendar item
  app.post("/api/payment-calendar", requireAuth, requirePermission("finance", "create"), logAudit, async (req, res) => {
    try {
      const userId = req.user!.id;
      const item = await storage.payments.createPaymentCalendarItem({
        ...req.body,
        createdById: userId,
      });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update payment calendar item
  app.patch("/api/payment-calendar/:id", requireAuth, requirePermission("finance", "edit"), logAudit, async (req, res) => {
    try {
      const userId = req.user!.id;
      const updated = await storage.payments.updatePaymentCalendarItem(req.params.id, {
        ...req.body,
        updatedById: userId,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete payment calendar item
  app.delete("/api/payment-calendar/:id", requireAuth, requirePermission("finance", "delete"), logAudit, async (req, res) => {
    try {
      const userId = req.user!.id;
      const deleted = await storage.payments.deletePaymentCalendarItem(req.params.id, userId);
      res.json(deleted);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
