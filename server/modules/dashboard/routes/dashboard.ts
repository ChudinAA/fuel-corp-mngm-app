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
      const user = await storage.users.getUser(req.session.userId!);
      if (!user || !user.roleId) {
        return res.status(403).json({ message: "No role assigned" });
      }

      const role = await storage.roles.getRole(user.roleId);
      const userPermissions = role?.permissions || [];

      const widgets =
        await storage.dashboard.getAvailableWidgets(userPermissions);
      res.json(widgets);
    } catch (error) {
      console.error("Error fetching available widgets:", error);
      res.status(500).json({ message: "Failed to fetch available widgets" });
    }
  });

  // Получить конфигурацию дашборда пользователя
  app.get("/api/dashboard/configuration", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Не авторизован" });
      }

      const config = await storage.dashboard.getUserDashboard(userId);
      res.json(config);
    } catch (error) {
      console.error("Error fetching dashboard configuration:", error);
      res.status(500).json({ message: "Ошибка получения конфигурации" });
    }
  });

  // Сохранить конфигурацию дашборда
  app.post("/api/dashboard/configuration", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Не авторизован" });
      }

      const { layout, widgets } = req.body;
      if (!layout || !widgets) {
        return res.status(400).json({ message: "Неверные данные" });
      }

      const config = await storage.dashboard.saveDashboardConfiguration(
        userId,
        layout,
        widgets,
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
      const config = req.query.config
        ? JSON.parse(req.query.config as string)
        : undefined;

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

  // Template routes
  app.get("/api/dashboard/templates", requireAuth, async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const templates = await storage.dashboard.getTemplates(category);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.get("/api/dashboard/templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.dashboard.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching template:", error);
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  app.post("/api/dashboard/templates", requireAuth, async (req, res) => {
    try {
      const template = await storage.dashboard.createTemplate({
        ...req.body,
        createdBy: req.session.userId,
      });
      res.json(template);
    } catch (error) {
      console.error("Error creating template:", error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  app.patch("/api/dashboard/templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.dashboard.updateTemplate(
        req.params.id,
        req.body,
      );
      res.json(template);
    } catch (error) {
      console.error("Error updating template:", error);
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  app.delete("/api/dashboard/templates/:id", requireAuth, async (req, res) => {
    try {
      await storage.dashboard.deleteTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  app.post(
    "/api/dashboard/templates/:id/apply",
    requireAuth,
    async (req, res) => {
      try {
        const config = await storage.dashboard.applyTemplate(
          req.session.userId!,
          req.params.id,
        );
        res.json(config);
      } catch (error) {
        console.error("Error applying template:", error);
        res.status(500).json({ message: "Failed to apply template" });
      }
    },
  );

  // Export/Import configuration
  app.get("/api/dashboard/export", requireAuth, async (req, res) => {
    try {
      const config = await storage.dashboard.getUserDashboard(
        req.session.userId!,
      );

      const exportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        configuration: {
          layout: config.layout,
          widgets: config.widgets,
        },
      };

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="dashboard-config-${Date.now()}.json"`,
      );
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting configuration:", error);
      res.status(500).json({ message: "Failed to export configuration" });
    }
  });

  app.post("/api/dashboard/import", requireAuth, async (req, res) => {
    try {
      const { configuration } = req.body;

      if (!configuration || !configuration.layout || !configuration.widgets) {
        return res
          .status(400)
          .json({ message: "Invalid configuration format" });
      }

      const config = await storage.dashboard.saveDashboardConfiguration(
        req.session.userId!,
        configuration.layout,
        configuration.widgets,
      );

      res.json(config);
    } catch (error) {
      console.error("Error importing configuration:", error);
      res.status(500).json({ message: "Failed to import configuration" });
    }
  });

  // Admin: Widget definitions management
  app.get("/api/admin/widgets", requireAuth, async (req, res) => {
    try {
      const widgets = await storage.dashboard.getAllWidgetDefinitions();
      res.json(widgets);
    } catch (error) {
      console.error("Error fetching widget definitions:", error);
      res.status(500).json({ message: "Failed to fetch widgets" });
    }
  });

  app.post("/api/admin/widgets", requireAuth, async (req, res) => {
    try {
      const widget = await storage.dashboard.createWidgetDefinition(req.body);
      res.json(widget);
    } catch (error) {
      console.error("Error creating widget:", error);
      res.status(500).json({ message: "Failed to create widget" });
    }
  });

  app.patch("/api/admin/widgets/:id", requireAuth, async (req, res) => {
    try {
      const widget = await storage.dashboard.updateWidgetDefinition(
        req.params.id,
        req.body,
      );
      res.json(widget);
    } catch (error) {
      console.error("Error updating widget:", error);
      res.status(500).json({ message: "Failed to update widget" });
    }
  });
}
