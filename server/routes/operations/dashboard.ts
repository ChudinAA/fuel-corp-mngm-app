
import type { Express } from "express";
import { storage } from "../../storage/index";
import { requireAuth } from "../middleware";

export function registerDashboardRoutes(app: Express) {
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    const stats = await storage.operations.getDashboardStats();
    res.json(stats);
  });

  app.get("/api/dashboard/recent-operations", requireAuth, async (req, res) => {
    const operations = await storage.operations.getRecentOperations();
    res.json(operations);
  });

  app.get("/api/dashboard/warehouse-stats", requireAuth, async (req, res) => {
    const stats = await storage.operations.getWarehouseStatsForDashboard();
    res.json(stats);
  });

  app.get("/api/dashboard/week-stats", requireAuth, async (req, res) => {
    const stats = await storage.operations.getWeekStats();
    res.json(stats);
  });
}
