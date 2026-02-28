export type ChainItemType = "intermediary" | "exchange_rate" | "bank_commission";

export type IntermediaryIncomeType = "percent_sale" | "royalty_per_ton" | "fixed";

export interface ChainIntermediaryItem {
  type: "intermediary";
  chainPosition: number;
  id?: string;
  intermediaryId: string;
  incomeType: IntermediaryIncomeType;
  rateValue?: number;
  commissionUsd: number | null;
  commissionRub: number | null;
  notes: string;
}

export interface ChainExchangeRateItem {
  type: "exchange_rate";
  chainPosition: number;
  id?: string;
  exchangeRateId?: string;
  fromCurrencyId?: string;
  toCurrencyId?: string;
  fromCurrencyCode?: string;
  toCurrencyCode?: string;
  rate?: number;
  rateDate?: string;
  notes?: string;
}

export interface ChainBankCommissionItem {
  type: "bank_commission";
  chainPosition: number;
  id?: string;
  commissionType: "percent" | "percent_min";
  percent?: number;
  minValue?: number;
  bankName?: string;
  notes?: string;
}

export type ChainItem =
  | ChainIntermediaryItem
  | ChainExchangeRateItem
  | ChainBankCommissionItem;

export function computeIntermediaryCommission(
  incomeType: IntermediaryIncomeType,
  rateValue: number | undefined,
  saleAmountUsd: number,
  quantityKg: number,
): number {
  if (!rateValue) return 0;
  if (incomeType === "percent_sale") return (saleAmountUsd * rateValue) / 100;
  if (incomeType === "royalty_per_ton") return (quantityKg / 1000) * rateValue;
  if (incomeType === "fixed") return rateValue;
  return 0;
}

export function computeBankCommission(
  commissionType: "percent" | "percent_min",
  percent: number | undefined,
  minValue: number | undefined,
  purchaseAmountUsd: number,
): number {
  if (!percent) return 0;
  const computed = (purchaseAmountUsd * percent) / 100;
  if (commissionType === "percent_min" && minValue) {
    return Math.max(computed, minValue);
  }
  return computed;
}
