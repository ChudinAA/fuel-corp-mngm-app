
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export const formatNumber = (value: string | number | null) => {
  if (value === null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(num);
};

export const formatCurrency = (value: string | number | null) => {
  if (value === null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(num);
};

export const formatDate = (dateStr: string) => {
  return format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });
};
