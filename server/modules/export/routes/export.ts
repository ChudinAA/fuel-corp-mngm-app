
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

        if (!config) {
          return res.status(404).json({ message: "Конфигурация модуля не найдена" });
        }

        res.json({
          columns,
          defaultColumns: config.defaultColumns || [],
          displayName: config.displayName || moduleName,
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
        const { selectedColumns, exportFilters, fileName } = req.body;

        if (!selectedColumns || !Array.isArray(selectedColumns)) {
          return res.status(400).json({ message: "Необходимо выбрать колонки для экспорта" });
        }

        const user = await storage.users.getUser(req.session.userId!);
        if (!user || !user.roleId) {
          return res.status(403).json({ message: "Нет назначенной роли" });
        }

        const role = await storage.roles.getRole(user.roleId);
        const userPermissions = role?.permissions || [];

        const search: string = exportFilters?.search || "";
        const columnFilters: Record<string, string[]> = exportFilters?.columnFilters || {};

        let data: any[] = [];

        switch (moduleName) {
          case "opt": {
            const result = await storage.opt.getOptDeals(0, 100000, search, columnFilters);
            data = result.data;
            break;
          }
          case "refueling": {
            const result = await storage.aircraftRefueling.getRefuelings(0, 100000, undefined, search, columnFilters);
            data = result.data;
            break;
          }
          case "movement": {
            const result = await storage.movement.getMovements(0, 100000, search, columnFilters);
            data = result.data;
            break;
          }
          case "exchange-deals": {
            const result = await storage.exchangeDeals.getDeals(0, 100000, search, columnFilters);
            data = result.data;
            break;
          }
          case "warehouses": {
            data = await storage.warehouses.getWarehouses();
            if (search) {
              const s = search.toLowerCase();
              data = data.filter((w: any) => w.name?.toLowerCase().includes(s));
            }
            break;
          }
          case "transportation": {
            const result = await storage.transportation.getTransportationDeals(0, 100000, search, columnFilters);
            data = result.data;
            break;
          }
          case "refueling-abroad": {
            const result = await storage.refuelingAbroad.getAll(0, 100000, search, columnFilters);
            data = result.data;
            break;
          }
          default:
            return res.status(400).json({ message: `Неизвестный модуль: ${moduleName}` });
        }

        const buffer = await excelService.generateExcel(data, {
          moduleName,
          selectedColumns,
          userPermissions,
          sheetName: exportConfigRegistry[moduleName]?.displayName,
        });

        const downloadFileName = fileName || `${exportConfigRegistry[moduleName]?.displayName || moduleName}_${new Date().toISOString().split("T")[0]}.xlsx`;
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(downloadFileName)}`
        );
        res.send(buffer);
      } catch (error: any) {
        console.error("Error exporting to Excel:", error);
        res.status(500).json({ message: error.message || "Ошибка экспорта" });
      }
    }
  );
}
