
import type { Express } from "express";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { ExcelService } from "../services/excel-service";
import { storage } from "../../../storage/index";
import { exportConfigRegistry } from "../config/modules-config";

const excelService = new ExcelService();

/** Проверяет, есть ли среди column-фильтров фильтр по дате */
function hasDateFilter(columnFilters: Record<string, string[]>): boolean {
  return Object.entries(columnFilters).some(
    ([key, values]) => /date/i.test(key) && Array.isArray(values) && values.length > 0
  );
}

const DEFAULT_LIMIT = 100;
const ALL_RECORDS   = 100_000;

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

        // Если дата не выбрана — ограничиваем последними 100 записями
        const limit = hasDateFilter(columnFilters) ? ALL_RECORDS : DEFAULT_LIMIT;

        let data: any[] = [];

        switch (moduleName) {
          case "opt": {
            const result = await storage.opt.getOptDeals(0, limit, search, columnFilters);
            data = result.data;
            // Добавляем вычислимые поля
            data = data.map((r: any) => ({
              ...r,
            }));
            break;
          }

          case "refueling": {
            const result = await storage.aircraftRefueling.getRefuelings(0, limit, undefined, search, columnFilters);
            data = result.data;
            break;
          }

          case "movement": {
            const result = await storage.movement.getMovements(0, limit, search, columnFilters);
            // Добавляем вычислимое поле "Сумма"
            data = result.data.map((r: any) => ({
              ...r,
              _purchaseAmount: r.purchasePrice && r.quantityKg
                ? parseFloat(r.purchasePrice) * parseFloat(r.quantityKg)
                : null,
            }));
            break;
          }

          case "exchange-deals": {
            const result = await storage.exchangeDeals.getDeals(0, limit, search, columnFilters);
            // Добавляем вычислимые поля как в таблице
            data = result.data.map((r: any) => {
              const pricePerTon       = parseFloat(r.pricePerTon    || 0);
              const weightTon         = parseFloat(r.weightTon       || 0);
              const tariffPricePerTon = parseFloat(r.tariffPricePerTon || 0);
              const purchaseAmount    = pricePerTon * weightTon;
              const deliveryCostTotal = tariffPricePerTon * weightTon;
              const totalCost         = purchaseAmount + deliveryCostTotal;
              const costPerTon        = weightTon > 0 ? totalCost / weightTon : 0;
              const reserved          = totalCost * 0.05;
              return {
                ...r,
                _purchaseAmount:    purchaseAmount    || null,
                _deliveryCostTotal: deliveryCostTotal || null,
                _totalCost:         totalCost         || null,
                _costPerTon:        costPerTon        || null,
                _reserved:          reserved           || null,
              };
            });
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
            const result = await storage.transportation.getTransportationDeals(0, limit, search, columnFilters);
            data = result.data;
            break;
          }

          case "refueling-abroad": {
            const result = await storage.refuelingAbroad.getAll(0, limit, search, columnFilters);
            data = result.data.map((r: any) => {
              // Посредники: сумма commissionUsd из цепочки (новая схема) или поле на главной записи (старая)
              const totalIntermediaryUsd = Array.isArray(r.intermediaries) && r.intermediaries.length > 0
                ? r.intermediaries.reduce(
                    (sum: number, i: any) => sum + parseFloat(i.commissionUsd || 0),
                    0
                  )
                : parseFloat(r.intermediaryCommissionUsd || 0);

              // Банковские комиссии: поле bankCommissionUsd хранится на главной записи
              // (в цепочке хранится только % и мин. значение, без итогового USD)
              const totalBankCommissionUsd = parseFloat(r.bankCommissionUsd || 0);

              return {
                ...r,
                _totalIntermediaryUsd:   totalIntermediaryUsd    || null,
                _totalBankCommissionUsd: totalBankCommissionUsd  || null,
                _totalCommissionUsd:     (totalIntermediaryUsd + totalBankCommissionUsd) || null,
              };
            });
            break;
          }

          case "equipment-movement": {
            const result = await storage.equipmentMovement.getMovements(0, limit, search);
            data = result.items;
            break;
          }

          case "delivery-cost": {
            const costs = await storage.delivery.getAllDeliveryCosts();
            const carriers = await storage.logistics.getAllLogisticsCarriers();
            const carrierMap = new Map(carriers.map((c: any) => [c.id, c.name]));
            data = costs.map((c: any) => ({
              ...c,
              carrierName: carrierMap.get(c.carrierId) || "",
            }));

            // Применяем фильтры
            const filterCarrierIds   = columnFilters.carrierId   || [];
            const filterFromLocations = columnFilters.fromLocation || [];
            const filterToLocations   = columnFilters.toLocation   || [];

            if (filterCarrierIds.length || filterFromLocations.length || filterToLocations.length || search) {
              const s = search.toLowerCase();
              data = data.filter((c: any) => {
                if (filterCarrierIds.length   && !filterCarrierIds.includes(c.carrierId))       return false;
                if (filterFromLocations.length && !filterFromLocations.includes(c.fromLocation)) return false;
                if (filterToLocations.length   && !filterToLocations.includes(c.toLocation))     return false;
                if (s && !(
                  c.fromLocation?.toLowerCase().includes(s) ||
                  c.toLocation?.toLowerCase().includes(s)   ||
                  c.carrierName?.toLowerCase().includes(s)
                )) return false;
                return true;
              });
            }
            break;
          }

          case "railway-tariffs": {
            // Применяем фильтры по станциям
            const filterFromIds = columnFilters.fromStationId || [];
            const filterToIds   = columnFilters.toStationId   || [];

            let tariffs = await storage.railway.getAllTariffs(search || "");
            if (filterFromIds.length) {
              tariffs = tariffs.filter((t: any) => filterFromIds.includes(t.fromStationId));
            }
            if (filterToIds.length) {
              tariffs = tariffs.filter((t: any) => filterToIds.includes(t.toStationId));
            }
            data = tariffs.map((t: any) => ({
              ...t,
              "fromStation.name": t.fromStation?.name || "",
              "toStation.name":   t.toStation?.name   || "",
            }));
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

        const downloadFileName =
          fileName ||
          `${exportConfigRegistry[moduleName]?.displayName || moduleName}_${
            new Date().toISOString().split("T")[0]
          }.xlsx`;

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(downloadFileName)}`);
        res.send(buffer);
      } catch (error: any) {
        console.error("Error exporting to Excel:", error);
        res.status(500).json({ message: error.message || "Ошибка экспорта" });
      }
    }
  );
}
