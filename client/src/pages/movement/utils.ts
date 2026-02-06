
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

export const calculateKgFromLiters = (liters: number | null, density: number | null): number | null => {
  if (!liters || !density) return null;
  return parseFloat((liters * density).toFixed(0));
};

export const calculateValues = (
  liters: string,
  density: string,
  kg: string,
  inputMode: "liters" | "kg",
  purchasePriceValue: number | null = null,
  storageCostPerKg: number | null = null,
  deliveryTariffPerKg: number | null = null
): CalculatedValues => {
  const calculatedKg = inputMode === "liters" && liters && density
    ? calculateKgFromLiters(liters, density)
    : kg;

  const kgNum = calculatedKg ? parseFloat(calculatedKg) : 0;
  const purchasePrice = purchasePriceValue || 0;
  const purchaseAmount = kgNum * purchasePrice;
  const storageCost = storageCostPerKg ? kgNum * storageCostPerKg : 0;
  const deliveryCost = deliveryTariffPerKg ? kgNum * deliveryTariffPerKg : 0;
  const totalCost = purchaseAmount + storageCost + deliveryCost;
  const costPerKg = kgNum > 0 ? totalCost / kgNum : 0;

  return {
    calculatedKg,
    purchasePrice,
    deliveryCost,
    totalCost,
    costPerKg,
  };
};
