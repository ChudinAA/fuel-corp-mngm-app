
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { CalculatedValues } from "./types";
import {
  calculateMovementMassTonnes,
  type MovementInputMode,
} from "./unit-calculations";
import { formatTonnes } from "@shared/units";

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

export const formatMovementMass = (tonnes: number | null | undefined) =>
  tonnes === null || tonnes === undefined ? "—" : `${formatTonnes(tonnes)} т`;

export const formatDate = (dateStr: string) => 
  format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });

export const calculateValues = (
  liters: string,
  density: string,
  tonnes: string,
  inputMode: MovementInputMode,
  purchasePricePerTonneValue: number | null = null,
  storageCostPerTonne: number | null = null,
  deliveryTariffPerTonne: number | null = null
): CalculatedValues => {
  const calculatedTonnes = calculateMovementMassTonnes(
    inputMode,
    tonnes,
    liters,
    density,
  );
  const tonnesNum = calculatedTonnes ?? 0;
  const purchasePricePerTonne = purchasePricePerTonneValue || 0;
  const purchaseAmount = tonnesNum * purchasePricePerTonne;
  const storageCost = tonnesNum * (storageCostPerTonne || 0);
  const deliveryCost = tonnesNum * (deliveryTariffPerTonne || 0);
  const totalCost = purchaseAmount + storageCost + deliveryCost;
  const costPerTonne = tonnesNum > 0 ? totalCost / tonnesNum : 0;

  return {
    calculatedTonnes,
    purchasePricePerTonne,
    deliveryCost,
    totalCost,
    costPerTonne,
  };
};
