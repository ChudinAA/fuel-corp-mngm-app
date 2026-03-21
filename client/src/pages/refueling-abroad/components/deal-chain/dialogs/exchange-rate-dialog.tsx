import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
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
import type { ExchangeRate } from "@shared/schema";
import type { ChainExchangeRateItem } from "../types";

interface ExchangeRateDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (item: Omit<ChainExchangeRateItem, "type" | "chainPosition">) => void;
  editItem?: ChainExchangeRateItem;
  currencies: any[];
  prefillFromCurrencyId?: string;
  prefillFromCurrencyCode?: string;
}

export function ExchangeRateDialog({
  open,
  onClose,
  onSave,
  editItem,
  currencies,
  prefillFromCurrencyId,
  prefillFromCurrencyCode,
}: ExchangeRateDialogProps) {
  const { data: exchangeRates = [] } = useQuery<ExchangeRate[]>({
    queryKey: ["/api/exchange-rates"],
  });

  const [useExisting, setUseExisting] = useState(!!editItem?.exchangeRateId);
  const [form, setForm] = useState({
    exchangeRateId: editItem?.exchangeRateId || "",
    fromCurrencyId: editItem?.fromCurrencyId || prefillFromCurrencyId || "",
    toCurrencyId: editItem?.toCurrencyId || "",
    fromCurrencyCode: editItem?.fromCurrencyCode || prefillFromCurrencyCode || "",
    toCurrencyCode: editItem?.toCurrencyCode || "",
    rate: editItem?.rate || (undefined as number | undefined),
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
                  <Label className="text-sm font-medium mb-1 block">Курс</Label>
                  <Input
                    type="number"
                    min="0"
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.rateDate
                          ? format(
                              new Date(form.rateDate + "T00:00:00"),
                              "yyyy-MM-dd",
                            )
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
