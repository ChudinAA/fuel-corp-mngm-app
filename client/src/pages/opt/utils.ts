import { PRODUCT_TYPES } from "./constants";

export const formatNumber = (value: number | string | null) => {
  if (value === null) return null;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(
    num,
  );
};

export const formatCurrency = (value: number | string | null) => {
  if (value === null) return null;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
  }).format(num);
};

export const formatNumberForTable = (value: string | number | null) => {
  if (value === null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;

  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}к`;
  }

  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(
    num,
  );
};

export const formatCurrencyForTable = (value: string | number | null) => {
  if (value === null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;

  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}к ₽`;
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(num);
};

export const getProductLabel = (type: string) => {
  return PRODUCT_TYPES.find((t) => t.value === type)?.label || type;
};
