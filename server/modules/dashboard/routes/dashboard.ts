import type { Express } from "express";
import { storage } from "../../../storage/index";
import { requireAuth } from "../../../middleware/middleware";

export function registerDashboardRoutes(app: Express) {
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    const stats = await storage.dashboard.getDashboardStats();
    res.json(stats);
  });

  app.get("/api/dashboard/recent-operations", requireAuth, async (req, res) => {
    const operations = await storage.dashboard.getRecentOperations();
    res.json(operations);
  });

  app.get("/api/dashboard/warehouse-stats", requireAuth, async (req, res) => {
    const stats = await storage.warehouses.getWarehouseStatsForDashboard();
    res.json(stats);
  });

  app.get("/api/dashboard/week-stats", requireAuth, async (req, res) => {
    const stats = await storage.dashboard.getWeekStats();
    res.json(stats);
  });
}
