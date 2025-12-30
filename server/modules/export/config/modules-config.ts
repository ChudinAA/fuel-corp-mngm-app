
import type { ModuleExportConfig } from "../entities/export-config";

// Конфигурация экспорта для модуля ОПТ
export const optExportConfig: ModuleExportConfig = {
  moduleName: "opt",
  tableName: "opt",
  displayName: "Оптовые продажи",
  columns: [
    { key: "dealNumber", label: "Номер сделки", type: "string", exportable: true },
    { key: "dealDate", label: "Дата сделки", type: "date", exportable: true },
    { key: "supplier.name", label: "Поставщик", type: "string", exportable: true },
    { key: "customer.name", label: "Покупатель", type: "string", exportable: true },
    { key: "base.name", label: "База", type: "string", exportable: true },
    { key: "warehouse.name", label: "Склад", type: "string", exportable: true },
    { key: "productType", label: "Тип продукта", type: "string", exportable: true },
    { key: "quantity", label: "Количество (кг)", type: "number", exportable: true },
    { key: "purchasePrice", label: "Цена закупки", type: "number", exportable: true, sensitive: true, requiredPermission: "opt.view_prices" },
    { key: "sellingPrice", label: "Цена продажи", type: "number", exportable: true, requiredPermission: "opt.view_prices" },
    { key: "totalCost", label: "Общая стоимость", type: "number", exportable: true },
    { key: "totalRevenue", label: "Выручка", type: "number", exportable: true, requiredPermission: "opt.view_revenue" },
    { key: "marginality", label: "Маржинальность (%)", type: "number", exportable: true, sensitive: true, requiredPermission: "opt.view_margin" },
    { key: "profit", label: "Прибыль", type: "number", exportable: true, sensitive: true, requiredPermission: "opt.view_profit" },
    { key: "deliveryCost", label: "Стоимость доставки", type: "number", exportable: true },
    { key: "notes", label: "Примечания", type: "string", exportable: true },
  ],
  defaultColumns: ["dealNumber", "dealDate", "supplier.name", "customer.name", "quantity", "totalRevenue"],
  relations: ["supplier", "customer", "base", "warehouse"],
};

// Конфигурация для заправки ВС
export const refuelingExportConfig: ModuleExportConfig = {
  moduleName: "refueling",
  tableName: "aircraft_refueling",
  displayName: "Заправка воздушных судов",
  columns: [
    { key: "refuelingNumber", label: "Номер заправки", type: "string", exportable: true },
    { key: "refuelingDate", label: "Дата заправки", type: "date", exportable: true },
    { key: "base.name", label: "База", type: "string", exportable: true },
    { key: "warehouse.name", label: "Склад", type: "string", exportable: true },
    { key: "aircraftType", label: "Тип ВС", type: "string", exportable: true },
    { key: "flightNumber", label: "Номер рейса", type: "string", exportable: true },
    { key: "productType", label: "Тип продукта", type: "string", exportable: true },
    { key: "quantity", label: "Количество (кг)", type: "number", exportable: true },
    { key: "purchasePrice", label: "Цена закупки", type: "number", exportable: true, sensitive: true, requiredPermission: "refueling.view_prices" },
    { key: "sellingPrice", label: "Цена продажи", type: "number", exportable: true, requiredPermission: "refueling.view_prices" },
    { key: "totalRevenue", label: "Выручка", type: "number", exportable: true, requiredPermission: "refueling.view_revenue" },
    { key: "profit", label: "Прибыль", type: "number", exportable: true, sensitive: true, requiredPermission: "refueling.view_profit" },
  ],
  defaultColumns: ["refuelingNumber", "refuelingDate", "base.name", "aircraftType", "flightNumber", "quantity"],
  relations: ["base", "warehouse"],
};

// Конфигурация для перемещений
export const movementExportConfig: ModuleExportConfig = {
  moduleName: "movement",
  tableName: "movement",
  displayName: "Перемещения",
  columns: [
    { key: "movementNumber", label: "Номер перемещения", type: "string", exportable: true },
    { key: "movementDate", label: "Дата перемещения", type: "date", exportable: true },
    { key: "movementType", label: "Тип перемещения", type: "string", exportable: true },
    { key: "sourceWarehouse.name", label: "Склад отправитель", type: "string", exportable: true },
    { key: "destinationWarehouse.name", label: "Склад получатель", type: "string", exportable: true },
    { key: "productType", label: "Тип продукта", type: "string", exportable: true },
    { key: "quantity", label: "Количество (кг)", type: "number", exportable: true },
    { key: "carrier.name", label: "Перевозчик", type: "string", exportable: true },
    { key: "deliveryCost", label: "Стоимость доставки", type: "number", exportable: true },
    { key: "totalCost", label: "Общая стоимость", type: "number", exportable: true, requiredPermission: "movement.view_costs" },
  ],
  defaultColumns: ["movementNumber", "movementDate", "sourceWarehouse.name", "destinationWarehouse.name", "quantity"],
  relations: ["sourceWarehouse", "destinationWarehouse", "carrier"],
};

// Конфигурация для обмена
export const exchangeExportConfig: ModuleExportConfig = {
  moduleName: "exchange",
  tableName: "exchange",
  displayName: "Биржевые сделки",
  columns: [
    { key: "exchangeNumber", label: "Номер сделки", type: "string", exportable: true },
    { key: "exchangeDate", label: "Дата сделки", type: "date", exportable: true },
    { key: "sourceWarehouse.name", label: "Склад отправитель", type: "string", exportable: true },
    { key: "destinationWarehouse.name", label: "Склад получатель", type: "string", exportable: true },
    { key: "productType", label: "Тип продукта", type: "string", exportable: true },
    { key: "quantity", label: "Количество (кг)", type: "number", exportable: true },
    { key: "exchangeRate", label: "Курс обмена", type: "number", exportable: true },
    { key: "totalCost", label: "Общая стоимость", type: "number", exportable: true },
  ],
  defaultColumns: ["exchangeNumber", "exchangeDate", "sourceWarehouse.name", "destinationWarehouse.name", "quantity"],
  relations: ["sourceWarehouse", "destinationWarehouse"],
};

// Конфигурация для складов
export const warehousesExportConfig: ModuleExportConfig = {
  moduleName: "warehouses",
  tableName: "warehouses",
  displayName: "Склады",
  columns: [
    { key: "name", label: "Название", type: "string", exportable: true },
    { key: "currentBalance", label: "Остаток керосина (кг)", type: "number", exportable: true },
    { key: "averageCost", label: "Себестоимость керосина", type: "number", exportable: true },
    { key: "pvkjBalance", label: "Остаток ПВКЖ (кг)", type: "number", exportable: true },
    { key: "pvkjAverageCost", label: "Себестоимость ПВКЖ", type: "number", exportable: true },
    { key: "maxCapacity", label: "Максимальная вместимость", type: "number", exportable: true },
    { key: "storageCost", label: "Стоимость хранения", type: "number", exportable: true },
    { key: "isActive", label: "Активен", type: "boolean", exportable: true },
  ],
  defaultColumns: ["name", "currentBalance", "averageCost", "pvkjBalance", "isActive"],
  relations: [],
};

// Реестр всех конфигураций
export const exportConfigRegistry: Record<string, ModuleExportConfig> = {
  opt: optExportConfig,
  refueling: refuelingExportConfig,
  movement: movementExportConfig,
  exchange: exchangeExportConfig,
  warehouses: warehousesExportConfig,
};
