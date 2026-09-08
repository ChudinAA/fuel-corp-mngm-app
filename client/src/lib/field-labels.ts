// ─── Человекочитаемые названия типов сущностей ───────────────────────────────
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  opt: "Опт",
  aircraft_refueling: "Заправка ВС",
  aircraft_refueling_abroad: "Заправка ВС (загран.)",
  movement: "Перемещение",
  exchange: "Обмен",
  warehouses: "Склад",
  prices: "Прайс",
  suppliers: "Поставщик",
  customers: "Покупатель",
  bases: "База",
  logistics_carriers: "Перевозчик",
  logistics_delivery_locations: "Место доставки",
  logistics_vehicles: "ТС",
  logistics_trailers: "Прицеп",
  logistics_drivers: "Водитель",
  delivery_cost: "Тариф доставки",
  cashflow_transactions: "Движение ДС",
  payment_calendar: "Платёжный календарь",
  price_calculations: "Расчёт цен",
  users: "Пользователь",
  roles: "Роль",
  exchange_rates: "Курс валюты",
  storage_cards: "Карта хранения",
  equipment: "Средство заправки",
  equipment_movement: "Перемещение оборудования",
  transportation: "Перевозки ОП",
  railway_stations: "Ж/д станция",
  railway_tariffs: "Ж/д тариф",
  exchange_deals: "Обменная сделка",
  exchange_advance_cards: "Авансовая карта",
  plan_entries: "Плановая запись",
  free_volume_allocations: "Свободный объём",
  logistics_transport_units: "Транспортная единица",
  logistics_plan_routes: "Маршрут",
  planning_resource: "Ресурс планирования",
};

// ─── Поля-маппинг для каждого типа сущности (точные имена из DB schema) ──────
export const FIELD_LABELS: Record<string, Record<string, string>> = {
  // ── ОПТ ──────────────────────────────────────────────────────────────────────
  opt: {
    dealDate: "Дата сделки",
    basis: "Базис",
    customerBasis: "Базис покупателя",
    productType: "Тип топлива",
    inputMode: "Единица ввода",
    quantityKg: "Количество (кг)",
    quantityLiters: "Количество (л)",
    density: "Плотность",
    buyerId: "Покупатель",
    supplierId: "Поставщик",
    carrierId: "Перевозчик",
    warehouseId: "Склад",
    deliveryLocationId: "Место доставки",
    purchasePrice: "Цена покупки",
    purchasePriceIndex: "Индекс цены покупки",
    salePrice: "Цена продажи",
    salePriceIndex: "Индекс цены продажи",
    purchaseAmount: "Сумма покупки",
    saleAmount: "Сумма продажи",
    profit: "Прибыль",
    deliveryCost: "Стоимость доставки",
    deliveryTariff: "Тариф доставки",
    contractNumber: "Номер договора",
    notes: "Примечания",
    isApproxVolume: "Примерный объём",
    isPlannedDeal: "Плановая сделка",
    isDraft: "Черновик",
    isNoDeliveryRequired: "Без доставки",
  },

  // ── ЗАПРАВКА ВС ──────────────────────────────────────────────────────────────
  aircraft_refueling: {
    refuelingDate: "Дата заправки",
    aircraftNumber: "Номер ВС",
    orderNumber: "Номер заказа",
    flightNumber: "Номер рейса",
    productType: "Тип топлива",
    inputMode: "Единица ввода",
    quantityKg: "Количество (кг)",
    quantityLiters: "Количество (л)",
    density: "Плотность",
    basis: "Базис",
    customerBasis: "Базис покупателя",
    buyerId: "Покупатель",
    supplierId: "Поставщик",
    warehouseId: "Склад",
    purchasePrice: "Цена покупки",
    purchasePriceIndex: "Индекс цены покупки",
    salePrice: "Цена продажи",
    salePriceIndex: "Индекс цены продажи",
    purchaseAmount: "Сумма покупки",
    saleAmount: "Сумма продажи",
    profit: "Прибыль",
    contractNumber: "Номер договора",
    agentFee: "Агентский сбор (сумма)",
    agentFeeRate: "Агентский сбор (%)",
    isAgentFeeEnabled: "Агентский сбор включён",
    otherServiceName: "Доп. услуга: название",
    otherServiceType: "Доп. услуга: тип начисления",
    otherServiceQuantity: "Доп. услуга: количество",
    otherServiceFee: "Доп. услуга: сумма",
    isOtherServiceEnabled: "Доп. услуга включена",
    isPvkjRecharge: "Дозаправка ПВКЖ",
    isPriceRecharge: "Переоформление цены",
    isApproxVolume: "Примерный объём",
    isPlannedDeal: "Плановая сделка",
    isDraft: "Черновик",
    notes: "Примечания",
  },

  // ── ЗАПРАВКА ВС ЗАГРАН ────────────────────────────────────────────────────────
  aircraft_refueling_abroad: {
    refuelingDate: "Дата заправки",
    aircraftNumber: "Номер ВС",
    orderNumber: "Номер заказа",
    flightNumber: "Номер рейса",
    airport: "Аэропорт",
    country: "Страна",
    productType: "Тип топлива",
    inputMode: "Единица ввода",
    quantityKg: "Количество (кг)",
    quantityLiters: "Количество (л)",
    density: "Плотность",
    buyerId: "Покупатель",
    supplierId: "Поставщик",
    intermediaryCommissionFormula: "Формула комиссии посредника",
    intermediaryCommissionUsd: "Комиссия посредника (USD)",
    intermediaryCommissionRub: "Комиссия посредника (руб.)",
    currency: "Валюта",
    exchangeRateValue: "Курс",
    purchaseExchangeRateValue: "Курс покупки",
    saleExchangeRateValue: "Курс продажи",
    saleExchangeRateDate: "Дата курса продажи",
    purchaseExchangeRateDate: "Дата курса покупки",
    purchasePriceUsd: "Цена покупки (USD)",
    purchasePriceRub: "Цена покупки (руб.)",
    purchasePriceIndex: "Индекс цены покупки",
    salePriceUsd: "Цена продажи (USD)",
    salePriceRub: "Цена продажи (руб.)",
    salePriceIndex: "Индекс цены продажи",
    purchaseAmountUsd: "Сумма покупки (USD)",
    purchaseAmountRub: "Сумма покупки (руб.)",
    saleAmountUsd: "Сумма продажи (USD)",
    saleAmountRub: "Сумма продажи (руб.)",
    profitUsd: "Прибыль (USD)",
    profitRub: "Прибыль (руб.)",
    bankCommissionUsd: "Банковская комиссия (USD)",
    bankCommissionRub: "Банковская комиссия (руб.)",
    contractNumber: "Номер договора",
    notes: "Примечания",
    isApproxVolume: "Примерный объём",
    isDraft: "Черновик",
    needsTopUp: "Требует пополнения",
  },

  // ── ПЕРЕМЕЩЕНИЕ ───────────────────────────────────────────────────────────────
  movement: {
    movementDate: "Дата перемещения",
    movementType: "Тип перемещения",
    productType: "Тип топлива",
    inputMode: "Единица ввода",
    supplierId: "Поставщик",
    // Real DB field names (from schema):
    fromWarehouseId: "Склад-источник",
    toWarehouseId: "Склад-получатель",
    carrierId: "Перевозчик",
    basis: "Базис",
    quantityLiters: "Количество (л)",
    quantityKg: "Количество (кг)",
    density: "Плотность",
    purchasePrice: "Цена покупки",
    purchasePriceIndex: "Индекс цены покупки",
    deliveryPrice: "Цена доставки",
    deliveryCost: "Стоимость доставки",
    storageCost: "Стоимость хранения",
    warehouseServicesCost: "Услуги склада",
    totalCost: "Итоговая себестоимость",
    costPerKg: "Себестоимость за кг",
    vehicleNumber: "Номер ТС",
    trailerNumber: "Номер прицепа",
    driverName: "Водитель",
    notes: "Примечания",
    isDraft: "Черновик",
    fromExchange: "От биржи",
  },

  // ── ОБМЕН ─────────────────────────────────────────────────────────────────────
  exchange: {
    exchangeDate: "Дата обмена",
    supplierId: "Поставщик",
    warehouseId: "Склад",
    productType: "Тип топлива",
    inputMode: "Единица ввода",
    quantityKg: "Количество (кг)",
    quantityLiters: "Количество (л)",
    density: "Плотность",
    notes: "Примечания",
  },

  // ── СКЛАДЫ ────────────────────────────────────────────────────────────────────
  warehouses: {
    name: "Название",
    supplierId: "Поставщик",
    equipmentType: "Тип склада",
    storageCost: "Стоимость хранения (руб./т)",
    isExport: "Экспортный склад",
    isActive: "Активен",
    limitVolume: "Лимит объёма (т)",
    limitProductType: "Лимит по типу топлива",
    limitExpiresAt: "Срок действия лимита",
  },

  // ── ПРАЙС ─────────────────────────────────────────────────────────────────────
  prices: {
    productType: "Тип топлива",
    counterpartyType: "Тип контрагента",
    counterpartyRole: "Роль",
    basis: "Базис",
    volume: "Объём",
    limitType: "Тип лимита",
    maxDealAmount: "Макс. сумма сделки",
    dateFrom: "Действует с",
    dateTo: "Действует по",
    contractNumber: "Номер договора",
    contractAppendix: "Приложение к договору",
    priceUnit: "Единица цены",
    contractLimitEnabled: "Лимит по договору",
    currency: "Валюта",
    isActive: "Активен",
    notes: "Примечания",
  },

  // ── ПОСТАВЩИКИ ────────────────────────────────────────────────────────────────
  suppliers: {
    name: "Название",
    inn: "ИНН",
    contractNumber: "Номер договора",
    contactPerson: "Контактное лицо",
    phone: "Телефон",
    email: "Email",
    description: "Описание",
    isActive: "Активен",
    isWarehouse: "Является складом",
  },

  // ── ПОКУПАТЕЛИ ────────────────────────────────────────────────────────────────
  customers: {
    name: "Название",
    inn: "ИНН",
    contractNumber: "Номер договора",
    contactPerson: "Контактное лицо",
    phone: "Телефон",
    email: "Email",
    description: "Описание",
    isActive: "Активен",
  },

  // ── ПОЛЬЗОВАТЕЛИ ─────────────────────────────────────────────────────────────
  users: {
    email: "Email",
    firstName: "Имя",
    lastName: "Фамилия",
    roleId: "Роль",
    isActive: "Активен",
    lastLoginAt: "Последний вход",
  },

  // ── РОЛИ ─────────────────────────────────────────────────────────────────────
  roles: {
    name: "Название",
    description: "Описание",
    permissions: "Права доступа",
    isSystem: "Системная роль",
    isDefault: "По умолчанию",
  },

  // ── БАЗЫ ─────────────────────────────────────────────────────────────────────
  bases: {
    name: "Название",
    baseType: "Тип базы",
    location: "Местоположение",
    iataCode: "Код ИАТА",
    isActive: "Активна",
  },

  // ── ПЕРЕВОЗЧИКИ ───────────────────────────────────────────────────────────────
  logistics_carriers: {
    name: "Название",
    inn: "ИНН",
    contactPerson: "Контактное лицо",
    phone: "Телефон",
    email: "Email",
    description: "Описание",
    isActive: "Активен",
  },

  // ── МЕСТА ДОСТАВКИ ────────────────────────────────────────────────────────────
  logistics_delivery_locations: {
    name: "Название",
    address: "Адрес",
    city: "Город",
    isActive: "Активно",
    notes: "Примечания",
    code: "Код",
  },

  // ── ТРАНСПОРТНЫЕ СРЕДСТВА ─────────────────────────────────────────────────────
  logistics_vehicles: {
    licensePlate: "Гос. номер",
    model: "Модель",
    brand: "Марка",
    year: "Год выпуска",
    capacity: "Грузоподъёмность",
    carrierId: "Перевозчик",
    isActive: "Активно",
    notes: "Примечания",
    type: "Тип ТС",
  },

  // ── ПРИЦЕПЫ ──────────────────────────────────────────────────────────────────
  logistics_trailers: {
    licensePlate: "Гос. номер",
    model: "Модель",
    capacity: "Объём (л)",
    carrierId: "Перевозчик",
    isActive: "Активен",
    notes: "Примечания",
    type: "Тип прицепа",
  },

  // ── ВОДИТЕЛИ ─────────────────────────────────────────────────────────────────
  logistics_drivers: {
    firstName: "Имя",
    lastName: "Фамилия",
    phone: "Телефон",
    licenseNumber: "Номер прав",
    carrierId: "Перевозчик",
    isActive: "Активен",
    notes: "Примечания",
    schedule: "График работы",
  },

  // ── ТАРИФЫ ДОСТАВКИ ──────────────────────────────────────────────────────────
  delivery_cost: {
    carrierId: "Перевозчик",
    fromLocation: "Откуда",
    toLocation: "Куда",
    costPerKg: "Цена за кг",
    distance: "Расстояние (км)",
    transitDays: "Сутки в пути",
    priority: "Приоритет",
    isActive: "Активен",
  },

  // ── СРЕДСТВА ЗАПРАВКИ (ОБОРУДОВАНИЕ) ─────────────────────────────────────────
  equipment: {
    name: "Название",
    isActive: "Активно",
  },

  // ── ПЕРЕМЕЩЕНИЕ ОБОРУДОВАНИЯ ─────────────────────────────────────────────────
  equipment_movement: {
    productType: "Тип топлива",
    transactionType: "Тип операции",
    quantity: "Количество",
    price: "Цена",
    transactionDate: "Дата операции",
    notes: "Примечания",
  },

  // ── ПЕРЕВОЗКИ ОП ─────────────────────────────────────────────────────────────
  transportation: {
    dealDate: "Дата сделки",
    productType: "Тип топлива",
    inputMode: "Единица ввода",
    basis: "Базис",
    customerBasis: "Базис покупателя",
    quantityKg: "Количество (кг)",
    quantityLiters: "Количество (л)",
    density: "Плотность",
    buyerId: "Покупатель",
    supplierId: "Поставщик",
    carrierId: "Перевозчик",
    deliveryLocationId: "Место доставки",
    purchasePrice: "Цена покупки",
    purchasePriceIndex: "Индекс цены покупки",
    salePrice: "Цена продажи",
    salePriceIndex: "Индекс цены продажи",
    purchaseAmount: "Сумма покупки",
    saleAmount: "Сумма продажи",
    profit: "Прибыль",
    deliveryCost: "Стоимость доставки",
    deliveryTariff: "Тариф доставки",
    contractNumber: "Номер договора",
    notes: "Примечания",
    isDraft: "Черновик",
  },

  // ── Ж/Д СТАНЦИИ ──────────────────────────────────────────────────────────────
  railway_stations: {
    name: "Название",
    code: "Код станции",
    city: "Город",
    isActive: "Активна",
    region: "Регион",
  },

  // ── Ж/Д ТАРИФЫ ───────────────────────────────────────────────────────────────
  railway_tariffs: {
    costPerTon: "Цена за тонну",
    minCost: "Мин. стоимость",
    isActive: "Активен",
    validFrom: "Действует с",
    validTo: "Действует до",
    notes: "Примечания",
  },

  // ── ОБМЕННЫЕ СДЕЛКИ ──────────────────────────────────────────────────────────
  exchange_deals: {
    dealNumber: "Номер сделки",
    dealDate: "Дата сделки",
    buyerId: "Покупатель",
    sellerId: "Продавец",
    paymentDate: "Дата оплаты",
    pricePerTon: "Цена за тонну",
    weightTon: "Вес (т), плановый",
    actualWeightTon: "Вес (т), фактический",
    wagonDepartureDate: "Дата отправки вагонов",
    plannedDeliveryDate: "Плановая дата доставки",
    wagonNumbers: "Номера вагонов",
    railwayInvoice: "Ж/д накладная",
    isReceivedAtWarehouse: "Принято на склад",
    isDraft: "Черновик",
    notes: "Примечания",
  },

  // ── АВАНСОВЫЕ КАРТЫ ──────────────────────────────────────────────────────────
  exchange_advance_cards: {
    sellerId: "Продавец",
    currentBalance: "Баланс",
    notes: "Примечания",
    isActive: "Активна",
  },

  // ── КАРТЫ ХРАНЕНИЯ ───────────────────────────────────────────────────────────
  storage_cards: {
    name: "Название",
    cardType: "Тип карты",
    currency: "Валюта",
    supplierId: "Поставщик",
    buyerId: "Покупатель",
    notes: "Примечания",
    isActive: "Активна",
  },

  // ── ДВИЖЕНИЕ ДС ──────────────────────────────────────────────────────────────
  cashflow_transactions: {
    transactionDate: "Дата транзакции",
    category: "Категория",
    subcategory: "Подкатегория",
    amount: "Сумма",
    currency: "Валюта",
    description: "Описание",
    counterparty: "Контрагент",
    paymentMethod: "Способ оплаты",
    isPlanned: "Планируемый",
    notes: "Примечания",
  },

  // ── ПЛАТЁЖНЫЙ КАЛЕНДАРЬ ──────────────────────────────────────────────────────
  payment_calendar: {
    dueDate: "Срок оплаты",
    title: "Название",
    description: "Описание",
    amount: "Сумма",
    currency: "Валюта",
    category: "Категория",
    counterparty: "Контрагент",
    status: "Статус",
    paidDate: "Дата оплаты",
    paidAmount: "Оплаченная сумма",
    isRecurring: "Повторяющийся",
    recurringPeriod: "Период повторения",
    notes: "Примечания",
  },

  // ── РАСЧЁТ ЦЕН ───────────────────────────────────────────────────────────────
  price_calculations: {
    name: "Название",
    productType: "Тип топлива",
    baseCost: "Базовая стоимость",
    additionalCosts: "Дополнительные расходы",
    totalCost: "Общая себестоимость",
    sellingPrice: "Цена продажи",
    margin: "Маржа",
    marginPercentage: "Маржа %",
    isTemplate: "Шаблон",
    notes: "Примечания",
  },

  // ── ПЛАНОВЫЕ ЗАПИСИ ──────────────────────────────────────────────────────────
  plan_entries: {
    date: "Дата",
    type: "Тип",
    warehouseId: "Склад",
    volume: "Объём",
    notes: "Примечания",
  },

  // ── СВОБОДНЫЕ ОБЪЁМЫ ─────────────────────────────────────────────────────────
  free_volume_allocations: {
    allocDate: "Дата",
    warehouseId: "Склад",
    productType: "Тип топлива",
    quantityKg: "Количество (кг)",
    quantityLiters: "Количество (л)",
    basisId: "Базис",
    notes: "Примечания",
  },

  // ── ТРАНСПОРТНЫЕ ЕДИНИЦЫ ─────────────────────────────────────────────────────
  logistics_transport_units: {
    carrierId: "Перевозчик",
    vehicleId: "ТС",
    trailerId: "Прицеп",
    driverId: "Водитель",
    trailerCapacityM3: "Объём прицепа (м³)",
    notes: "Примечания",
    isActive: "Активна",
  },

  // ── МАРШРУТЫ ─────────────────────────────────────────────────────────────────
  logistics_plan_routes: {
    fromEntityName: "Откуда",
    toEntityName: "Куда",
    dateStart: "Дата начала",
    dateEnd: "Дата завершения",
    periodFrom: "Период: с",
    periodTo: "Период: по",
    priority: "Приоритет",
    status: "Статус",
    type: "Тип",
    notes: "Примечания",
    isDeadline: "Дедлайн",
  },

  // ── РЕСУРС ПЛАНИРОВАНИЯ ──────────────────────────────────────────────────────
  planning_resource: {
    supplierId: "Поставщик",
    notes: "Примечания",
  },

  // ── КУРСЫ ВАЛЮТ ──────────────────────────────────────────────────────────────
  exchange_rates: {
    currency: "Валюта",
    rate: "Курс",
    date: "Дата",
    source: "Источник",
  },
};

// ─── Получить метку поля ──────────────────────────────────────────────────────
export function getFieldLabel(entityType: string, fieldName: string): string {
  const entityLabels = FIELD_LABELS[entityType];
  if (entityLabels && entityLabels[fieldName]) {
    return entityLabels[fieldName];
  }
  // camelCase → readable fallback
  return fieldName
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
