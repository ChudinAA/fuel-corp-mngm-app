import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, differenceInDays } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { tonsToKg } from "../utils/planning-utils";
import { cn } from "@/lib/utils";

interface FiveDayPeriod {
  start: string;
  end: string;
}

interface PlanningResourceWithSupplier {
  id: string;
  supplierId: string;
  supplierName: string;
  basisId?: string | null;
  basisName?: string | null;
}

interface QuickEntry {
  id: string;
  date: string; // "" = no specific date (uses period.start on save)
  volume: string;
  counterpartyId: string;
  notes: string;
}

function makeid() {
  return Math.random().toString(36).slice(2, 9);
}

function periodDays(period: FiveDayPeriod): string[] {
  const days: string[] = [];
  const start = new Date(period.start + "T00:00:00");
  const end = new Date(period.end + "T00:00:00");
  const count = differenceInDays(end, start) + 1;
  for (let i = 0; i < count; i++) {
    days.push(format(addDays(start, i), "yyyy-MM-dd"));
  }
  return days;
}

function fmtPeriodLabel(p: FiveDayPeriod): string {
  const s = new Date(p.start + "T00:00:00");
  const e = new Date(p.end + "T00:00:00");
  const sDay = format(s, "dd");
  const eDay = format(e, "dd");
  const sMonth = format(s, "MMM", { locale: ru });
  const eMonth = format(e, "MMM", { locale: ru });
  if (sMonth === eMonth) {
    return `${sDay}–${eDay} ${sMonth}`;
  }
  return `${sDay} ${sMonth} – ${eDay} ${eMonth}`;
}

export function QuickPlanDialog({
  open,
  onOpenChange,
  period,
  defaultType,
  warehouseId,
  onSubmitEntry,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  period: FiveDayPeriod;
  defaultType: "income" | "expense";
  warehouseId: string;
  onSubmitEntry: (values: any) => Promise<void>;
}) {
  const { toast } = useToast();
  const [type, setType] = useState<"income" | "expense">(defaultType);
  const [entries, setEntries] = useState<QuickEntry[]>([
    { id: makeid(), date: "", volume: "", counterpartyId: "", notes: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const days = periodDays(period);

  useEffect(() => {
    if (open) {
      setType(defaultType);
      setEntries([{ id: makeid(), date: "", volume: "", counterpartyId: "", notes: "" }]);
    }
  }, [open, defaultType]);

  // Fetch counterparty options
  const { data: planningResources = [] } = useQuery<PlanningResourceWithSupplier[]>({
    queryKey: ["/api/planning/resources"],
    queryFn: async () => (await apiRequest("GET", "/api/planning/resources")).json(),
    enabled: open && type === "income",
  });

  const { data: customers = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => (await apiRequest("GET", "/api/customers")).json(),
    enabled: open && type === "expense",
  });

  const incomeOptions = planningResources.map((r) => ({
    value: r.supplierId,
    label: r.basisName ? `${r.supplierName} / ${r.basisName}` : r.supplierName,
  }));
  const expenseOptions = customers.map((c) => ({ value: c.id, label: c.name }));
  const counterpartyOptions =
    type === "income"
      ? [{ value: "", label: "— Не указан —" }, ...incomeOptions]
      : [{ value: "", label: "— Не указан —" }, ...expenseOptions];

  // ─── Row helpers ───
  const updateEntry = (id: string, field: keyof QuickEntry, value: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const addRow = () =>
    setEntries((prev) => [
      ...prev,
      { id: makeid(), date: "", volume: "", counterpartyId: "", notes: "" },
    ]);

  const removeRow = (id: string) =>
    setEntries((prev) => prev.filter((e) => e.id !== id));

  // ─── Submit ───
  const handleSubmit = async () => {
    const valid = entries.filter((e) => e.volume.trim() !== "");
    if (valid.length === 0) {
      toast({ title: "Введите объём хотя бы для одной строки", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      for (const e of valid) {
        await onSubmitEntry({
          date: e.date || period.start,
          type,
          counterpartyId: e.counterpartyId || undefined,
          basisId: undefined,
          volume: tonsToKg(e.volume),
          notes: e.notes || undefined,
          isManualBalance: false,
          balanceAfter: null,
        });
      }
      toast({
        title:
          valid.length === 1
            ? "Запись добавлена"
            : `Добавлено записей: ${valid.length}`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Ошибка",
        description: err?.message || "Не удалось сохранить",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const isIncome = type === "income";
  const validCount = entries.filter((e) => e.volume.trim() !== "").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-quick-plan">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>Быстрое добавление</span>
            <Badge variant="outline" className="font-normal text-sm text-blue-600 border-blue-200">
              {fmtPeriodLabel(period)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Type toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={isIncome ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setType("income");
              setEntries((prev) => prev.map((e) => ({ ...e, counterpartyId: "" })));
            }}
            data-testid="button-type-income"
          >
            Приход (поступление)
          </Button>
          <Button
            type="button"
            variant={!isIncome ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setType("expense");
              setEntries((prev) => prev.map((e) => ({ ...e, counterpartyId: "" })));
            }}
            data-testid="button-type-expense"
          >
            Расход (отгрузка)
          </Button>
        </div>

        {/* Entries list */}
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {entries.map((entry, idx) => (
            <div
              key={entry.id}
              className="rounded-md border bg-muted/30 p-3 space-y-2"
              data-testid={`quick-entry-row-${idx}`}
            >
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                {/* Date */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">День пятидневки</Label>
                  <Select
                    value={entry.date}
                    onValueChange={(v) => updateEntry(entry.id, "date", v)}
                  >
                    <SelectTrigger
                      className="h-9 text-sm"
                      data-testid={`select-date-${idx}`}
                    >
                      <SelectValue placeholder="Без конкретной даты" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Без конкретной даты</SelectItem>
                      {days.map((d) => (
                        <SelectItem key={d} value={d}>
                          {format(new Date(d + "T00:00:00"), "dd MMMM (EEEE)", {
                            locale: ru,
                          })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Volume */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Объём (т) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="0.000"
                    value={entry.volume}
                    onChange={(e) => updateEntry(entry.id, "volume", e.target.value)}
                    className={cn(
                      "h-9 text-sm",
                      !entry.volume && "border-muted-foreground/30",
                    )}
                    data-testid={`input-volume-${idx}`}
                  />
                </div>

                {/* Delete button */}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeRow(entry.id)}
                  disabled={entries.length === 1}
                  className="text-muted-foreground hover:text-destructive"
                  data-testid={`button-remove-row-${idx}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Counterparty (optional) */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {isIncome ? "Поставщик" : "Клиент"}{" "}
                  <span className="text-muted-foreground/60">(необязательно)</span>
                </Label>
                <Combobox
                  options={counterpartyOptions}
                  value={entry.counterpartyId}
                  onValueChange={(v) =>
                    updateEntry(entry.id, "counterpartyId", v === "" ? "" : v)
                  }
                  placeholder={
                    isIncome
                      ? "Выберите поставщика (опционально)"
                      : "Выберите клиента (опционально)"
                  }
                  dataTestId={`combobox-counterparty-${idx}`}
                />
              </div>

              {/* Notes (optional) */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Примечание{" "}
                  <span className="text-muted-foreground/60">(необязательно)</span>
                </Label>
                <Textarea
                  value={entry.notes}
                  onChange={(e) => updateEntry(entry.id, "notes", e.target.value)}
                  placeholder="Доп. информация..."
                  rows={1}
                  className="text-sm resize-none"
                  data-testid={`textarea-notes-${idx}`}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Add row */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          className="w-full border-dashed"
          data-testid="button-add-quick-row"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Добавить строку
        </Button>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving || validCount === 0}
            data-testid="button-save-quick-plan"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Сохранение...
              </>
            ) : validCount > 1 ? (
              `Сохранить (${validCount} записи)`
            ) : (
              "Сохранить"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
