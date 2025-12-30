
import type { Express } from "express";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { ExcelService } from "../services/excel-service";
import { storage } from "../../../storage/index";
import { exportConfigRegistry } from "../config/modules-config";

const excelService = new ExcelService();

export function registerExportRoutes(app: Express) {
  // Получить доступные колонки для модуля
  app.get(
    "/api/export/:moduleName/columns",
    requireAuth,
    async (req, res) => {
      try {
        const { moduleName } = req.params;
        const user = await storage.users.getUser(req.session.userId!);

        if (!user || !user.roleId) {
          return res.status(403).json({ message: "Нет назначенной роли" });
        }

        const role = await storage.roles.getRole(user.roleId);
        const userPermissions = role?.permissions || [];

        const columns = excelService.getAvailableColumns(moduleName, userPermissions);
        const config = exportConfigRegistry[moduleName];

        res.json({
          columns,
          defaultColumns: config?.defaultColumns || [],
          displayName: config?.displayName || moduleName,
        });
      } catch (error) {
        console.error("Error fetching export columns:", error);
        res.status(500).json({ message: "Ошибка получения колонок" });
      }
    }
  );

  // Экспорт данных в Excel
  app.post(
    "/api/export/:moduleName",
    requireAuth,
    requirePermission("reports", "export"),
    async (req, res) => {
      try {
        const { moduleName } = req.params;
        const { selectedColumns, filters, fileName } = req.body;

        if (!selectedColumns || !Array.isArray(selectedColumns)) {
          return res.status(400).json({ message: "Необходимо выбрать колонки для экспорта" });
        }

        const user = await storage.users.getUser(req.session.userId!);
        if (!user || !user.roleId) {
          return res.status(403).json({ message: "Нет назначенной роли" });
        }

        const role = await storage.roles.getRole(user.roleId);
        const userPermissions = role?.permissions || [];

        // Получение данных из соответствующего модуля
        let data: any[] = [];
        switch (moduleName) {
          case "opt":
            if (typeof storage.opt.getAllOpts === 'function') {
              data = await storage.opt.getAllOpts();
            } else {
              const result = await storage.opt.getOptDeals(1, 10000);
              data = result.data;
            }
            break;
          case "refueling":
            if (typeof storage.aircraftRefueling.getAllAircraftRefuelings === 'function') {
              data = await storage.aircraftRefueling.getAllAircraftRefuelings();
            } else {
              const result = await storage.aircraftRefueling.getAircraftRefuelings(1, 10000);
              data = result.data;
            }
            break;
          case "movement":
            const movementResult = await storage.movement.getMovements(1, 10000);
            data = movementResult.data;
            break;
          case "exchange":
            const exchangeResult = await storage.exchange.getExchanges(1, 10000);
            data = exchangeResult.data;
            break;
          case "warehouses":
            data = await storage.warehouses.getWarehouses();
            break;
          default:
            return res.status(400).json({ message: "Неизвестный модуль" });
        }

        // Применение фильтров (если есть)
        if (filters) {
          data = this.applyFilters(data, filters);
        }

        // Генерация Excel
        const buffer = await excelService.generateExcel(data, {
          moduleName,
          selectedColumns,
          filters,
          userPermissions,
          sheetName: exportConfigRegistry[moduleName]?.displayName,
        });

        // Отправка файла
        const downloadFileName = fileName || `${moduleName}_export_${Date.now()}.xlsx`;
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${downloadFileName}"`
        );
        res.send(buffer);
      } catch (error: any) {
        console.error("Error exporting to Excel:", error);
        res.status(500).json({ message: error.message || "Ошибка экспорта" });
      }
    }
  );

  // Вспомогательная функция фильтрации
  function applyFilters(data: any[], filters: Record<string, any>): any[] {
    return data.filter(item => {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') {
          const itemValue = key.split('.').reduce((obj, k) => obj?.[k], item);
          if (itemValue !== value) {
            return false;
          }
        }
      }
      return true;
    });
  }
}
