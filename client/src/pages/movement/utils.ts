
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { CalculatedValues } from "./types";

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

export const formatDate = (dateStr: string) => 
  format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });

export const calculateKgFromLiters = (liters: string, density: string): string | null => {
  if (!liters || !density) return null;
  return (parseFloat(liters) * parseFloat(density)).toFixed(2);
};

export const calculateValues = (
  liters: string,
  density: string,
  kg: string,
  inputMode: "liters" | "kg"
): CalculatedValues => {
  const calculatedKg = inputMode === "liters" && liters && density
    ? calculateKgFromLiters(liters, density)
    : kg;

  // Временные значения для демонстрации
  const purchasePrice = 58.50;
  const deliveryCost = 15000;
  const totalCost = 307500;
  const costPerKg = 61.50;

  return {
    calculatedKg,
    purchasePrice,
    deliveryCost,
    totalCost,
    costPerKg,
  };
};
