
import type { Express } from "express";
import { storage } from "../../../storage/index";
import { requireAuth } from "../../../middleware/middleware";

export function registerDashboardRoutes(app: Express) {
  // Старые endpoints (для совместимости)
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

  // ============ НОВЫЕ ENDPOINTS ДЛЯ ВИДЖЕТОВ ============

  // Получить доступные виджеты для пользователя
  app.get("/api/dashboard/widgets/available", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user || !user.role) {
        return res.status(401).json({ message: "Не авторизован" });
      }

      // Получаем права пользователя из роли
      const userPermissions = user.role.permissions || {};
      const permissionsArray: string[] = [];
      
      // Преобразуем объект прав в массив строк формата "module.action"
      Object.entries(userPermissions).forEach(([module, actions]) => {
        if (typeof actions === 'object' && actions !== null) {
          Object.entries(actions).forEach(([action, hasPermission]) => {
            if (hasPermission) {
              permissionsArray.push(`${module}.${action}`);
            }
          });
        }
      });

      const widgets = await storage.dashboard.getAvailableWidgets(permissionsArray);
      res.json(widgets);
    } catch (error) {
      console.error("Error fetching available widgets:", error);
      res.status(500).json({ message: "Ошибка получения виджетов" });
    }
  });

  // Получить конфигурацию дашборда пользователя
  app.get("/api/dashboard/configuration", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Не авторизован" });
      }

      const config = await storage.dashboard.getUserDashboard(user.id);
      res.json(config);
    } catch (error) {
      console.error("Error fetching dashboard configuration:", error);
      res.status(500).json({ message: "Ошибка получения конфигурации" });
    }
  });

  // Сохранить конфигурацию дашборда
  app.post("/api/dashboard/configuration", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Не авторизован" });
      }

      const { layout, widgets } = req.body;
      if (!layout || !widgets) {
        return res.status(400).json({ message: "Неверные данные" });
      }

      const config = await storage.dashboard.saveDashboardConfiguration(
        user.id,
        layout,
        widgets
      );
      res.json(config);
    } catch (error) {
      console.error("Error saving dashboard configuration:", error);
      res.status(500).json({ message: "Ошибка сохранения конфигурации" });
    }
  });

  // Получить данные для конкретного виджета
  app.get("/api/dashboard/widget/:widgetKey", requireAuth, async (req, res) => {
    try {
      const { widgetKey } = req.params;
      const config = req.query.config ? JSON.parse(req.query.config as string) : undefined;

      const data = await storage.dashboard.getWidgetData(widgetKey, config);
      
      if (data === null) {
        return res.status(404).json({ message: "Виджет не найден" });
      }

      res.json(data);
    } catch (error) {
      console.error("Error fetching widget data:", error);
      res.status(500).json({ message: "Ошибка получения данных виджета" });
    }
  });
}
