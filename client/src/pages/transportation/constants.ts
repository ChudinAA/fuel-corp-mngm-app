export const AVIA_SERVICE_CARRIER_NAME = "АвиаСервис";

export const TRANSPORTATION_QUERY_KEY = "/api/transportation";

export const TRANSPORTATION_TABLE_COLUMNS = [
  { id: "date", label: "Дата" },
  { id: "buyer", label: "Заказчик" },
  { id: "basis", label: "Базис погр." },
  { id: "customerBasis", label: "Базис дос." },
  { id: "carrier", label: "Перевозч." },
  { id: "deliveryLocation", label: "Пункт дос." },
  { id: "quantityKg", label: "КГ" },
  { id: "salePrice", label: "Цена услуги" },
  { id: "deliveryCost", label: "Доставка" },
  { id: "profit", label: "Прибыль" },
  { id: "notes", label: "Примечание" },
];

export const DEFAULT_TRANSPORTATION_COLUMNS = [
  "date",
  "buyer",
  "basis",
  "customerBasis",
  "carrier",
  "quantityKg",
  "salePrice",
  "deliveryCost",
  "profit",
];
