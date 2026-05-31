
import type { ModuleExportConfig } from "../entities/export-config";

export const optExportConfig: ModuleExportConfig = {
  moduleName: "opt",
  tableName: "opt",
  displayName: "Оптовые продажи",
  columns: [
    { key: "dealDate",             label: "Дата",              type: "date",   exportable: true },
    { key: "productType",          label: "Продукт",           type: "string", exportable: true },
    { key: "supplier.name",        label: "Поставщик",         type: "string", exportable: true },
    { key: "buyer.name",           label: "Покупатель",        type: "string", exportable: true },
    { key: "quantityKg",           label: "КГ",                type: "number", exportable: true },
    { key: "purchasePrice",        label: "Цена пок.",         type: "number", exportable: true, sensitive: true, requiredPermission: "opt.view_prices" },
    { key: "purchaseAmount",       label: "Покупка (₽)",       type: "number", exportable: true, sensitive: true, requiredPermission: "opt.view_prices" },
    { key: "salePrice",            label: "Цена пр.",          type: "number", exportable: true, requiredPermission: "opt.view_prices" },
    { key: "saleAmount",           label: "Продажа (₽)",       type: "number", exportable: true, requiredPermission: "opt.view_prices" },
    { key: "deliveryLocation.name",label: "Место доставки",    type: "string", exportable: true },
    { key: "carrier.name",         label: "Перевозчик",        type: "string", exportable: true },
    { key: "deliveryCost",         label: "Доставка (₽)",      type: "number", exportable: true },
    { key: "profit",               label: "Прибыль (₽)",       type: "number", exportable: true, sensitive: true, requiredPermission: "opt.view_prices" },
    { key: "notes",                label: "Примечания",        type: "string", exportable: true },
  ],
  defaultColumns: ["dealDate","productType","supplier.name","buyer.name","quantityKg","saleAmount","profit"],
  relations: ["supplier","buyer","deliveryLocation","carrier"],
};

export const refuelingExportConfig: ModuleExportConfig = {
  moduleName: "refueling",
  tableName: "aircraft_refueling",
  displayName: "Заправка ВС",
  columns: [
    { key: "refuelingDate",  label: "Дата",          type: "date",   exportable: true },
    { key: "productType",    label: "Продукт",       type: "string", exportable: true },
    { key: "aircraftNumber", label: "Борт",          type: "string", exportable: true },
    { key: "supplier.name",  label: "Поставщик",     type: "string", exportable: true },
    { key: "basis.name",     label: "Базис",         type: "string", exportable: true },
    { key: "buyer.name",     label: "Покупатель",    type: "string", exportable: true },
    { key: "quantityLiters", label: "Лит.",          type: "number", exportable: true },
    { key: "density",        label: "Плотность",     type: "number", exportable: true },
    { key: "quantityKg",     label: "КГ",            type: "number", exportable: true },
    { key: "purchasePrice",  label: "Цена пок.",     type: "number", exportable: true, sensitive: true, requiredPermission: "refueling.view_prices" },
    { key: "salePrice",      label: "Цена пр.",      type: "number", exportable: true, requiredPermission: "refueling.view_prices" },
    { key: "saleAmount",     label: "Продажа (₽)",   type: "number", exportable: true, requiredPermission: "refueling.view_prices" },
    { key: "profit",         label: "Прибыль (₽)",   type: "number", exportable: true, sensitive: true, requiredPermission: "refueling.view_prices" },
    { key: "notes",          label: "Примечания",    type: "string", exportable: true },
  ],
  defaultColumns: ["refuelingDate","productType","aircraftNumber","supplier.name","basis.name","buyer.name","quantityKg","saleAmount"],
  relations: ["supplier","buyer","basis"],
};

export const movementExportConfig: ModuleExportConfig = {
  moduleName: "movement",
  tableName: "movement",
  displayName: "Перемещения",
  columns: [
    { key: "movementDate",          label: "Дата",          type: "date",   exportable: true },
    { key: "movementType",          label: "Тип",           type: "string", exportable: true },
    { key: "productType",           label: "Продукт",       type: "string", exportable: true },
    { key: "fromName",              label: "Откуда",        type: "string", exportable: true },
    { key: "toName",                label: "Куда",          type: "string", exportable: true },
    { key: "quantityKg",            label: "КГ",            type: "number", exportable: true },
    { key: "purchasePrice",         label: "Цена (₽/кг)",   type: "number", exportable: true, requiredPermission: "movement.view_costs" },
    { key: "carrierName",           label: "Перевозчик",    type: "string", exportable: true },
    { key: "deliveryCost",          label: "Доставка (₽)",  type: "number", exportable: true, requiredPermission: "movement.view_costs" },
    { key: "storageCost",           label: "Хранение (₽)",  type: "number", exportable: true, requiredPermission: "movement.view_costs" },
    { key: "warehouseServicesCost", label: "Услуги (₽)",    type: "number", exportable: true, requiredPermission: "movement.view_costs" },
    { key: "costPerKg",             label: "Себест. (₽/кг)",type: "number", exportable: true, sensitive: true, requiredPermission: "movement.view_costs" },
    { key: "notes",                 label: "Примечания",    type: "string", exportable: true },
  ],
  defaultColumns: ["movementDate","movementType","productType","fromName","toName","quantityKg","deliveryCost"],
  relations: [],
};

export const exchangeDealsExportConfig: ModuleExportConfig = {
  moduleName: "exchange-deals",
  tableName: "exchange_deals",
  displayName: "Сделки Биржи",
  columns: [
    { key: "dealDate",         label: "Дата сделки",      type: "date",   exportable: true },
    { key: "dealNumber",       label: "Номер",             type: "string", exportable: true },
    { key: "departureName",    label: "Ст. отпр.",         type: "string", exportable: true },
    { key: "destinationName",  label: "Ст. назн.",         type: "string", exportable: true },
    { key: "buyerName",        label: "Покупатель",        type: "string", exportable: true },
    { key: "paymentDate",      label: "Дата оплаты",       type: "date",   exportable: true },
    { key: "pricePerTon",      label: "Цена/т (₽)",        type: "number", exportable: true },
    { key: "weightTon",        label: "Вес (т)",           type: "number", exportable: true },
    { key: "tariffPricePerTon",label: "Тариф (₽/т)",       type: "number", exportable: true },
    { key: "sellerName",       label: "Продавец",          type: "string", exportable: true },
    { key: "wagonNumbers",     label: "Вагоны",            type: "string", exportable: true },
    { key: "railwayInvoice",   label: "Ж/д накладная",     type: "string", exportable: true },
    { key: "notes",            label: "Примечания",        type: "string", exportable: true },
  ],
  defaultColumns: ["dealDate","dealNumber","departureName","destinationName","buyerName","weightTon","pricePerTon","tariffPricePerTon"],
  relations: [],
};

export const warehousesExportConfig: ModuleExportConfig = {
  moduleName: "warehouses",
  tableName: "warehouses",
  displayName: "Склады",
  columns: [
    { key: "name",           label: "Название",              type: "string", exportable: true },
    { key: "currentBalance", label: "Остаток керосина (кг)", type: "number", exportable: true },
    { key: "averageCost",    label: "Себест. керосина",      type: "number", exportable: true },
    { key: "pvkjBalance",    label: "Остаток ПВКЖ (кг)",     type: "number", exportable: true },
    { key: "pvkjAverageCost",label: "Себест. ПВКЖ",          type: "number", exportable: true },
    { key: "maxCapacity",    label: "Ёмкость (кг)",          type: "number", exportable: true },
    { key: "isActive",       label: "Активен",               type: "boolean",exportable: true },
  ],
  defaultColumns: ["name","currentBalance","averageCost","pvkjBalance","isActive"],
  relations: [],
};

export const transportationExportConfig: ModuleExportConfig = {
  moduleName: "transportation",
  tableName: "transportation",
  displayName: "Перевозки",
  columns: [
    { key: "dealDate",              label: "Дата",                  type: "date",   exportable: true },
    { key: "buyer.name",            label: "Заказчик",              type: "string", exportable: true },
    { key: "supplier.name",         label: "Поставщик",             type: "string", exportable: true },
    { key: "carrier.name",          label: "Перевозчик",            type: "string", exportable: true },
    { key: "deliveryLocation.name", label: "Пункт доставки",        type: "string", exportable: true },
    { key: "basis",                 label: "Базис погрузки",        type: "string", exportable: true },
    { key: "customerBasis",         label: "Базис доставки",        type: "string", exportable: true },
    { key: "productType",           label: "Продукт",               type: "string", exportable: true },
    { key: "quantityKg",            label: "КГ",                    type: "number", exportable: true },
    { key: "salePrice",             label: "Цена услуги (₽/кг)",    type: "number", exportable: true, requiredPermission: "transportation.view_prices" },
    { key: "saleAmount",            label: "Сумма услуги (₽)",      type: "number", exportable: true, requiredPermission: "transportation.view_prices" },
    { key: "deliveryCost",          label: "Доставка (₽)",          type: "number", exportable: true },
    { key: "profit",                label: "Прибыль (₽)",           type: "number", exportable: true, sensitive: true, requiredPermission: "transportation.view_prices" },
    { key: "notes",                 label: "Примечание",            type: "string", exportable: true },
  ],
  defaultColumns: ["dealDate","buyer.name","carrier.name","deliveryLocation.name","quantityKg","saleAmount","profit"],
  relations: ["buyer","supplier","carrier","deliveryLocation"],
};

export const refuelingAbroadExportConfig: ModuleExportConfig = {
  moduleName: "refueling-abroad",
  tableName: "refueling_abroad",
  displayName: "Заправка ВС зарубеж",
  columns: [
    { key: "refuelingDate",            label: "Дата",               type: "date",   exportable: true },
    { key: "airport",                  label: "Аэропорт",           type: "string", exportable: true },
    { key: "aircraftNumber",           label: "Борт",               type: "string", exportable: true },
    { key: "rtNumber",                 label: "Номер РТ",           type: "string", exportable: true },
    { key: "supplier.name",            label: "Поставщик",          type: "string", exportable: true },
    { key: "buyer.name",               label: "Покупатель",         type: "string", exportable: true },
    { key: "basis.name",               label: "Базис",              type: "string", exportable: true },
    { key: "productType",              label: "Продукт",            type: "string", exportable: true },
    { key: "quantityLiters",           label: "Лит.",               type: "number", exportable: true },
    { key: "quantityKg",               label: "КГ",                 type: "number", exportable: true },
    { key: "purchasePriceUsd",         label: "Цена пок. (USD)",    type: "number", exportable: true, requiredPermission: "refueling-abroad.view_prices" },
    { key: "purchaseAmountUsd",        label: "Покупка (USD)",      type: "number", exportable: true, requiredPermission: "refueling-abroad.view_prices" },
    { key: "salePriceUsd",             label: "Цена пр. (USD)",     type: "number", exportable: true, requiredPermission: "refueling-abroad.view_prices" },
    { key: "saleAmountUsd",            label: "Продажа (USD)",      type: "number", exportable: true, requiredPermission: "refueling-abroad.view_prices" },
    { key: "purchaseExchangeRateValue",label: "Курс пок. (₽)",      type: "number", exportable: true },
    { key: "saleExchangeRateValue",    label: "Курс пр. (₽)",       type: "number", exportable: true },
  ],
  defaultColumns: ["refuelingDate","airport","supplier.name","buyer.name","quantityKg","saleAmountUsd"],
  relations: ["supplier","buyer","basis"],
};

export const deliveryCostExportConfig: ModuleExportConfig = {
  moduleName: "delivery-cost",
  tableName: "delivery_costs",
  displayName: "Тарифы доставки",
  columns: [
    { key: "carrierName",  label: "Перевозчик",      type: "string", exportable: true },
    { key: "fromLocation", label: "Откуда",          type: "string", exportable: true },
    { key: "toLocation",   label: "Куда",            type: "string", exportable: true },
    { key: "costPerKg",    label: "За кг (₽)",       type: "number", exportable: true },
    { key: "distanceKm",   label: "Расстояние (км)", type: "number", exportable: true },
    { key: "isActive",     label: "Активен",         type: "boolean",exportable: true },
  ],
  defaultColumns: ["carrierName","fromLocation","toLocation","costPerKg","isActive"],
  relations: [],
};

export const railwayTariffsExportConfig: ModuleExportConfig = {
  moduleName: "railway-tariffs",
  tableName: "railway_tariffs",
  displayName: "Тарифы ЖД доставки",
  columns: [
    { key: "fromStation.name", label: "Ст. отправления", type: "string", exportable: true },
    { key: "toStation.name",   label: "Ст. назначения",  type: "string", exportable: true },
    { key: "pricePerTon",      label: "Тариф (₽/т)",     type: "number", exportable: true },
  ],
  defaultColumns: ["fromStation.name","toStation.name","pricePerTon"],
  relations: [],
};

export const exportConfigRegistry: Record<string, ModuleExportConfig> = {
  opt:                optExportConfig,
  refueling:          refuelingExportConfig,
  movement:           movementExportConfig,
  "exchange-deals":   exchangeDealsExportConfig,
  warehouses:         warehousesExportConfig,
  transportation:     transportationExportConfig,
  "refueling-abroad": refuelingAbroadExportConfig,
  "delivery-cost":    deliveryCostExportConfig,
  "railway-tariffs":  railwayTariffsExportConfig,
};
