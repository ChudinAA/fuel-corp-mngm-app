export const AVIA_SERVICE_CARRIER_NAME = "АвиаСервис";

export const TRANSPORTATION_QUERY_KEY = "/api/transportation";

export const TRANSPORTATION_TABLE_COLUMNS = [
  { id: "date", label: "Дата" },
  { id: "supplier", label: "Поставщик" },
  { id: "buyer", label: "Покупатель" },
  { id: "basis", label: "Базис погрузки" },
  { id: "customerBasis", label: "Базис доставки" },
  { id: "carrier", label: "Перевозчик" },
  { id: "deliveryLocation", label: "Пункт доставки" },
  { id: "productType", label: "Вид продукта" },
  { id: "quantityKg", label: "Количество (кг)" },
  { id: "purchasePrice", label: "Цена покупки" },
  { id: "salePrice", label: "Цена продажи" },
  { id: "purchaseAmount", label: "Сумма покупки" },
  { id: "saleAmount", label: "Сумма продажи" },
  { id: "deliveryCost", label: "Стоимость доставки" },
  { id: "profit", label: "Прибыль" },
  { id: "notes", label: "Примечание" },
];

export const DEFAULT_TRANSPORTATION_COLUMNS = [
  "date",
  "supplier",
  "buyer",
  "basis",
  "customerBasis",
  "carrier",
  "deliveryLocation",
  "productType",
  "quantityKg",
  "purchasePrice",
  "salePrice",
  "purchaseAmount",
  "saleAmount",
  "deliveryCost",
  "profit",
];
