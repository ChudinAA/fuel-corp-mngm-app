import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  ArrowRight,
  Users,
  DollarSign,
  Percent,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";
import type { Supplier, Customer } from "@shared/schema";
import type {
  ChainItem,
  ChainItemType,
  ChainIntermediaryItem,
  ChainExchangeRateItem,
  ChainBankCommissionItem,
} from "./types";
import { computeIntermediaryCommission, computeBankCommission } from "./types";
import { ChainNode } from "./chain-node";
import { IntermediaryDialog } from "./dialogs/intermediary-dialog";
import { ExchangeRateDialog } from "./dialogs/exchange-rate-dialog";
import { BankCommissionDialog } from "./dialogs/bank-commission-dialog";
import { formatCurrency } from "../../utils";

export type {
  ChainItem,
  ChainItemType,
  ChainIntermediaryItem,
  ChainExchangeRateItem,
  ChainBankCommissionItem,
};

interface DealChainSectionProps {
  chainItems: ChainItem[];
  onChange: (items: ChainItem[]) => void;
  purchaseAmountUsd: number;
  saleAmountUsd: number;
  quantityKg: number;
  purchasePrice: number;
  salePrice: number;
  exchangeRate: number;
  currencies: any[];
  buyerName?: string;
  supplierName?: string;
  saleExchangeRate?: number;
  purchaseExchangeRate?: number;
  saleExchangeRateDate?: string;
  purchaseExchangeRateDate?: string;
}

function AddItemMenu({ onAdd }: { onAdd: (type: ChainItemType) => void }) {
  const [open, setOpen] = useState(false);

  const handleSelect = (type: ChainItemType) => {
    setOpen(false);
    onAdd(type);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-6 w-6 rounded-full border-dashed border-primary/60 bg-background z-10 shrink-0"
          data-testid="button-add-chain-item"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="center">
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => handleSelect("intermediary")}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover-elevate text-left w-full"
            data-testid="menu-add-intermediary"
          >
            <Users className="h-4 w-4 text-primary" />
            Посредник
          </button>
          <button
            type="button"
            onClick={() => handleSelect("exchange_rate")}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover-elevate text-left w-full"
            data-testid="menu-add-exchange-rate"
          >
            <DollarSign className="h-4 w-4 text-green-600" />
            Курс
          </button>
          <button
            type="button"
            onClick={() => handleSelect("bank_commission")}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover-elevate text-left w-full"
            data-testid="menu-add-bank-commission"
          >
            <Percent className="h-4 w-4 text-amber-600" />
            Комиссия банка
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DealChainSection({
  chainItems,
  onChange,
  purchaseAmountUsd,
  saleAmountUsd,
  quantityKg,
  purchasePrice,
  salePrice,
  exchangeRate,
  currencies,
  buyerName,
  supplierName,
  saleExchangeRate,
  purchaseExchangeRate,
  saleExchangeRateDate,
  purchaseExchangeRateDate,
}: DealChainSectionProps) {
  const { data: allSuppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });
  const { data: allCustomers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });
  const intermediarySuppliers = allSuppliers.filter((s) => s.isIntermediary);
  const intermediaryCustomers = allCustomers.filter((c) => c.isIntermediary);

  const rubCurrency = useMemo(
    () => currencies.find((c) => c.code === "RUB"),
    [currencies],
  );

  const [addingAtPosition, setAddingAtPosition] = useState<number | null>(null);
  const [addingType, setAddingType] = useState<ChainItemType | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [chainReplaceAlertOpen, setChainReplaceAlertOpen] = useState(false);
  const [pendingExchangeRateAdd, setPendingExchangeRateAdd] = useState<{
    position: number;
    prefillFromCurrencyId?: string;
    prefillFromCurrencyCode?: string;
    itemsToRemoveIndices: number[];
  } | null>(null);
  const [pendingEditWithReplace, setPendingEditWithReplace] = useState<{
    editingIndex: number;
    newItemData: Omit<ChainExchangeRateItem, "type" | "chainPosition">;
    itemsToRemoveIndices: number[];
  } | null>(null);

  const sortedItems = useMemo(
    () => [...chainItems].sort((a, b) => a.chainPosition - b.chainPosition),
    [chainItems],
  );

  const exchangeRateItems = useMemo(
    () =>
      sortedItems.filter(
        (it): it is ChainExchangeRateItem => it.type === "exchange_rate",
      ),
    [sortedItems],
  );

  const lastExchangeRateItem = exchangeRateItems[exchangeRateItems.length - 1];
  const hasExchangeRates = exchangeRateItems.length > 0;
  const lastToCurrencyCode = lastExchangeRateItem?.toCurrencyCode;
  const chainEndsWithUsd = !hasExchangeRates || lastToCurrencyCode === "USD";

  const saleAmountRub =
    saleExchangeRate && saleAmountUsd ? saleAmountUsd * saleExchangeRate : null;
  const purchaseAmountRub =
    purchaseExchangeRate && purchaseAmountUsd
      ? purchaseAmountUsd * purchaseExchangeRate
      : null;

  const runningAmounts = useMemo(() => {
    if (!saleAmountRub) return [];
    const amounts: { fromAmount: number; toAmount: number }[] = [];
    let current = saleAmountRub;
    for (const item of exchangeRateItems) {
      const fromAmt = current;
      const toAmt = item.rate != null ? current * item.rate : 0;
      amounts.push({ fromAmount: fromAmt, toAmount: toAmt });
      current = toAmt;
    }
    return amounts;
  }, [exchangeRateItems, saleAmountRub]);

  const chainFinalUsd = useMemo(() => {
    if (!hasExchangeRates || !saleAmountRub) return null;
    let current = saleAmountRub;
    for (const item of exchangeRateItems) {
      if (!item.rate || item.rate === 0) return null;
      current = current * item.rate;
    }
    return current;
  }, [exchangeRateItems, saleAmountRub, hasExchangeRates]);

  const getExchangeRatePrefill = (position: number) => {
    const exchangeRatesBefore = sortedItems.filter(
      (it): it is ChainExchangeRateItem =>
        it.type === "exchange_rate" && it.chainPosition < position,
    );
    const lastBefore = exchangeRatesBefore[exchangeRatesBefore.length - 1];

    if (lastBefore) {
      return {
        prefillFromCurrencyId: currencies.find(
          (c) => c.code === lastBefore.toCurrencyCode,
        )?.id,
        prefillFromCurrencyCode: lastBefore.toCurrencyCode,
      };
    }

    return {
      prefillFromCurrencyId: rubCurrency?.id,
      prefillFromCurrencyCode: rubCurrency?.code || "RUB",
    };
  };

  const getInputAmountForPosition = (position: number): { amount: number; currencyCode: string } | null => {
    if (!saleAmountRub) return null;
    const exchangeRatesBefore = sortedItems.filter(
      (it): it is ChainExchangeRateItem =>
        it.type === "exchange_rate" && it.chainPosition < position,
    );
    if (exchangeRatesBefore.length === 0) {
      return { amount: saleAmountRub, currencyCode: rubCurrency?.code || "RUB" };
    }
    let current = saleAmountRub;
    let lastCode = rubCurrency?.code || "RUB";
    for (const item of exchangeRatesBefore) {
      if (!item.rate || item.rate === 0) return null;
      current = current * item.rate;
      lastCode = item.toCurrencyCode || lastCode;
    }
    return { amount: current, currencyCode: lastCode };
  };

  const handleAddAtPosition = (position: number, type: ChainItemType) => {
    if (type === "exchange_rate") {
      const exchangeRateItemsAfter = sortedItems.filter(
        (it) => it.type === "exchange_rate" && it.chainPosition >= position,
      );
      const prefill = getExchangeRatePrefill(position);

      if (exchangeRateItemsAfter.length > 0) {
        const itemsToRemoveIndices = exchangeRateItemsAfter.map((item) =>
          sortedItems.indexOf(item),
        );
        setPendingExchangeRateAdd({
          position,
          ...prefill,
          itemsToRemoveIndices,
        });
        setChainReplaceAlertOpen(true);
        return;
      }

      setPendingExchangeRateAdd({
        position,
        ...prefill,
        itemsToRemoveIndices: [],
      });
      setAddingAtPosition(position);
      setAddingType(type);
      return;
    }

    setAddingAtPosition(position);
    setAddingType(type);
  };

  const handleChainReplaceConfirm = () => {
    if (pendingEditWithReplace) {
      const { editingIndex: idx, newItemData, itemsToRemoveIndices } = pendingEditWithReplace;
      const sorted = [...sortedItems];
      const itemsToRemove = new Set(
        itemsToRemoveIndices.map((i) => sorted[i]).filter(Boolean),
      );
      const updatedChain = chainItems.map((item, i) => {
        if (itemsToRemove.has(item)) return null;
        if (i === idx) {
          return { ...item, ...newItemData } as ChainExchangeRateItem;
        }
        return item;
      }).filter((item): item is ChainItem => item !== null);
      const reindexed = [...updatedChain].sort((a, b) => a.chainPosition - b.chainPosition).map((item, i) => ({
        ...item,
        chainPosition: i,
      }));
      onChange(reindexed);
      setChainReplaceAlertOpen(false);
      setPendingEditWithReplace(null);
      closeDialogs();
      return;
    }

    if (!pendingExchangeRateAdd) return;
    const { position, itemsToRemoveIndices } = pendingExchangeRateAdd;
    const sorted = [...sortedItems];
    const itemsToRemove = new Set(
      itemsToRemoveIndices.map((i) => sorted[i]).filter(Boolean),
    );
    const remaining = sorted.filter((item) => !itemsToRemove.has(item));
    const reindexed = remaining.map((item, i) => ({
      ...item,
      chainPosition: i,
    }));
    onChange(reindexed);

    setChainReplaceAlertOpen(false);
    setAddingAtPosition(pendingExchangeRateAdd.position);
    setAddingType("exchange_rate");
  };

  const handleChainReplaceCancel = () => {
    setChainReplaceAlertOpen(false);
    setPendingExchangeRateAdd(null);
    setPendingEditWithReplace(null);
  };

  const insertItemAtPosition = (
    position: number,
    item: Omit<ChainItem, "chainPosition">,
  ) => {
    const currentSorted = [...chainItems].sort(
      (a, b) => a.chainPosition - b.chainPosition,
    );
    const newItems = currentSorted.map((it) =>
      it.chainPosition >= position
        ? { ...it, chainPosition: it.chainPosition + 1 }
        : it,
    );
    const newItem = { ...item, chainPosition: position } as ChainItem;
    const result = [...newItems, newItem].sort(
      (a, b) => a.chainPosition - b.chainPosition,
    );
    onChange(result);
  };

  const handleSaveIntermediary = (
    itemData: Omit<ChainIntermediaryItem, "type" | "chainPosition">,
  ) => {
    if (editingIndex !== null) {
      const updated = [...chainItems];
      updated[editingIndex] = {
        ...updated[editingIndex],
        ...itemData,
      } as ChainIntermediaryItem;
      onChange(updated);
      setEditingIndex(null);
    } else if (addingAtPosition !== null) {
      insertItemAtPosition(addingAtPosition, {
        type: "intermediary",
        ...itemData,
      } as Omit<ChainIntermediaryItem, "chainPosition">);
      setAddingAtPosition(null);
      setAddingType(null);
    }
  };

  const handleSaveExchangeRate = (
    itemData: Omit<ChainExchangeRateItem, "type" | "chainPosition">,
  ) => {
    if (editingIndex !== null) {
      const currentItem = chainItems[editingIndex] as ChainExchangeRateItem;
      const toCurrencyChanged =
        itemData.toCurrencyCode &&
        currentItem.toCurrencyCode &&
        itemData.toCurrencyCode !== currentItem.toCurrencyCode;

      if (toCurrencyChanged) {
        const editedPosition = currentItem.chainPosition;
        const erItemsAfter = sortedItems.filter(
          (it): it is ChainExchangeRateItem =>
            it.type === "exchange_rate" && it.chainPosition > editedPosition,
        );
        if (erItemsAfter.length > 0) {
          const itemsToRemoveIndices = erItemsAfter.map((item) =>
            sortedItems.indexOf(item),
          );
          setPendingEditWithReplace({
            editingIndex,
            newItemData: itemData,
            itemsToRemoveIndices,
          });
          setChainReplaceAlertOpen(true);
          return;
        }
      }

      const updated = [...chainItems];
      updated[editingIndex] = {
        ...updated[editingIndex],
        ...itemData,
      } as ChainExchangeRateItem;
      onChange(updated);
      setEditingIndex(null);
      closeDialogs();
    } else if (addingAtPosition !== null) {
      insertItemAtPosition(addingAtPosition, {
        type: "exchange_rate",
        ...itemData,
      } as Omit<ChainExchangeRateItem, "chainPosition">);
      setAddingAtPosition(null);
      setAddingType(null);
      setPendingExchangeRateAdd(null);
    }
  };

  const handleSaveBankCommission = (
    itemData: Omit<ChainBankCommissionItem, "type" | "chainPosition">,
  ) => {
    if (editingIndex !== null) {
      const updated = [...chainItems];
      updated[editingIndex] = {
        ...updated[editingIndex],
        ...itemData,
      } as ChainBankCommissionItem;
      onChange(updated);
      setEditingIndex(null);
    } else if (addingAtPosition !== null) {
      insertItemAtPosition(addingAtPosition, {
        type: "bank_commission",
        ...itemData,
      } as Omit<ChainBankCommissionItem, "chainPosition">);
      setAddingAtPosition(null);
      setAddingType(null);
    }
  };

  const handleRemove = (index: number) => {
    const sorted = [...sortedItems];
    sorted.splice(index, 1);
    const reindexed = sorted.map((item, i) => ({
      ...item,
      chainPosition: i,
    }));
    onChange(reindexed);
  };

  const handleEdit = (index: number) => {
    const sorted = [...sortedItems];
    const originalIndex = chainItems.findIndex((item) => item === sorted[index]);
    setEditingIndex(originalIndex !== -1 ? originalIndex : index);
    setAddingType(sorted[index].type);

    if (sorted[index].type === "exchange_rate") {
      const item = sorted[index] as ChainExchangeRateItem;
      const prefill = getExchangeRatePrefill(item.chainPosition);
      setPendingExchangeRateAdd({
        position: item.chainPosition,
        ...prefill,
        itemsToRemoveIndices: [],
      });
    }
  };

  const editingItem =
    editingIndex !== null ? chainItems[editingIndex] : undefined;

  const intermediaryItems = sortedItems.filter(
    (i): i is ChainIntermediaryItem => i.type === "intermediary",
  );
  const bankCommissionItems = sortedItems.filter(
    (i): i is ChainBankCommissionItem => i.type === "bank_commission",
  );

  const totalIntermediaryCommission = intermediaryItems.reduce((sum, item) => {
    return (
      sum +
      computeIntermediaryCommission(
        item.incomeType || "fixed",
        item.rateValue,
        saleAmountUsd,
        quantityKg,
      )
    );
  }, 0);

  const totalBankCommission = bankCommissionItems.reduce((sum, item) => {
    return (
      sum +
      computeBankCommission(
        item.commissionType,
        item.percent,
        item.minValue,
        purchaseAmountUsd,
      )
    );
  }, 0);

  const totalCosts = totalIntermediaryCommission + totalBankCommission;
  const profit = saleAmountUsd - purchaseAmountUsd - totalCosts;
  const hasSummary = purchaseAmountUsd > 0 || saleAmountUsd > 0;

  const costsRub = saleExchangeRate && totalCosts ? totalCosts * saleExchangeRate : null;
  const profitRub =
    saleAmountRub !== null && purchaseAmountRub !== null
      ? saleAmountRub - purchaseAmountRub - (costsRub ?? 0)
      : null;

  const isIntermediaryDialogOpen =
    (addingType === "intermediary" && addingAtPosition !== null) ||
    (editingIndex !== null && editingItem?.type === "intermediary");
  const isExchangeRateDialogOpen =
    (addingType === "exchange_rate" && addingAtPosition !== null) ||
    (editingIndex !== null && editingItem?.type === "exchange_rate");
  const isBankCommissionDialogOpen =
    (addingType === "bank_commission" && addingAtPosition !== null) ||
    (editingIndex !== null && editingItem?.type === "bank_commission");

  const dialogKey =
    editingIndex !== null
      ? `edit-${editingIndex}`
      : addingAtPosition !== null
        ? `add-${addingAtPosition}-${addingType}`
        : "none";

  const closeDialogs = () => {
    setAddingAtPosition(null);
    setAddingType(null);
    setEditingIndex(null);
    setPendingExchangeRateAdd(null);
  };

  const editingExchangeRateItem =
    editingIndex !== null && editingItem?.type === "exchange_rate"
      ? (editingItem as ChainExchangeRateItem)
      : undefined;

  const dialogPrefillFromCurrencyCode = editingExchangeRateItem
    ? (editingExchangeRateItem.fromCurrencyCode || pendingExchangeRateAdd?.prefillFromCurrencyCode)
    : pendingExchangeRateAdd?.prefillFromCurrencyCode;

  const dialogPrefillFromCurrencyId = editingExchangeRateItem
    ? (currencies.find((c) => c.code === dialogPrefillFromCurrencyCode)?.id || pendingExchangeRateAdd?.prefillFromCurrencyId)
    : pendingExchangeRateAdd?.prefillFromCurrencyId;

  const dialogInputAmount = useMemo(() => {
    const position = editingExchangeRateItem
      ? editingExchangeRateItem.chainPosition
      : addingAtPosition;
    if (position == null) return null;
    return getInputAmountForPosition(position);
  }, [editingExchangeRateItem, addingAtPosition, sortedItems, saleAmountRub]);

  const erIndexMap = useMemo(() => {
    let erIdx = 0;
    const map: Record<number, number> = {};
    sortedItems.forEach((item, idx) => {
      if (item.type === "exchange_rate") {
        map[idx] = erIdx++;
      }
    });
    return map;
  }, [sortedItems]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Цепочка сделки ({sortedItems.length})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {!chainEndsWithUsd && (
          <Alert variant="destructive" className="py-2">
            {/* <AlertTriangle className="h-4 w-4" /> */}
            <AlertDescription className="text-sm">
              Цепочка курсов должна завершаться валютой{" "}
              <strong>USD</strong>. Текущая конечная валюта:{" "}
              <strong>{lastToCurrencyCode || "не задана"}</strong>. Добавьте
              или исправьте последний курс.
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-muted/20 p-4 rounded-lg border border-dashed border-primary/30 overflow-x-auto">
          <div className="flex flex-nowrap items-center gap-1 min-w-max">
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <div className="bg-background border-2 border-primary/30 rounded px-3 py-2 text-xs font-semibold whitespace-nowrap">
                {buyerName || "Покупатель"}
              </div>
              {saleAmountUsd > 0 && (
                <span className="text-[11px] text-green-600 font-medium">
                  +{formatCurrency(saleAmountUsd, "USD")}
                </span>
              )}
              {saleAmountRub !== null && (
                <span className="text-[10px] text-muted-foreground">
                  {new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(saleAmountRub)} ₽
                </span>
              )}
            </div>

            <AddItemMenu onAdd={(type) => handleAddAtPosition(0, type)} />

            {sortedItems.map((item, idx) => {
              const erIdx = erIndexMap[idx];
              const running = erIdx !== undefined ? runningAmounts[erIdx] : undefined;
              return (
                <div key={idx} className="flex items-center gap-1">
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-[-8px]" />
                  <ChainNode
                    item={item}
                    currencies={currencies}
                    intermediarySuppliers={intermediarySuppliers}
                    intermediaryCustomers={intermediaryCustomers}
                    onEdit={() => handleEdit(idx)}
                    onRemove={() => handleRemove(idx)}
                    purchaseAmountUsd={purchaseAmountUsd}
                    saleAmountUsd={saleAmountUsd}
                    quantityKg={quantityKg}
                    fromAmount={running?.fromAmount}
                    toAmount={running?.toAmount}
                  />
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-[-8px]" />
                  <AddItemMenu
                    onAdd={(type) => handleAddAtPosition(idx + 1, type)}
                  />
                </div>
              );
            })}

            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <div className="bg-background border-2 border-primary/30 rounded px-3 py-2 text-xs font-semibold whitespace-nowrap">
                {supplierName || "Поставщик"}
              </div>
              {purchaseAmountUsd > 0 && (
                <span className="text-[11px] text-destructive font-medium">
                  -{formatCurrency(purchaseAmountUsd, "USD")}
                </span>
              )}
            </div>
          </div>

          {sortedItems.length === 0 && (
            <p className="text-center text-sm text-muted-foreground mt-3">
              Нажмите <span className="inline-flex items-center gap-1 font-medium"><Plus className="h-3 w-3" /></span> чтобы добавить элемент
            </p>
          )}
        </div>

        {hasSummary && (
          <div className="rounded-lg border bg-muted/10 p-3 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-0.5">
                <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">
                  Продажа
                </div>
                <div className="text-sm font-semibold text-green-600 flex items-baseline gap-1 flex-wrap">
                  <span>{formatCurrency(saleAmountUsd, "USD")}</span>
                  {saleAmountRub !== null && (
                    <span className="text-[12px] text-muted-foreground font-normal">
                      ({new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(saleAmountRub)} ₽)
                    </span>
                  )}
                </div>
                {saleExchangeRateDate && (
                  <div className="text-[11px] text-muted-foreground">
                    Курс: {saleExchangeRateDate}
                  </div>
                )}
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">
                  Закупка
                </div>
                <div className="text-sm font-semibold flex items-baseline gap-1 flex-wrap">
                  <span>{formatCurrency(purchaseAmountUsd, "USD")}</span>
                  {purchaseAmountRub !== null && (
                    <span className="text-[12px] text-muted-foreground font-normal">
                      ({new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(purchaseAmountRub)} ₽)
                    </span>
                  )}
                </div>
                {purchaseExchangeRateDate && (
                  <div className="text-[11px] text-muted-foreground">
                    Курс: {purchaseExchangeRateDate}
                  </div>
                )}
              </div>
              {totalCosts > 0 && (
                <div className="space-y-0.5">
                  <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">
                    Расходы
                  </div>
                  <div className="text-sm font-semibold text-destructive flex items-baseline gap-1 flex-wrap">
                    <span>-{formatCurrency(totalCosts, "USD")}</span>
                    {costsRub !== null && (
                      <span className="text-[12px] font-normal">
                        ({new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(costsRub)} ₽)
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {totalIntermediaryCommission > 0 && (
                      <div>Посредники: {formatCurrency(totalIntermediaryCommission, "USD")}</div>
                    )}
                    {totalBankCommission > 0 && (
                      <div>Банк. комисс.: {formatCurrency(totalBankCommission, "USD")}</div>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-0.5">
                <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">
                  Прибыль
                </div>
                <div className={`text-sm font-bold flex items-center gap-1 flex-wrap ${profit >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {profit >= 0 ? (
                    <TrendingUp className="h-3 w-3 shrink-0" />
                  ) : (
                    <TrendingDown className="h-3 w-3 shrink-0" />
                  )}
                  <span>{formatCurrency(profit, "USD")}</span>
                  {profitRub !== null && (
                    <span className={`text-[12px] font-normal ${profitRub >= 0 ? "text-green-600" : "text-destructive"}`}>
                      ({new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(profitRub)} ₽)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {hasExchangeRates && saleAmountRub !== null && (
              <div className="border-t pt-2.5">
                <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide mb-2">
                  Цепочка конвертации валют
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="space-y-0.5 p-2 rounded-md bg-background border">
                    <div className="text-[10px] text-muted-foreground uppercase font-medium">
                      Получено от покупателя
                    </div>
                    <div className="font-semibold">
                      {new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(saleAmountRub)} ₽
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      = {formatCurrency(saleAmountUsd, "USD")} по курсу продажи
                    </div>
                  </div>
                  <div className="space-y-0.5 p-2 rounded-md bg-background border">
                    <div className="text-[10px] text-muted-foreground uppercase font-medium">
                      После конвертации цепочки
                    </div>
                    {!chainEndsWithUsd ? (
                      <div className="font-semibold text-muted-foreground">—</div>
                    ) : (
                      <>
                        <div className="font-semibold text-green-600">
                          {chainFinalUsd !== null ? formatCurrency(chainFinalUsd, "USD") : "—"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          через {exchangeRateItems.length} курс{exchangeRateItems.length === 1 ? "" : exchangeRateItems.length < 5 ? "а" : "ов"}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="space-y-0.5 p-2 rounded-md bg-background border">
                    <div className="text-[10px] text-muted-foreground uppercase font-medium">
                      Разница с курсом продажи
                    </div>
                    {!chainEndsWithUsd || chainFinalUsd === null ? (
                      <div className="font-semibold text-muted-foreground">—</div>
                    ) : (
                      (() => {
                        const diff = chainFinalUsd - saleAmountUsd;
                        const diffRub = saleExchangeRate ? diff * saleExchangeRate : null;
                        return (
                          <>
                            <div className={`font-semibold ${diff >= 0 ? "text-green-600" : "text-destructive"}`}>
                              {diff >= 0 ? "+" : ""}{formatCurrency(diff, "USD")}
                            </div>
                            {diffRub !== null && (
                              <div className={`text-[11px] ${diff >= 0 ? "text-green-600" : "text-destructive"}`}>
                                {diff >= 0 ? "+" : ""}{new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(diffRub)} ₽
                              </div>
                            )}
                            <div className="text-[10px] text-muted-foreground">
                              {diff >= 0 ? "выгода" : "потери"} конвертации vs прямой курс
                            </div>
                          </>
                        );
                      })()
                    )}
                  </div>
                </div>
                {purchaseAmountUsd > 0 && (
                  <div className="mt-2 p-2 rounded-md bg-muted/30 text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
                    <span>Курс закупки: <strong className="text-foreground">{formatCurrency(purchaseAmountUsd, "USD")}</strong></span>
                    {!chainEndsWithUsd || chainFinalUsd === null ? (
                      <span>Цепочка vs закупка: <strong className="text-muted-foreground">—</strong></span>
                    ) : (
                      <span>Цепочка vs закупка: <strong className={chainFinalUsd >= purchaseAmountUsd ? "text-green-600" : "text-destructive"}>{formatCurrency(chainFinalUsd - purchaseAmountUsd, "USD")}</strong></span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <IntermediaryDialog
        key={`intermediary-${dialogKey}`}
        open={isIntermediaryDialogOpen}
        onClose={closeDialogs}
        onSave={handleSaveIntermediary}
        editItem={
          editingIndex !== null && editingItem?.type === "intermediary"
            ? (editingItem as ChainIntermediaryItem)
            : undefined
        }
        saleAmountUsd={saleAmountUsd}
        purchaseAmountUsd={purchaseAmountUsd}
        quantityKg={quantityKg}
        exchangeRate={exchangeRate}
      />

      <ExchangeRateDialog
        key={`exchange-${dialogKey}`}
        open={isExchangeRateDialogOpen}
        onClose={closeDialogs}
        onSave={handleSaveExchangeRate}
        editItem={editingExchangeRateItem}
        currencies={currencies}
        prefillFromCurrencyId={dialogPrefillFromCurrencyId}
        prefillFromCurrencyCode={dialogPrefillFromCurrencyCode}
        inputAmount={dialogInputAmount?.amount}
        inputCurrencyCode={dialogInputAmount?.currencyCode}
      />

      <BankCommissionDialog
        key={`bank-${dialogKey}`}
        open={isBankCommissionDialogOpen}
        onClose={closeDialogs}
        onSave={handleSaveBankCommission}
        editItem={
          editingIndex !== null && editingItem?.type === "bank_commission"
            ? (editingItem as ChainBankCommissionItem)
            : undefined
        }
      />

      <AlertDialog
        open={chainReplaceAlertOpen}
        onOpenChange={setChainReplaceAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Заменить цепочку курсов?</AlertDialogTitle>
            <AlertDialogDescription>
              При добавлении нового курса в эту позицию все курсы правее будут
              удалены из цепочки. Продолжить?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleChainReplaceCancel}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleChainReplaceConfirm}>
              Продолжить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
