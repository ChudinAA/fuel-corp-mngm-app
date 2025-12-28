// Маппинг полей для различных типов сущностей
export const FIELD_LABELS: Record<string, Record<string, string>> = {
  opt: {
    basis: "Базис",
    buyerId: "Покупатель",
    supplierId: "Поставщик",
    carrierId: "Перевозчик",
    deliveryLocationId: "Место доставки",
    warehouseId: "Склад",
    quantityKg: "Количество (КГ)",
    quantityLiters: "Количество (Л)",
    purchasePrice: "Цена покупки",
    salePrice: "Цена продажи",
    purchaseAmount: "Сумма покупки",
    saleAmount: "Сумма продажи",
    profit: "Прибыль",
    deliveryCost: "Стоимость доставки",
    deliveryTariff: "Тариф доставки",
    notes: "Примечания",
    isApproxVolume: "Примерный объем",
    density: "Плотность",
    dealDate: "Дата сделки",
    contractNumber: "Номер договора",
    salePriceIndex: "Индекс цены продажи",
    purchasePriceIndex: "Индекс цены покупки",
    purchasePriceModified: "Цена покупки изменена",
  },
  aircraft_refueling: {
    refuelingDate: "Дата заправки",
    aircraftNumber: "Номер ВС",
    buyerId: "Покупатель",
    supplierId: "Поставщик",
    warehouseId: "Склад",
    productType: "Тип продукта",
    quantityKg: "Количество (КГ)",
    quantityLiters: "Количество (Л)",
    density: "Плотность",
    purchasePrice: "Цена покупки",
    salePrice: "Цена продажи",
    purchaseAmount: "Сумма покупки",
    saleAmount: "Сумма продажи",
    profit: "Прибыль",
    notes: "Примечания",
    contractNumber: "Номер договора",
    salePriceIndex: "Индекс цены продажи",
    purchasePriceIndex: "Индекс цены покупки",
  },
  exchange: {
    exchangeDate: "Дата обмена",
    supplierId: "Поставщик",
    warehouseId: "Склад",
    productType: "Тип продукта",
    quantityKg: "Количество (КГ)",
    quantityLiters: "Количество (Л)",
    density: "Плотность",
    notes: "Примечания",
  },
  movement: {
    movementDate: "Дата перемещения",
    sourceWarehouseId: "Склад отправления",
    destinationWarehouseId: "Склад назначения",
    carrierId: "Перевозчик",
    productType: "Тип продукта",
    quantityKg: "Количество (КГ)",
    quantityLiters: "Количество (Л)",
    density: "Плотность",
    deliveryCost: "Стоимость доставки",
    notes: "Примечания",
  },
  warehouses: {
    name: "Название",
    location: "Местоположение",
    capacity: "Вместимость",
    currentStock: "Текущий остаток",
    isActive: "Активен",
  },
  prices: {
    supplierId: "Поставщик",
    productType: "Тип продукта",
    price: "Цена",
    startDate: "Дата начала",
    endDate: "Дата окончания",
    notes: "Примечания",
  },
  suppliers: {
    name: "Название",
    inn: "ИНН",
    contractNumber: "Номер договора",
    contactPerson: "Контактное лицо",
    phone: "Телефон",
    email: "Email",
    description: "Описание",
    isActive: "Активен",
    isWarehouse: "Склад",
  },
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
  users: {
    email: "Email",
    firstName: "Имя",
    lastName: "Фамилия",
    roleId: "Роль",
    isActive: "Статус",
    lastLoginAt: "Последний вход",
  },
  roles: {
    name: "Название",
    description: "Описание",
    permissions: "Права доступа",
    isSystem: "Системная роль",
    isDefault: "Роль по умолчанию",
  },
};

/**
 * Получить читаемое название поля для конкретного типа сущности
 */
export function getFieldLabel(entityType: string, fieldName: string): string {
  const entityLabels = FIELD_LABELS[entityType];
  if (entityLabels && entityLabels[fieldName]) {
    return entityLabels[fieldName];
  }
  // Fallback: capitalize first letter and replace underscores
  return fieldName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}