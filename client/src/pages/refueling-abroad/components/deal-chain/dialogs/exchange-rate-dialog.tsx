import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Lock, ArrowRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChainExchangeRateItem } from "../types";

interface ExchangeRateDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (item: Omit<ChainExchangeRateItem, "type" | "chainPosition">) => void;
  editItem?: ChainExchangeRateItem;
  currencies: any[];
  prefillFromCurrencyId?: string;
  prefillFromCurrencyCode?: string;
  inputAmount?: number;
  inputCurrencyCode?: string;
}

function formatAmount(amount: number, currencyCode?: string): string {
  const formatted = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  if (!currencyCode) return formatted;
  const symbols: Record<string, string> = {
    RUB: "₽",
    USD: "$",
    EUR: "€",
    KZT: "₸",
    AZN: "₼",
    GEL: "₾",
    TRY: "₺",
    CNY: "¥",
  };
  const sym = symbols[currencyCode] || currencyCode;
  return `${formatted} ${sym}`;
}

export function ExchangeRateDialog({
  open,
  onClose,
  onSave,
  editItem,
  currencies,
  prefillFromCurrencyId,
  prefillFromCurrencyCode,
  inputAmount,
  inputCurrencyCode,
}: ExchangeRateDialogProps) {
  const lockedFromCurrencyCode = prefillFromCurrencyCode;
  const lockedFromCurrencyId = prefillFromCurrencyId;

  const [form, setForm] = useState({
    fromCurrencyId: lockedFromCurrencyId || editItem?.fromCurrencyId || "",
    toCurrencyId: editItem?.toCurrencyId || "",
    fromCurrencyCode: lockedFromCurrencyCode || editItem?.fromCurrencyCode || "",
    toCurrencyCode: editItem?.toCurrencyCode || "",
    rate: editItem?.rate as number | undefined,
    rateDate: editItem?.rateDate || "",
    notes: editItem?.notes || "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        fromCurrencyId: lockedFromCurrencyId || editItem?.fromCurrencyId || "",
        toCurrencyId: editItem?.toCurrencyId || "",
        fromCurrencyCode: lockedFromCurrencyCode || editItem?.fromCurrencyCode || "",
        toCurrencyCode: editItem?.toCurrencyCode || "",
        rate: editItem?.rate,
        rateDate: editItem?.rateDate || "",
        notes: editItem?.notes || "",
      });
    }
  }, [open]);

  const outputAmount =
    inputAmount != null && form.rate != null && form.rate > 0
      ? inputAmount * form.rate
      : null;

  const effectiveFromCode = lockedFromCurrencyCode || form.fromCurrencyCode;
  const effectiveInputCode = inputCurrencyCode || effectiveFromCode;

  const handleSave = () => {
    const toCurr = currencies.find((c) => c.id === form.toCurrencyId);
    onSave({
      id: editItem?.id,
      exchangeRateId: undefined,
      fromCurrencyId: lockedFromCurrencyId || form.fromCurrencyId || undefined,
      toCurrencyId: form.toCurrencyId || undefined,
      fromCurrencyCode: lockedFromCurrencyCode || form.fromCurrencyCode || undefined,
      toCurrencyCode: form.toCurrencyCode || toCurr?.code || undefined,
      rate: form.rate,
      rateDate: form.rateDate || undefined,
      notes: form.notes || undefined,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editItem ? "Редактировать курс" : "Добавить курс"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {lockedFromCurrencyCode && (
            <div className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-md border border-dashed">
              <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">
                Валюта (откуда) зафиксирована:
              </span>
              <Badge variant="secondary" className="font-mono">
                {lockedFromCurrencyCode}
              </Badge>
            </div>
          )}

          {inputAmount != null && inputAmount > 0 && (
            <div className="p-3 bg-muted/20 rounded-md border">
              <div className="text-[11px] text-muted-foreground uppercase font-medium tracking-wide mb-2">
                Расчёт конвертации
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-sm font-semibold">
                  {formatAmount(inputAmount, effectiveInputCode)}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                {outputAmount != null ? (
                  <div className="text-sm font-semibold text-green-600">
                    {formatAmount(outputAmount, form.toCurrencyCode || undefined)}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">
                    выберите валюту и курс
                  </div>
                )}
              </div>
              {form.rate && form.toCurrencyCode && (
                <div className="text-[11px] text-muted-foreground mt-1">
                  Курс: 1 {effectiveFromCode} = {form.rate} {form.toCurrencyCode}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium mb-1 flex items-center gap-1.5">
                Валюта (откуда)
                {lockedFromCurrencyCode && (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                )}
              </Label>
              {lockedFromCurrencyCode ? (
                <div className="flex h-9 items-center px-3 rounded-md border bg-muted/50 text-sm font-medium">
                  {lockedFromCurrencyCode}
                </div>
              ) : (
                <Select
                  value={form.fromCurrencyId || "none"}
                  onValueChange={(v) => {
                    const curr = currencies.find(
                      (c) => c.id === (v === "none" ? "" : v),
                    );
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
              )}
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">
                Валюта (куда)
              </Label>
              <Select
                value={form.toCurrencyId || "none"}
                onValueChange={(v) => {
                  const curr = currencies.find(
                    (c) => c.id === (v === "none" ? "" : v),
                  );
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
              <Label className="text-sm font-medium mb-1 block">
                Курс{" "}
                {effectiveFromCode && form.toCurrencyCode
                  ? `(${effectiveFromCode} → ${form.toCurrencyCode})`
                  : ""}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.000001"
                placeholder="Например: 5.12"
                value={form.rate ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    rate: e.target.value === "" ? undefined : parseFloat(e.target.value),
                  }))
                }
                data-testid="input-chain-exchange-rate"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">Дата</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.rateDate
                      ? format(new Date(form.rateDate + "T00:00:00"), "dd.MM.yyyy")
                      : "Выберите дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={
                      form.rateDate
                        ? new Date(form.rateDate + "T00:00:00")
                        : undefined
                    }
                    onSelect={(date) =>
                      setForm((f) => ({
                        ...f,
                        rateDate: date ? format(date, "yyyy-MM-dd") : "",
                      }))
                    }
                    locale={ru}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
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
          <Button type="button" onClick={handleSave}>
            {editItem ? "Сохранить" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
