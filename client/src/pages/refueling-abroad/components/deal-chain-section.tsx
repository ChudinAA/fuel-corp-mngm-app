import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Plus,
  Trash2,
  ArrowRight,
  Link,
  Percent,
  Building2,
  Users,
} from "lucide-react";
import { CommissionCalculator } from "./commission-calculator";
import type { Supplier, ExchangeRate } from "@shared/schema";
import { formatCurrency } from "../utils";

export type ChainItemType = "intermediary" | "exchange_rate" | "bank_commission";

export interface ChainIntermediaryItem {
  type: "intermediary";
  chainPosition: number;
  id?: string;
  intermediaryId: string;
  commissionFormula: string;
  manualCommissionUsd: number | null;
  commissionUsd: number | null;
  commissionRub: number | null;
  buyCurrencyId?: string;
  sellCurrencyId?: string;
  buyExchangeRate?: number;
  sellExchangeRate?: number;
  crossConversionCost?: number;
  crossConversionCostRub?: number;
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

interface DealChainSectionProps {
  chainItems: ChainItem[];
  onChange: (items: ChainItem[]) => void;
  purchasePrice: number;
  salePrice: number;
  quantity: number;
  exchangeRate: number;
  currencies: any[];
}

function AddItemMenu({
  onAdd,
}: {
  onAdd: (type: ChainItemType) => void;
}) {
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
            <Link className="h-4 w-4 text-primary" />
            Курс
          </button>
          <button
            type="button"
            onClick={() => handleSelect("bank_commission")}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover-elevate text-left w-full"
            data-testid="menu-add-bank-commission"
          >
            <Building2 className="h-4 w-4 text-primary" />
            Комиссия банка
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface IntermediaryDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (item: Omit<ChainIntermediaryItem, "type" | "chainPosition">) => void;
  editItem?: ChainIntermediaryItem;
  purchasePrice: number;
  salePrice: number;
  quantity: number;
  exchangeRate: number;
  currencies: any[];
}

function IntermediaryDialog({
  open,
  onClose,
  onSave,
  editItem,
  purchasePrice,
  salePrice,
  quantity,
  exchangeRate,
  currencies,
}: IntermediaryDialogProps) {
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });
  const intermediarySuppliers = suppliers.filter((s) => s.isIntermediary);

  const [form, setForm] = useState({
    intermediaryId: editItem?.intermediaryId || "",
    commissionFormula: editItem?.commissionFormula || "",
    manualCommissionUsd: editItem?.manualCommissionUsd ?? null as number | null,
    commissionUsd: editItem?.commissionUsd ?? null as number | null,
    commissionRub: editItem?.commissionRub ?? null as number | null,
    buyCurrencyId: editItem?.buyCurrencyId || "",
    sellCurrencyId: editItem?.sellCurrencyId || "",
    buyExchangeRate: editItem?.buyExchangeRate,
    sellExchangeRate: editItem?.sellExchangeRate,
    crossConversionCost: editItem?.crossConversionCost || 0,
    crossConversionCostRub: editItem?.crossConversionCostRub || 0,
    notes: editItem?.notes || "",
  });

  const handleSave = () => {
    onSave({
      id: editItem?.id,
      ...form,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editItem ? "Редактировать посредника" : "Добавить посредника"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-1 block">Посредник</Label>
              <Select
                value={form.intermediaryId || "none"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    intermediaryId: v === "none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger data-testid="select-intermediary-dialog">
                  <SelectValue placeholder="Выберите посредника" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не выбран</SelectItem>
                  {intermediarySuppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">Заметки</Label>
              <Input
                placeholder="Заметки о посреднике"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/50 p-3 rounded-md">
            <div>
              <Label className="text-xs font-medium mb-1 block">Валюта закупа</Label>
              <Select
                value={form.buyCurrencyId || "none"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    buyCurrencyId: v === "none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Валюта" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не выбрана</SelectItem>
                  {currencies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1 block">Курс закупа</Label>
              <Input
                type="number"
                step="0.0001"
                value={form.buyExchangeRate || ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    buyExchangeRate: parseFloat(e.target.value) || undefined,
                  }))
                }
              />
            </div>
            <div>
              <Label className="text-xs font-medium mb-1 block">Валюта продажи</Label>
              <Select
                value={form.sellCurrencyId || "none"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    sellCurrencyId: v === "none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Валюта" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не выбрана</SelectItem>
                  {currencies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1 block">Курс продажи</Label>
              <Input
                type="number"
                step="0.0001"
                value={form.sellExchangeRate || ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    sellExchangeRate: parseFloat(e.target.value) || undefined,
                  }))
                }
              />
            </div>
          </div>

          <CommissionCalculator
            purchasePrice={purchasePrice}
            salePrice={salePrice}
            quantity={quantity}
            exchangeRate={exchangeRate}
            commissionFormula={form.commissionFormula}
            manualCommissionUsd={form.manualCommissionUsd?.toString() || ""}
            buyCurrencyId={form.buyCurrencyId || undefined}
            sellCurrencyId={form.sellCurrencyId || undefined}
            buyExchangeRate={form.buyExchangeRate}
            sellExchangeRate={form.sellExchangeRate}
            onFormulaChange={(formula) =>
              setForm((f) => ({ ...f, commissionFormula: formula }))
            }
            onManualCommissionChange={(usd) => {
              const parsed = usd === "" ? null : parseFloat(usd);
              setForm((f) => ({
                ...f,
                manualCommissionUsd: parsed,
                commissionUsd: parsed,
                commissionRub: parsed === null ? null : parsed * exchangeRate,
              }));
            }}
            onCommissionCalculated={(usd, rub, crossCost, crossCostRub, formula) => {
              setForm((f) => {
                if (
                  f.commissionUsd !== usd ||
                  f.commissionRub !== rub ||
                  f.crossConversionCost !== crossCost ||
                  f.crossConversionCostRub !== crossCostRub
                ) {
                  return {
                    ...f,
                    commissionUsd: usd,
                    commissionRub: rub,
                    crossConversionCost: crossCost || 0,
                    crossConversionCostRub: crossCostRub || 0,
                    commissionFormula: formula,
                  };
                }
                return f;
              });
            }}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="button" onClick={handleSave}>
            {editItem ? "Сохранить" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ExchangeRateDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (item: Omit<ChainExchangeRateItem, "type" | "chainPosition">) => void;
  editItem?: ChainExchangeRateItem;
  currencies: any[];
}

function ExchangeRateDialog({
  open,
  onClose,
  onSave,
  editItem,
  currencies,
}: ExchangeRateDialogProps) {
  const { data: exchangeRates = [] } = useQuery<ExchangeRate[]>({
    queryKey: ["/api/exchange-rates"],
  });

  const [useExisting, setUseExisting] = useState(!!editItem?.exchangeRateId);
  const [form, setForm] = useState({
    exchangeRateId: editItem?.exchangeRateId || "",
    fromCurrencyId: editItem?.fromCurrencyId || "",
    toCurrencyId: editItem?.toCurrencyId || "",
    fromCurrencyCode: editItem?.fromCurrencyCode || "",
    toCurrencyCode: editItem?.toCurrencyCode || "",
    rate: editItem?.rate || undefined as number | undefined,
    rateDate: editItem?.rateDate || "",
    notes: editItem?.notes || "",
  });

  const handleSelectExistingRate = (rateId: string) => {
    const rate = exchangeRates.find((r) => r.id === rateId);
    if (rate) {
      setForm((f) => ({
        ...f,
        exchangeRateId: rateId,
        fromCurrencyCode: rate.currency,
        toCurrencyCode: rate.targetCurrency,
        rate: parseFloat(rate.rate),
        rateDate: rate.rateDate,
      }));
    } else {
      setForm((f) => ({ ...f, exchangeRateId: rateId }));
    }
  };

  const handleSave = () => {
    const fromCurr = currencies.find((c) => c.id === form.fromCurrencyId);
    const toCurr = currencies.find((c) => c.id === form.toCurrencyId);
    onSave({
      id: editItem?.id,
      exchangeRateId: useExisting ? form.exchangeRateId || undefined : undefined,
      fromCurrencyId: form.fromCurrencyId || undefined,
      toCurrencyId: form.toCurrencyId || undefined,
      fromCurrencyCode: form.fromCurrencyCode || fromCurr?.code || undefined,
      toCurrencyCode: form.toCurrencyCode || toCurr?.code || undefined,
      rate: form.rate,
      rateDate: form.rateDate || undefined,
      notes: form.notes || undefined,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editItem ? "Редактировать курс" : "Добавить курс"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={useExisting ? "default" : "outline"}
              size="sm"
              onClick={() => setUseExisting(true)}
            >
              Из справочника
            </Button>
            <Button
              type="button"
              variant={!useExisting ? "default" : "outline"}
              size="sm"
              onClick={() => setUseExisting(false)}
            >
              Ввести вручную
            </Button>
          </div>

          {useExisting ? (
            <div>
              <Label className="text-sm font-medium mb-1 block">
                Курс из справочника
              </Label>
              <Select
                value={form.exchangeRateId || "none"}
                onValueChange={(v) =>
                  handleSelectExistingRate(v === "none" ? "" : v)
                }
              >
                <SelectTrigger data-testid="select-chain-exchange-rate">
                  <SelectValue placeholder="Выберите курс" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не выбран</SelectItem>
                  {exchangeRates.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.currency}/{r.targetCurrency} — {r.rate} (
                      {new Date(r.rateDate).toLocaleDateString("ru-RU")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {form.exchangeRateId && (
                <div className="mt-3 p-3 bg-muted/30 rounded-md text-sm">
                  <span className="text-muted-foreground">Выбранный курс: </span>
                  <span className="font-medium">
                    {form.fromCurrencyCode}/{form.toCurrencyCode} = {form.rate}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium mb-1 block">
                    Валюта (откуда)
                  </Label>
                  <Select
                    value={form.fromCurrencyId || "none"}
                    onValueChange={(v) => {
                      const curr = currencies.find((c) => c.id === (v === "none" ? "" : v));
                      setForm((f) => ({
                        ...f,
                        fromCurrencyId: v === "none" ? "" : v,
                        fromCurrencyCode: curr?.code || "",
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Валюта" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Не выбрана</SelectItem>
                      {currencies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1 block">
                    Валюта (куда)
                  </Label>
                  <Select
                    value={form.toCurrencyId || "none"}
                    onValueChange={(v) => {
                      const curr = currencies.find((c) => c.id === (v === "none" ? "" : v));
                      setForm((f) => ({
                        ...f,
                        toCurrencyId: v === "none" ? "" : v,
                        toCurrencyCode: curr?.code || "",
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Валюта" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Не выбрана</SelectItem>
                      {currencies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium mb-1 block">Курс</Label>
                  <Input
                    type="number"
                    step="0.000001"
                    placeholder="Например: 90.5"
                    value={form.rate || ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        rate: parseFloat(e.target.value) || undefined,
                      }))
                    }
                    data-testid="input-chain-exchange-rate"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1 block">Дата</Label>
                  <Input
                    type="date"
                    value={form.rateDate || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, rateDate: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium mb-1 block">Заметки</Label>
            <Input
              placeholder="Дополнительная информация"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="button" onClick={handleSave}>
            {editItem ? "Сохранить" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BankCommissionDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (item: Omit<ChainBankCommissionItem, "type" | "chainPosition">) => void;
  editItem?: ChainBankCommissionItem;
}

function BankCommissionDialog({
  open,
  onClose,
  onSave,
  editItem,
}: BankCommissionDialogProps) {
  const [form, setForm] = useState({
    commissionType: (editItem?.commissionType || "percent") as "percent" | "percent_min",
    percent: editItem?.percent || undefined as number | undefined,
    minValue: editItem?.minValue || undefined as number | undefined,
    bankName: editItem?.bankName || "",
    notes: editItem?.notes || "",
  });

  const handleSave = () => {
    onSave({
      id: editItem?.id,
      ...form,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editItem ? "Редактировать комиссию банка" : "Добавить комиссию банка"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Название банка</Label>
            <Input
              placeholder="Название банка (необязательно)"
              value={form.bankName}
              onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
              data-testid="input-bank-name"
            />
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Тип комиссии</Label>
            <RadioGroup
              value={form.commissionType}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  commissionType: v as "percent" | "percent_min",
                }))
              }
              className="space-y-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="percent" id="type-percent" />
                <Label htmlFor="type-percent" className="cursor-pointer font-normal">
                  Процент от суммы
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="percent_min" id="type-percent-min" />
                <Label htmlFor="type-percent-min" className="cursor-pointer font-normal">
                  Процент, но не менее...
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium mb-1 block">
                Процент (%)
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.percent || ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    percent: parseFloat(e.target.value) || undefined,
                  }))
                }
                data-testid="input-bank-commission-percent"
              />
            </div>
            {form.commissionType === "percent_min" && (
              <div>
                <Label className="text-sm font-medium mb-1 block">
                  Не менее (USD)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.minValue || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      minValue: parseFloat(e.target.value) || undefined,
                    }))
                  }
                  data-testid="input-bank-commission-min-value"
                />
              </div>
            )}
          </div>

          <div>
            <Label className="text-sm font-medium mb-1 block">Заметки</Label>
            <Input
              placeholder="Дополнительная информация"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="button" onClick={handleSave} data-testid="button-save-bank-commission">
            {editItem ? "Сохранить" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChainNode({
  item,
  currencies,
  intermediarySuppliers,
  onEdit,
  onRemove,
}: {
  item: ChainItem;
  currencies: any[];
  intermediarySuppliers: Supplier[];
  onEdit: () => void;
  onRemove: () => void;
}) {
  if (item.type === "intermediary") {
    const supplierName = intermediarySuppliers.find(
      (s) => s.id === item.intermediaryId,
    )?.name;
    return (
      <div className="flex flex-col items-center gap-1 group">
        <div
          className="flex flex-col bg-primary/5 border border-primary/20 rounded-md px-3 py-2 min-w-[100px] cursor-pointer hover-elevate"
          onClick={onEdit}
        >
          <div className="flex items-center gap-1 mb-1">
            <Users className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-semibold uppercase text-primary/70">
              Посредник
            </span>
          </div>
          <span className="text-xs font-medium truncate max-w-[120px]">
            {supplierName || (item.intermediaryId ? "Загрузка..." : "Не выбран")}
          </span>
          {item.buyCurrencyId && item.sellCurrencyId && (
            <span className="text-[10px] text-muted-foreground">
              {currencies.find((c) => c.id === item.buyCurrencyId)?.code || "?"}{" → "}
              {currencies.find((c) => c.id === item.sellCurrencyId)?.code || "?"}
            </span>
          )}
          {item.commissionUsd != null && item.commissionUsd !== 0 && (
            <span className="text-[10px] text-destructive font-medium">
              -{formatCurrency(item.commissionUsd, "USD")}
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
          className="flex flex-col bg-blue-500/5 border border-blue-500/20 rounded-md px-3 py-2 min-w-[100px] cursor-pointer hover-elevate"
          onClick={onEdit}
        >
          <div className="flex items-center gap-1 mb-1">
            <Link className="h-3 w-3 text-blue-500" />
            <span className="text-[10px] font-semibold uppercase text-blue-500/70">
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
            <span className="text-[10px] text-muted-foreground">{item.rate}</span>
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
    const commTypeLabel = item.commissionType === "percent_min"
      ? `${item.percent || 0}%, мин. ${item.minValue || 0}`
      : `${item.percent || 0}%`;

    return (
      <div className="flex flex-col items-center gap-1 group">
        <div
          className="flex flex-col bg-amber-500/5 border border-amber-500/20 rounded-md px-3 py-2 min-w-[100px] cursor-pointer hover-elevate"
          onClick={onEdit}
        >
          <div className="flex items-center gap-1 mb-1">
            <Building2 className="h-3 w-3 text-amber-600" />
            <span className="text-[10px] font-semibold uppercase text-amber-600/70">
              Банк
            </span>
          </div>
          {item.bankName && (
            <span className="text-xs font-medium truncate max-w-[120px]">
              {item.bankName}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{commTypeLabel}</span>
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

export function DealChainSection({
  chainItems,
  onChange,
  purchasePrice,
  salePrice,
  quantity,
  exchangeRate,
  currencies,
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

  const insertItemAtPosition = (position: number, item: Omit<ChainItem, "chainPosition">) => {
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
      const updated = [...chainItems];
      updated[editingIndex] = {
        ...updated[editingIndex],
        ...itemData,
      } as ChainExchangeRateItem;
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
    const reindexed = sorted.map((item, i) => ({ ...item, chainPosition: i }));
    onChange(reindexed);
  };

  const handleEdit = (index: number) => {
    const sorted = [...sortedItems];
    const originalIndex = chainItems.findIndex(
      (item) => item === sorted[index],
    );
    setEditingIndex(originalIndex !== -1 ? originalIndex : index);
    setAddingType(sorted[index].type);
  };

  const editingItem =
    editingIndex !== null ? chainItems[editingIndex] : undefined;

  const totalIntermediary = sortedItems
    .filter((i): i is ChainIntermediaryItem => i.type === "intermediary")
    .reduce((sum, i) => sum + (i.commissionUsd || 0), 0);

  const totalCrossLoss = sortedItems
    .filter((i): i is ChainIntermediaryItem => i.type === "intermediary")
    .reduce((sum, i) => sum + (i.crossConversionCost || 0), 0);

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
      <CardContent>
        <div className="bg-muted/20 p-4 rounded-lg border border-dashed border-primary/30">
          <div className="flex flex-wrap items-center gap-1">
            <div className="bg-background border rounded px-2 py-1.5 text-xs font-medium whitespace-nowrap shrink-0">
              Покупатель
            </div>

            <AddItemMenu
              onAdd={(type) => handleAddAtPosition(0, type)}
            />

            {sortedItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <ChainNode
                  item={item}
                  currencies={currencies}
                  intermediarySuppliers={intermediarySuppliers}
                  onEdit={() => handleEdit(idx)}
                  onRemove={() => handleRemove(idx)}
                />
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <AddItemMenu
                  onAdd={(type) => handleAddAtPosition(idx + 1, type)}
                />
              </div>
            ))}

            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="bg-background border rounded px-2 py-1.5 text-xs font-medium whitespace-nowrap shrink-0">
              Поставщик
            </div>
          </div>

          {(totalIntermediary > 0 || totalCrossLoss > 0) && (
            <div className="mt-3 pt-2 border-t border-dashed border-primary/20 flex flex-wrap gap-4 justify-between items-center">
              {totalIntermediary > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Комиссии посредников:
                  </span>
                  <span className="text-xs font-bold text-destructive">
                    -{formatCurrency(totalIntermediary, "USD")}
                  </span>
                </div>
              )}
              {totalCrossLoss > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Потери на кросс-курсах:
                  </span>
                  <span className="text-xs font-bold text-destructive">
                    -{formatCurrency(totalCrossLoss, "USD")}
                  </span>
                </div>
              )}
            </div>
          )}
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
      </CardContent>

      <IntermediaryDialog
        open={
          (addingType === "intermediary" && addingAtPosition !== null) ||
          (editingIndex !== null && editingItem?.type === "intermediary")
        }
        onClose={() => {
          setAddingAtPosition(null);
          setAddingType(null);
          setEditingIndex(null);
        }}
        onSave={handleSaveIntermediary}
        editItem={
          editingIndex !== null && editingItem?.type === "intermediary"
            ? (editingItem as ChainIntermediaryItem)
            : undefined
        }
        purchasePrice={purchasePrice}
        salePrice={salePrice}
        quantity={quantity}
        exchangeRate={exchangeRate}
        currencies={currencies}
      />

      <ExchangeRateDialog
        open={
          (addingType === "exchange_rate" && addingAtPosition !== null) ||
          (editingIndex !== null && editingItem?.type === "exchange_rate")
        }
        onClose={() => {
          setAddingAtPosition(null);
          setAddingType(null);
          setEditingIndex(null);
        }}
        onSave={handleSaveExchangeRate}
        editItem={
          editingIndex !== null && editingItem?.type === "exchange_rate"
            ? (editingItem as ChainExchangeRateItem)
            : undefined
        }
        currencies={currencies}
      />

      <BankCommissionDialog
        open={
          (addingType === "bank_commission" && addingAtPosition !== null) ||
          (editingIndex !== null && editingItem?.type === "bank_commission")
        }
        onClose={() => {
          setAddingAtPosition(null);
          setAddingType(null);
          setEditingIndex(null);
        }}
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
