
import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertMonthlyPlanSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";

export function registerMonthlyPlanRoutes(app: Express) {
  // Get monthly plans
  app.get(
    "/api/monthly-plan",
    requireAuth,
    requirePermission("monthly_plan", "view"),
    async (req, res) => {
      try {
        const filters = {
          planMonth: req.query.planMonth as string | undefined,
          planType: req.query.planType as string | undefined,
          baseId: req.query.baseId as string | undefined,
        };
        const plans = await storage.monthlyPlan.getMonthlyPlans(filters);
        res.json(plans);
      } catch (error) {
        console.error("Error fetching monthly plans:", error);
        res.status(500).json({ message: "Ошибка получения ежемесячных планов" });
      }
    }
  );

  // Get single monthly plan
  app.get(
    "/api/monthly-plan/:id",
    requireAuth,
    requirePermission("monthly_plan", "view"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const plan = await storage.monthlyPlan.getMonthlyPlan(id);
        if (!plan) {
          return res.status(404).json({ message: "План не найден" });
        }
        res.json(plan);
      } catch (error) {
        console.error("Error fetching monthly plan:", error);
        res.status(500).json({ message: "Ошибка получения плана" });
      }
    }
  );



  // Get plan vs actual comparison
  app.get("/api/monthly-plans/:id/vs-actual", requireAuth, requirePermission("reports", "view"), async (req, res) => {
    try {
      const comparison = await storage.monthlyPlan.getPlanVsActual(req.params.id);
      res.json(comparison);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Copy plan to new month
  app.post("/api/monthly-plans/:id/copy", requireAuth, requirePermission("reports", "create"), logAudit, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { targetMonth } = req.body;
      
      if (!targetMonth) {
        return res.status(400).json({ message: "Target month is required" });
      }

      const newPlan = await storage.monthlyPlan.copyPlan(req.params.id, targetMonth, userId);
      res.status(201).json(newPlan);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create monthly plan
  app.post(
    "/api/monthly-plan",
    requireAuth,
    requirePermission("monthly_plan", "create"),
    async (req, res) => {
      try {
        const data = insertMonthlyPlanSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const plan = await storage.monthlyPlan.createMonthlyPlan(data);
        res.status(201).json(plan);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Error creating monthly plan:", error);
        res.status(500).json({ message: "Ошибка создания плана" });
      }
    }
  );

  // Update monthly plan
  app.patch(
    "/api/monthly-plan/:id",
    requireAuth,
    requirePermission("monthly_plan", "edit"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const plan = await storage.monthlyPlan.updateMonthlyPlan(id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!plan) {
          return res.status(404).json({ message: "План не найден" });
        }
        res.json(plan);
      } catch (error) {
        console.error("Error updating monthly plan:", error);
        res.status(500).json({ message: "Ошибка обновления плана" });
      }
    }
  );

  // Delete monthly plan
  app.delete(
    "/api/monthly-plan/:id",
    requireAuth,
    requirePermission("monthly_plan", "delete"),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.monthlyPlan.deleteMonthlyPlan(id, req.session.userId);
        res.json({ message: "План удален" });
      } catch (error) {
        console.error("Error deleting monthly plan:", error);
        res.status(500).json({ message: "Ошибка удаления плана" });
      }
    }
  );
}
