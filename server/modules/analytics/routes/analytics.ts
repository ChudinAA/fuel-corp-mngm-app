
import type { Express } from "express";
import { storage } from "../../../storage/index";
import { requireAuth, requirePermission } from "../../../middleware/middleware";

export function registerAnalyticsRoutes(app: Express) {
  // Get analytics data for charts
  app.get(
    "/api/analytics/data",
    requireAuth,
    requirePermission("reports", "view"),
    async (req, res) => {
      try {
        const { startDate, endDate, module, groupBy } = req.query;
        
        if (!startDate || !endDate || !module) {
          return res.status(400).json({ message: "Параметры startDate, endDate и module обязательны" });
        }

        const data = await storage.analytics.getAnalyticsData(
          startDate as string,
          endDate as string,
          module as string,
          (groupBy as 'day' | 'week' | 'month') || 'day'
        );
        
        res.json(data);
      } catch (error) {
        console.error("Error fetching analytics data:", error);
        res.status(500).json({ message: "Ошибка получения аналитических данных" });
      }
    }
  );

  // Get analytics summary
  app.get(
    "/api/analytics/summary",
    requireAuth,
    requirePermission("reports", "view"),
    async (req, res) => {
      try {
        const { startDate, endDate, module } = req.query;
        
        if (!startDate || !endDate || !module) {
          return res.status(400).json({ message: "Параметры startDate, endDate и module обязательны" });
        }

        const summary = await storage.analytics.getAnalyticsSummary(
          startDate as string,
          endDate as string,
          module as string
        );
        
        res.json(summary);
      } catch (error) {
        console.error("Error fetching analytics summary:", error);
        res.status(500).json({ message: "Ошибка получения сводки" });
      }
    }
  );

  // Get saved analytics
  app.get(
    "/api/analytics/saved",
    requireAuth,
    requirePermission("reports", "view"),
    async (req, res) => {
      try {
        const userId = req.session.userId!;
        const analytics = await storage.analytics.getSavedAnalytics(userId);
        res.json(analytics);
      } catch (error) {
        console.error("Error fetching saved analytics:", error);
        res.status(500).json({ message: "Ошибка получения сохраненных аналитик" });
      }
    }
  );
}
