import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { PRODUCT_TYPES } from "./constants";

export const formatNumber = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return num.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatNumberForTable = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";

  if (num >= 1000) {
    const kValue = num / 1000;
    return `${kValue.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}к`;
  }

  return num.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatCurrency = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "0 ₽";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0 ₽";
  return `${num.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
};

export const formatDate = (dateStr: string) => {
  return format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });
};

export const getProductLabel = (type: string) => {
  return PRODUCT_TYPES.find(t => t.value === type)?.label || type;
};