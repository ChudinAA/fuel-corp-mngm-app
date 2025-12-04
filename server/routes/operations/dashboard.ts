
import type { Express } from "express";
import { storage } from "../../storage";
import { requireAuth } from "../middleware";

export function registerDashboardRoutes(app: Express) {
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    const stats = await storage.operations.getDashboardStats();
    res.json(stats);
  });
}
