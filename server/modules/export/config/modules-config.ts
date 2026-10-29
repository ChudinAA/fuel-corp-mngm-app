
import type { ModuleExportConfig } from "../entities/export-config";

const MASS_FORMAT = "#,##0.00000";
const PRICE_FORMAT = "#,##0.00";
const AMOUNT_FORMAT = "#,##0.00";
const LITERS_FORMAT = "#,##0.00";
const DENSITY_FORMAT = "#,##0.0000";

export const optExportConfig: ModuleExportConfig = {
  moduleName: "opt",
  tableName: "opt",
  displayName: "Оптовые продажи",
  columns: [
    { key: "dealDate",              label: "Дата",              type: "date",   exportable: true },
    { key: "productType",           label: "Продукт",           type: "string", exportable: true },
    { key: "supplier.name",         label: "Поставщик",         type: "string", exportable: true },
    { key: "buyer.name",            label: "Покупатель",        type: "string", exportable: true },
    { key: "quantityTonnes",        label: "Масса (т)",          type: "number", exportable: true, numberFormat: MASS_FORMAT },
    { key: "purchasePricePerTonne", label: "Цена покупки (₽/т)", type: "number", exportable: true, numberFormat: PRICE_FORMAT },
    { key: "purchaseAmount",        label: "Покупка (₽)",        type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "salePricePerTonne",     label: "Цена продажи (₽/т)", type: "number", exportable: true, numberFormat: PRICE_FORMAT },
    { key: "saleAmount",            label: "Продажа (₽)",        type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "deliveryLocation.name", label: "Место доставки",    type: "string", exportable: true },
    { key: "carrier.name",          label: "Перевозчик",        type: "string", exportable: true },
    { key: "deliveryCost",          label: "Доставка (₽)",      type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "profit",                label: "Прибыль (₽)",       type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "notes",                 label: "Примечания",        type: "string", exportable: true },
  ],
  defaultColumns: ["dealDate","productType","supplier.name","buyer.name","quantityTonnes","purchasePricePerTonne","salePricePerTonne","saleAmount","profit"],
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
    { key: "quantityTonnes",        label: "Масса (т)",          type: "number", exportable: true, numberFormat: MASS_FORMAT },
    { key: "purchasePricePerTonne", label: "Цена покупки (₽/т)", type: "number", exportable: true, numberFormat: PRICE_FORMAT },
    { key: "salePricePerTonne",     label: "Цена продажи (₽/т)", type: "number", exportable: true, numberFormat: PRICE_FORMAT },
    { key: "saleAmount",     label: "Продажа (₽)",        type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "profit",         label: "Прибыль (₽)",        type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "notes",          label: "Примечания",    type: "string", exportable: true },
  ],
  defaultColumns: ["refuelingDate","productType","aircraftNumber","supplier.name","basis.name","buyer.name","quantityTonnes","salePricePerTonne","saleAmount","profit"],
  relations: ["supplier","buyer","basis"],
};

export const movementExportConfig: ModuleExportConfig = {
  moduleName: "movement",
  tableName: "movement",
  displayName: "Перемещения",
  columns: [
    { key: "movementDate",          label: "Дата",           type: "date",   exportable: true },
    { key: "movementType",          label: "Тип",            type: "string", exportable: true },
    { key: "productType",           label: "Продукт",        type: "string", exportable: true },
    { key: "fromName",              label: "Откуда",         type: "string", exportable: true },
    { key: "toName",                label: "Куда",           type: "string", exportable: true },
    { key: "quantityTonnes",        label: "Масса (т)",      type: "number", exportable: true, numberFormat: MASS_FORMAT },
    { key: "purchasePricePerTonne", label: "Цена (₽/т)",     type: "number", exportable: true, numberFormat: PRICE_FORMAT },
    { key: "_purchaseAmount",       label: "Сумма (₽)",      type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "carrierName",           label: "Перевозчик",     type: "string", exportable: true },
    { key: "deliveryCost",          label: "Доставка (₽)",   type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "storageCost",           label: "Хранение (₽)",   type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "warehouseServicesCost", label: "Услуги (₽)",     type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "costPerTonne",          label: "Себест. (₽/т)",  type: "number", exportable: true, numberFormat: PRICE_FORMAT },
    { key: "notes",                 label: "Примечания",     type: "string", exportable: true },
  ],
  defaultColumns: ["movementDate","movementType","productType","fromName","toName","quantityTonnes","purchasePricePerTonne","deliveryCost","costPerTonne"],
  relations: [],
};

export const exchangeDealsExportConfig: ModuleExportConfig = {
  moduleName: "exchange-deals",
  tableName: "exchange_deals",
  displayName: "Сделки Биржи",
  columns: [
    { key: "dealDate",           label: "Дата сделки",           type: "date",   exportable: true },
    { key: "dealNumber",         label: "Номер",                 type: "string", exportable: true },
    { key: "departureName",      label: "Ст. отпр.",             type: "string", exportable: true },
    { key: "destinationName",    label: "Ст. назн.",             type: "string", exportable: true },
    { key: "buyerName",          label: "Покупатель",            type: "string", exportable: true },
    { key: "paymentDate",        label: "Дата оплаты",           type: "date",   exportable: true },
    { key: "pricePerTon",        label: "Цена/т (₽)",            type: "number", exportable: true, numberFormat: PRICE_FORMAT },
    { key: "weightTon",          label: "Вес (т)",               type: "number", exportable: true, numberFormat: MASS_FORMAT },
    { key: "actualWeightTon",    label: "Вес фактический (т)",   type: "number", exportable: true, numberFormat: MASS_FORMAT },
    { key: "_purchaseAmount",    label: "Сумма покупки (₽)",     type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "tariffPricePerTon",  label: "Тариф (₽/т)",           type: "number", exportable: true, numberFormat: PRICE_FORMAT },
    { key: "_deliveryCostTotal", label: "Доставка (₽)",          type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "_totalCost",         label: "Итого (₽)",             type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "_costPerTon",        label: "Цена итого (₽/т)",      type: "number", exportable: true, numberFormat: PRICE_FORMAT },
    { key: "wagonDepartureDate", label: "Дата отправки вагонов", type: "date",   exportable: true },
    { key: "plannedDeliveryDate",label: "Дата план. доставки",   type: "date",   exportable: true },
    { key: "sellerName",         label: "Продавец",              type: "string", exportable: true },
    { key: "wagonNumbers",       label: "Вагоны",                type: "string", exportable: true },
    { key: "railwayInvoice",     label: "Ж/д накладная",         type: "string", exportable: true },
    { key: "_reserved",          label: "Резерв 5% (₽)",         type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "notes",              label: "Примечания",            type: "string", exportable: true },
  ],
  defaultColumns: ["dealDate","dealNumber","departureName","destinationName","buyerName","pricePerTon","weightTon","actualWeightTon","_purchaseAmount","_deliveryCostTotal","_totalCost","wagonDepartureDate","plannedDeliveryDate","sellerName"],
  relations: [],
};

export const warehousesExportConfig: ModuleExportConfig = {
  moduleName: "warehouses",
  tableName: "warehouses",
  displayName: "Склады",
  columns: [
    { key: "name",            label: "Название",              type: "string", exportable: true },
    { key: "currentBalanceTonnes",        label: "Остаток керосина (т)", type: "number", exportable: true, numberFormat: MASS_FORMAT },
    { key: "averageCostPerTonne",         label: "Себест. керосина (₽/т)", type: "number", exportable: true, numberFormat: PRICE_FORMAT },
    { key: "pvkjBalanceTonnes",            label: "Остаток ПВКЖ (т)",     type: "number", exportable: true, numberFormat: MASS_FORMAT },
    { key: "pvkjAverageCostPerTonne",      label: "Себест. ПВКЖ (₽/т)",   type: "number", exportable: true, numberFormat: PRICE_FORMAT },
    { key: "maxCapacityTonnes",            label: "Ёмкость (т)",          type: "number", exportable: true, numberFormat: MASS_FORMAT },
    { key: "isActive",        label: "Активен",               type: "boolean",exportable: true },
  ],
  defaultColumns: ["name","currentBalanceTonnes","averageCostPerTonne","pvkjBalanceTonnes","isActive"],
  relations: [],
};

export const transportationExportConfig: ModuleExportConfig = {
  moduleName: "transportation",
  tableName: "transportation",
  displayName: "Перевозки",
  columns: [
    { key: "dealDate",              label: "Дата",               type: "date",   exportable: true },
    { key: "buyer.name",            label: "Заказчик",           type: "string", exportable: true },
    { key: "supplier.name",         label: "Поставщик",          type: "string", exportable: true },
    { key: "carrier.name",          label: "Перевозчик",         type: "string", exportable: true },
    { key: "deliveryLocation.name", label: "Пункт доставки",     type: "string", exportable: true },
    { key: "basis",                 label: "Базис погрузки",     type: "string", exportable: true },
    { key: "customerBasis",         label: "Базис доставки",     type: "string", exportable: true },
    { key: "productType",           label: "Продукт",            type: "string", exportable: true },
    { key: "quantityTonnes",        label: "Масса (т)",          type: "number", exportable: true, numberFormat: MASS_FORMAT },
    { key: "salePricePerTonne",     label: "Цена услуги (₽/т)",  type: "number", exportable: true, numberFormat: PRICE_FORMAT },
    { key: "saleAmount",            label: "Сумма услуги (₽)",   type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "deliveryCost",          label: "Доставка (₽)",       type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "profit",                label: "Прибыль (₽)",        type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "notes",                 label: "Примечание",         type: "string", exportable: true },
  ],
  defaultColumns: ["dealDate","buyer.name","carrier.name","deliveryLocation.name","quantityTonnes","salePricePerTonne","saleAmount","profit"],
  relations: ["buyer","supplier","carrier","deliveryLocation"],
};

export const refuelingAbroadExportConfig: ModuleExportConfig = {
  moduleName: "refueling-abroad",
  tableName: "refueling_abroad",
  displayName: "Заправка ВС зарубеж",
  columns: [
    { key: "refuelingDate",              label: "Дата",                  type: "date",   exportable: true },
    { key: "airport",                    label: "Аэропорт",              type: "string", exportable: true },
    { key: "aircraftNumber",             label: "Борт",                  type: "string", exportable: true },
    { key: "rtNumber",                   label: "Номер РТ",              type: "string", exportable: true },
    { key: "supplier.name",              label: "Поставщик",             type: "string", exportable: true },
    { key: "buyer.name",                 label: "Покупатель",            type: "string", exportable: true },
    { key: "basis.name",                 label: "Базис",                 type: "string", exportable: true },
    { key: "productType",                label: "Продукт",               type: "string", exportable: true },
    { key: "quantityLiters",             label: "Литры",                  type: "number", exportable: true, numberFormat: LITERS_FORMAT },
    { key: "quantityTonnes",             label: "Масса (т)",               type: "number", exportable: true, numberFormat: MASS_FORMAT },
    { key: "purchasePriceUsdPerTonne",   label: "Цена закупки (USD/т)",    type: "number", exportable: true, numberFormat: PRICE_FORMAT },
    { key: "purchaseAmountUsd",          label: "Сумма закупки (USD)",     type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "purchaseExchangeRateValue",  label: "Курс закупки (₽)",       type: "number", exportable: true, numberFormat: "#,##0.0000" },
    { key: "purchaseAmountRub",          label: "Сумма закупки (₽)",      type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "salePriceUsdPerTonne",       label: "Цена продажи (USD/т)",   type: "number", exportable: true, numberFormat: PRICE_FORMAT },
    { key: "saleAmountUsd",              label: "Сумма продажи (USD)",    type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "saleExchangeRateValue",      label: "Курс продажи (₽)",       type: "number", exportable: true, numberFormat: "#,##0.0000" },
    { key: "saleAmountRub",              label: "Сумма продажи (₽)",      type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "purchaseExchangeRateDate",   label: "Дата фиксации (закупка)",   type: "date",   exportable: true },
    { key: "saleExchangeRateDate",       label: "Дата фиксации (продажа)",   type: "date",   exportable: true },
    { key: "_intermediaryNames",         label: "Посредники",                type: "string", exportable: true },
    { key: "_totalIntermediaryUsd",      label: "Посредники (USD)",          type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "_bankNames",                 label: "Банки",                     type: "string", exportable: true },
    { key: "_totalBankCommissionUsd",    label: "Банк. комиссии (USD)",      type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "_totalCommissionUsd",        label: "Сумма комиссий (USD)",      type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "profitUsd",                  label: "Прибыль (USD)",             type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "profitRub",                  label: "Прибыль (₽)",               type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
  ],
  defaultColumns: ["refuelingDate","airport","aircraftNumber","supplier.name","buyer.name","quantityTonnes","purchasePriceUsdPerTonne","purchaseExchangeRateValue","purchaseExchangeRateDate","purchaseAmountUsd","salePriceUsdPerTonne","saleExchangeRateValue","saleExchangeRateDate","saleAmountUsd","_intermediaryNames","_totalIntermediaryUsd","_bankNames","_totalBankCommissionUsd","profitUsd"],
  relations: ["supplier","buyer","basis"],
};

export const equipmentMovementExportConfig: ModuleExportConfig = {
  moduleName: "equipment-movement",
  tableName: "equipment_movement",
  displayName: "Перемещения ОП",
  columns: [
    { key: "movementDate",      label: "Дата",           type: "date",   exportable: true },
    { key: "movementType",      label: "Тип",            type: "string", exportable: true },
    { key: "productType",       label: "Продукт",        type: "string", exportable: true },
    { key: "fromWarehouseName", label: "Склад (откуда)", type: "string", exportable: true },
    { key: "fromEquipmentName", label: "ОП (откуда)",    type: "string", exportable: true },
    { key: "toWarehouseName",   label: "Склад (куда)",   type: "string", exportable: true },
    { key: "toEquipmentName",   label: "ОП (куда)",      type: "string", exportable: true },
    { key: "quantityTonnes",    label: "Масса (т)",      type: "number", exportable: true, numberFormat: MASS_FORMAT },
    { key: "quantityLiters",    label: "Литры",          type: "number", exportable: true, numberFormat: LITERS_FORMAT },
    { key: "density",           label: "Плотность (кг/л)", type: "number", exportable: true, numberFormat: DENSITY_FORMAT },
    { key: "costPerTonne",      label: "Себест. (₽/т)",  type: "number", exportable: true, numberFormat: PRICE_FORMAT },
    { key: "totalCost",         label: "Сумма (₽)",      type: "number", exportable: true, numberFormat: AMOUNT_FORMAT },
    { key: "notes",             label: "Примечания",     type: "string", exportable: true },
  ],
  defaultColumns: ["movementDate","movementType","productType","fromWarehouseName","toWarehouseName","fromEquipmentName","toEquipmentName","quantityTonnes","costPerTonne","totalCost"],
  relations: [],
};

export const deliveryCostExportConfig: ModuleExportConfig = {
  moduleName: "delivery-cost",
  tableName: "delivery_costs",
  displayName: "Тарифы доставки",
  columns: [
    { key: "carrierName",  label: "Перевозчик",      type: "string", exportable: true },
    { key: "fromLocation", label: "Откуда",          type: "string", exportable: true },
    { key: "toLocation",   label: "Куда",            type: "string", exportable: true },
    { key: "costPerTonne", label: "Тариф (₽/т)",    type: "number", exportable: true, numberFormat: PRICE_FORMAT },
    { key: "distance",    label: "Расстояние (км)", type: "number", exportable: true },
  ],
  defaultColumns: ["carrierName","fromLocation","toLocation","costPerTonne"],
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
  opt:                  optExportConfig,
  refueling:            refuelingExportConfig,
  movement:             movementExportConfig,
  "exchange-deals":     exchangeDealsExportConfig,
  warehouses:           warehousesExportConfig,
  transportation:       transportationExportConfig,
  "refueling-abroad":   refuelingAbroadExportConfig,
  "equipment-movement": equipmentMovementExportConfig,
  "delivery-cost":      deliveryCostExportConfig,
  "railway-tariffs":    railwayTariffsExportConfig,
};
