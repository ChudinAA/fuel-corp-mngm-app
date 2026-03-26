import type { FieldErrors } from "react-hook-form";

const FIELD_LABELS: Record<string, string> = {
  supplierId: "Поставщик",
  buyerId: "Покупатель",
  carrierId: "Перевозчик",
  basisId: "Базис",
  basis: "Базис",
  customerBasis: "Базис покупателя",
  customerBasisId: "Базис покупателя",
  refuelingDate: "Дата заправки",
  dealDate: "Дата сделки",
  quantityKg: "Количество (кг)",
  quantityLiters: "Количество (литры)",
  productType: "Вид продукта",
  inputMode: "Режим ввода",
  warehouseId: "Склад",
  aircraftNumber: "Номер ВС",
  orderNumber: "Номер заказа",
  flightNumber: "Номер рейса",
  deliveryLocationId: "Пункт доставки",
  selectedPurchasePriceId: "Цена покупки",
  selectedSalePriceId: "Цена продажи",
  purchasePriceId: "Цена покупки",
  salePriceId: "Цена продажи",
  density: "Плотность",
  notes: "Примечания",
};

function isInternalZodMessage(msg: string): boolean {
  return (
    msg.startsWith("Expected ") ||
    msg === "Required" ||
    msg.startsWith("Invalid ") ||
    msg.includes(" received ") ||
    msg.startsWith("String must contain") ||
    msg.startsWith("Number must be")
  );
}

export function getReadableZodError(
  errors: FieldErrors<any>,
  fallback = "Заполните все обязательные поля перед созданием сделки.",
): string {
  const messages: string[] = [];
  const missingFields: string[] = [];

  for (const [field, error] of Object.entries(errors)) {
    if (!error) continue;
    const msg = (error as any)?.message as string | undefined;
    if (msg && !isInternalZodMessage(msg)) {
      messages.push(msg);
    } else {
      const label = FIELD_LABELS[field];
      if (label) missingFields.push(label);
    }
  }

  if (messages.length > 0) return messages[0];
  if (missingFields.length > 0) {
    return `Необходимо заполнить: ${missingFields.join(", ")}.`;
  }
  return fallback;
}
