import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, ArrowRight, Users, DollarSign, Percent, TrendingUp, TrendingDown } from "lucide-react";
import type { Supplier } from "@shared/schema";
import type { ChainItem, ChainItemType, ChainIntermediaryItem, ChainExchangeRateItem, ChainBankCommissionItem } from "./types";
import { computeIntermediaryCommission, computeBankCommission } from "./types";
import { ChainNode } from "./chain-node";
import { IntermediaryDialog } from "./dialogs/intermediary-dialog";
import { ExchangeRateDialog } from "./dialogs/exchange-rate-dialog";
import { BankCommissionDialog } from "./dialogs/bank-commission-dialog";
import { formatCurrency } from "../../utils";

export type { ChainItem, ChainItemType, ChainIntermediaryItem, ChainExchangeRateItem, ChainBankCommissionItem };

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
}: DealChainSectionProps) {
  const { data: allSuppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });
  const intermediarySuppliers = allSuppliers.filter((s) => s.isIntermediary);

  const [addingAtPosition, setAddingAtPosition] = useState<number | null>(null);
  const [addingType, setAddingType] = useState<ChainItemType | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const sortedItems = [...chainItems].sort(
    (a, b) => a.chainPosition - b.chainPosition,
  );

  const handleAddAtPosition = (position: number, type: ChainItemType) => {
    setAddingAtPosition(position);
    setAddingType(type);
  };

  const insertItemAtPosition = (
    position: number,
    item: Omit<ChainItem, "chainPosition">,
  ) => {
    const newItems = sortedItems.map((it) =>
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
      updated[editingIndex] = { ...updated[editingIndex], ...itemData } as ChainIntermediaryItem;
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
      const updated = [...chainItems];
      updated[editingIndex] = { ...updated[editingIndex], ...itemData } as ChainExchangeRateItem;
      onChange(updated);
      setEditingIndex(null);
    } else if (addingAtPosition !== null) {
      insertItemAtPosition(addingAtPosition, {
        type: "exchange_rate",
        ...itemData,
      } as Omit<ChainExchangeRateItem, "chainPosition">);
      setAddingAtPosition(null);
      setAddingType(null);
    }
  };

  const handleSaveBankCommission = (
    itemData: Omit<ChainBankCommissionItem, "type" | "chainPosition">,
  ) => {
    if (editingIndex !== null) {
      const updated = [...chainItems];
      updated[editingIndex] = { ...updated[editingIndex], ...itemData } as ChainBankCommissionItem;
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
  };

  const editingItem = editingIndex !== null ? chainItems[editingIndex] : undefined;

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
  };

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
      <CardContent className="space-y-3">
        <div className="bg-muted/20 p-4 rounded-lg border border-dashed border-primary/30">
          <div className="flex flex-wrap items-start gap-1">
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <div className="bg-background border-2 border-primary/30 rounded px-3 py-2 text-xs font-semibold whitespace-nowrap">
                Покупатель
              </div>
              {buyerName && (
                <span className="text-[10px] text-muted-foreground max-w-[100px] text-center truncate">
                  {buyerName}
                </span>
              )}
              {saleAmountUsd > 0 && (
                <span className="text-[10px] text-green-600 font-medium">
                  +{formatCurrency(saleAmountUsd, "USD")}
                </span>
              )}
            </div>

            <AddItemMenu onAdd={(type) => handleAddAtPosition(0, type)} />

            {sortedItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-[-8px]" />
                <ChainNode
                  item={item}
                  currencies={currencies}
                  intermediarySuppliers={intermediarySuppliers}
                  onEdit={() => handleEdit(idx)}
                  onRemove={() => handleRemove(idx)}
                  purchaseAmountUsd={purchaseAmountUsd}
                  saleAmountUsd={saleAmountUsd}
                  quantityKg={quantityKg}
                />
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-[-8px]" />
                <AddItemMenu
                  onAdd={(type) => handleAddAtPosition(idx + 1, type)}
                />
              </div>
            ))}

            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-[9px]" />
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <div className="bg-background border-2 border-primary/30 rounded px-3 py-2 text-xs font-semibold whitespace-nowrap">
                Поставщик
              </div>
              {supplierName && (
                <span className="text-[10px] text-muted-foreground max-w-[100px] text-center truncate">
                  {supplierName}
                </span>
              )}
              {purchaseAmountUsd > 0 && (
                <span className="text-[10px] text-destructive font-medium">
                  -{formatCurrency(purchaseAmountUsd, "USD")}
                </span>
              )}
            </div>
          </div>

          {sortedItems.length === 0 && (
            <p className="text-center text-sm text-muted-foreground mt-3">
              Нажмите{" "}
              <span className="inline-flex items-center gap-1 font-medium">
                <Plus className="h-3 w-3" />
              </span>{" "}
              между узлами цепочки, чтобы добавить элемент
            </p>
          )}
        </div>

        {hasSummary && (
          <div className="rounded-lg border bg-muted/10 p-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-0.5">
                <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">
                  Продажа
                </div>
                <div className="text-sm font-semibold text-green-600">
                  {formatCurrency(saleAmountUsd, "USD")}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">
                  Закупка
                </div>
                <div className="text-sm font-semibold">
                  {formatCurrency(purchaseAmountUsd, "USD")}
                </div>
              </div>
              {totalCosts > 0 && (
                <div className="space-y-0.5">
                  <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">
                    Расходы
                  </div>
                  <div className="text-sm font-semibold text-destructive">
                    -{formatCurrency(totalCosts, "USD")}
                  </div>
                  <div className="text-[10px] text-muted-foreground space-y-0">
                    {totalIntermediaryCommission > 0 && (
                      <div>Посредники: {formatCurrency(totalIntermediaryCommission, "USD")}</div>
                    )}
                    {totalBankCommission > 0 && (
                      <div>Банк: {formatCurrency(totalBankCommission, "USD")}</div>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-0.5">
                <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">
                  Прибыль
                </div>
                <div
                  className={`text-sm font-bold flex items-center gap-1 ${profit >= 0 ? "text-green-600" : "text-destructive"}`}
                >
                  {profit >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {formatCurrency(profit, "USD")}
                </div>
              </div>
            </div>
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
        editItem={
          editingIndex !== null && editingItem?.type === "exchange_rate"
            ? (editingItem as ChainExchangeRateItem)
            : undefined
        }
        currencies={currencies}
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
    </Card>
  );
}
