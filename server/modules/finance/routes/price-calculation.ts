
import type { Express } from "express";
import { requireAuth, requirePermission } from "../../users/routes/auth";
import { logAudit } from "../../audit/middleware/audit-middleware";
import { storage } from "../../../storage/index";

export function registerPriceCalculationRoutes(app: Express) {
  // Get all price calculations
  app.get("/api/price-calculations", requireAuth, requirePermission("finance", "view"), async (req, res) => {
    try {
      const { productType, isTemplate } = req.query;
      const calculations = await storage.priceCalculations.getPriceCalculations({
        productType: productType as string | undefined,
        isTemplate: isTemplate === 'true' ? true : isTemplate === 'false' ? false : undefined,
      });
      res.json(calculations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get price calculation by ID
  app.get("/api/price-calculations/:id", requireAuth, requirePermission("finance", "view"), async (req, res) => {
    try {
      const calculation = await storage.priceCalculations.getPriceCalculation(req.params.id);
      if (!calculation) {
        return res.status(404).json({ message: "Расчет не найден" });
      }
      res.json(calculation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create price calculation
  app.post("/api/price-calculations", requireAuth, requirePermission("finance", "create"), logAudit, async (req, res) => {
    try {
      const userId = req.user!.id;
      const calculation = await storage.priceCalculations.createPriceCalculation({
        ...req.body,
        createdById: userId,
      });
      res.status(201).json(calculation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update price calculation
  app.patch("/api/price-calculations/:id", requireAuth, requirePermission("finance", "edit"), logAudit, async (req, res) => {
    try {
      const userId = req.user!.id;
      const updated = await storage.priceCalculations.updatePriceCalculation(req.params.id, {
        ...req.body,
        updatedById: userId,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete price calculation
  app.delete("/api/price-calculations/:id", requireAuth, requirePermission("finance", "delete"), logAudit, async (req, res) => {
    try {
      const userId = req.user!.id;
      const deleted = await storage.priceCalculations.deletePriceCalculation(req.params.id, userId);
      res.json(deleted);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
