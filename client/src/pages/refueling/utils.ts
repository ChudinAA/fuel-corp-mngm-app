import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { PRODUCT_TYPES } from "./constants";

export const formatNumber = (value: string | number | null) => {
  if (value === null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;

  // Removed logic for dividing by 1000 and adding 'к' suffix

  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(num);
};

export const formatCurrency = (value: string | number | null) => {
  if (value === null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;

  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}к ₽`;
  }

  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(num);
};

export const formatDate = (dateStr: string) => {
  return format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });
};

export const getProductLabel = (type: string) => {
  return PRODUCT_TYPES.find(t => t.value === type)?.label || type;
};