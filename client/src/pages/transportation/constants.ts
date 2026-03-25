export const AVIA_SERVICE_CARRIER_NAME = "АвиаСервис";

export const TRANSPORTATION_QUERY_KEY = "/api/transportation";

export const TRANSPORTATION_TABLE_COLUMNS = [
  { id: "date", label: "Дата" },
  { id: "supplier", label: "Поставщик" },
  { id: "buyer", label: "Покупатель" },
  { id: "basis", label: "Базис погр." },
  { id: "customerBasis", label: "Базис дос." },
  { id: "carrier", label: "Перевозч." },
  { id: "deliveryLocation", label: "Пункт дос." },
  { id: "productType", label: "Продукт" },
  { id: "quantityKg", label: "КГ" },
  { id: "purchasePrice", label: "Цена пок." },
  { id: "salePrice", label: "Цена пр." },
  { id: "purchaseAmount", label: "Покупка" },
  { id: "saleAmount", label: "Продажа" },
  { id: "deliveryCost", label: "Доставка" },
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
  // "deliveryLocation",
  "productType",
  "quantityKg",
  "purchasePrice",
  "salePrice",
  "purchaseAmount",
  "saleAmount",
  "deliveryCost",
  "profit",
];
