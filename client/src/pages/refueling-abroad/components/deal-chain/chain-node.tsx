import { Button } from "@/components/ui/button";
import { Trash2, Users, DollarSign, Percent, ArrowRight } from "lucide-react";
import type { ChainItem, ChainIntermediaryItem } from "./types";
import {
  computeIntermediaryCommission,
  computeBankCommission,
} from "./types";
import { formatCurrency } from "../../utils";
import type { Supplier, Customer } from "@shared/schema";

interface ChainNodeProps {
  item: ChainItem;
  currencies: any[];
  intermediarySuppliers: Supplier[];
  intermediaryCustomers?: Customer[];
  onEdit: () => void;
  onRemove: () => void;
  purchaseAmountUsd: number;
  saleAmountUsd: number;
  quantityKg: number;
  fromAmount?: number;
  toAmount?: number;
}

const INCOME_TYPE_SHORT: Record<string, string> = {
  percent_sale: "% от продажи",
  royalty_per_ton: "Роялти/т",
  fixed: "Фикс.",
};

function formatRunningAmount(amount: number, currencyCode?: string): string {
  if (amount === 0) return "0";
  const symbols: Record<string, string> = {
    RUB: "₽", USD: "$", EUR: "€", KZT: "₸",
    AZN: "₼", GEL: "₾", TRY: "₺", CNY: "¥",
  };
  const sym = currencyCode ? (symbols[currencyCode] || currencyCode) : "";
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M ${sym}`.trim();
  }
  if (Math.abs(amount) >= 1_000) {
    return `${Math.round(amount).toLocaleString("ru-RU")} ${sym}`.trim();
  }
  return `${amount.toFixed(2)} ${sym}`.trim();
}

export function ChainNode({
  item,
  currencies,
  intermediarySuppliers,
  intermediaryCustomers = [],
  onEdit,
  onRemove,
  purchaseAmountUsd,
  saleAmountUsd,
  quantityKg,
  fromAmount,
  toAmount,
}: ChainNodeProps) {
  if (item.type === "intermediary") {
    const supplierName = intermediarySuppliers.find(
      (s) => s.id === item.intermediaryId,
    )?.name;
    const customerName = intermediaryCustomers.find(
      (c) => c.id === item.intermediaryId,
    )?.name;
    const intermediaryName = supplierName || customerName;

    const realtimeCommission = computeIntermediaryCommission(
      item.incomeType || "fixed",
      item.rateValue,
      saleAmountUsd,
      quantityKg,
    );

    item.commissionUsd = realtimeCommission;

    const rateDisplay =
      item.incomeType === "percent_sale"
        ? `${item.rateValue ?? 0}%`
        : item.incomeType === "royalty_per_ton"
          ? `${item.rateValue ?? 0} $/т`
          : `${item.rateValue ?? 0} $`;

    return (
      <div className="flex flex-col items-center gap-1 group">
        <div
          className="flex flex-col bg-primary/5 border border-primary/20 rounded-md px-3 py-2 min-w-[110px] cursor-pointer hover-elevate"
          onClick={onEdit}
        >
          <div className="flex items-center gap-1 mb-1">
            <Users className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-semibold uppercase text-primary/70">
              Посредник
            </span>
          </div>
          <span className="text-xs font-medium truncate max-w-[130px]">
            {intermediaryName || (item.intermediaryId ? "Загрузка..." : "Не выбран")}
          </span>
          {item.incomeType && (
            <span className="text-[10.5px] text-muted-foreground">
              {INCOME_TYPE_SHORT[item.incomeType]} ({rateDisplay})
            </span>
          )}
          {realtimeCommission > 0 && (
            <span className="text-[10.5px] text-destructive font-medium mt-0.5">
              -{formatCurrency(realtimeCommission, "USD")}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    );
  }

  if (item.type === "exchange_rate") {
    return (
      <div className="flex flex-col items-center gap-1 group">
        <div
          className="flex flex-col bg-green-500/5 border border-green-500/20 rounded-md px-3 py-2 min-w-[110px] cursor-pointer hover-elevate"
          onClick={onEdit}
        >
          <div className="flex items-center gap-1 mb-1">
            <DollarSign className="h-3 w-3 text-green-600" />
            <span className="text-[10px] font-semibold uppercase text-green-500/70">
              Курс
            </span>
          </div>
          {item.fromCurrencyCode && item.toCurrencyCode ? (
            <span className="text-xs font-medium">
              {item.fromCurrencyCode} → {item.toCurrencyCode}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Не задан</span>
          )}
          {item.rate != null && (
            <span className="text-[10.5px] text-muted-foreground">
              {item.rate}
            </span>
          )}
          {fromAmount != null && toAmount != null && item.fromCurrencyCode && item.toCurrencyCode && (
            <div className="flex items-center gap-0.5 mt-1 flex-wrap">
              <span className="text-[10px] text-muted-foreground">
                {formatRunningAmount(fromAmount, item.fromCurrencyCode)}
              </span>
              <ArrowRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
              <span className="text-[10px] font-medium text-green-600">
                {formatRunningAmount(toAmount, item.toCurrencyCode)}
              </span>
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    );
  }

  if (item.type === "bank_commission") {
    const realtimeCommission = computeBankCommission(
      item.commissionType,
      item.percent,
      item.minValue,
      purchaseAmountUsd,
    );

    const commTypeLabel =
      item.commissionType === "percent_min"
        ? `${item.percent ?? 0}%, мин. ${item.minValue ?? 0} $`
        : `${item.percent ?? 0}%`;

    return (
      <div className="flex flex-col items-center gap-1 group">
        <div
          className="flex flex-col bg-amber-500/5 border border-amber-500/20 rounded-md px-3 py-2 min-w-[110px] cursor-pointer hover-elevate"
          onClick={onEdit}
        >
          <div className="flex items-center gap-1 mb-1">
            <Percent className="h-3 w-3 text-amber-600" />
            <span className="text-[10px] font-semibold uppercase text-amber-600/70">
              Банк
            </span>
          </div>
          {item.bankName && (
            <span className="text-xs font-medium truncate max-w-[130px]">
              {item.bankName}
            </span>
          )}
          <span className="text-[10.5px] text-muted-foreground">
            {commTypeLabel}
          </span>
          {realtimeCommission > 0 && (
            <span className="text-[10.5px] text-destructive font-medium mt-0.5">
              -{formatCurrency(realtimeCommission, "USD")}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    );
  }

  return null;
}
