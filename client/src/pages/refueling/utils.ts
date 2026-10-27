import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { PRODUCT_TYPES } from "./constants";

export const formatNumber = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return num.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 5 });
};

export const formatPrice = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return num.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
};

export const formatNumberForTable = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";

  return num.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export const normalizeCurrencyForDisplay = (
  value: number,
  fractionDigits: number,
): number => {
  const scale = 10 ** fractionDigits;
  return Math.round(Math.abs(value) * scale) === 0 ? 0 : value;
};

export const formatCurrency = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "0 ₽";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0 ₽";
  const displayValue = normalizeCurrencyForDisplay(num, 2);
  return `${displayValue.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
};

export const formatCurrencyForTable = (value: string | number | null) => {
  if (value === null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;

  const displayValue = normalizeCurrencyForDisplay(num, 0);
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(displayValue);
};

export const formatDate = (dateStr: string) => {
  return format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });
};

export const getProductLabel = (type: string) => {
  return PRODUCT_TYPES.find(t => t.value === type)?.label || type;
};