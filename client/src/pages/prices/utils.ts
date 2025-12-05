
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export const formatNumber = (value: string | number | null) => {
  if (value === null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(num);
};

export const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  return format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });
};

export const getPriceDisplay = (priceValues: string[] | null) => {
  if (!priceValues || priceValues.length === 0) return "—";
  try {
    const prices = priceValues.map(pv => {
      const parsed = JSON.parse(pv);
      return parsed.price;
    });
    if (prices.length === 1) {
      return `${formatNumber(prices[0])} ₽`;
    }
    return prices.map(p => `${formatNumber(p)} ₽`).join(", ");
  } catch {
    return "—";
  }
};

export const getProductTypeLabel = (productType: string) => {
  const labels: Record<string, string> = {
    kerosine: "Керосин",
    pvkj: "ПВКЖ",
    service: "Услуга",
    agent: "Агентские",
    storage: "Хранение"
  };
  return labels[productType] || productType;
};
