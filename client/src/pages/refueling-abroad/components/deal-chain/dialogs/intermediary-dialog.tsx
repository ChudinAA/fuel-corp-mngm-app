import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Supplier, Customer } from "@shared/schema";
import type { ChainIntermediaryItem, IntermediaryIncomeType } from "../types";
import { computeIntermediaryCommission } from "../types";
import { formatCurrency } from "../../../utils";

interface IntermediaryDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (item: Omit<ChainIntermediaryItem, "type" | "chainPosition">) => void;
  editItem?: ChainIntermediaryItem;
  saleAmountUsd: number;
  purchaseAmountUsd: number;
  quantityKg: number;
  exchangeRate: number;
}

const INCOME_TYPE_LABELS: Record<IntermediaryIncomeType, string> = {
  percent_sale: "% от суммы продажи",
  royalty_per_ton: "Роялти с тонны",
  fixed: "Фиксированная сумма",
};

export function IntermediaryDialog({
  open,
  onClose,
  onSave,
  editItem,
  saleAmountUsd,
  purchaseAmountUsd,
  quantityKg,
  exchangeRate,
}: IntermediaryDialogProps) {
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const intermediarySuppliers = suppliers.filter((s) => s.isIntermediary);
  const intermediaryCustomers = customers.filter((c) => c.isIntermediary);

  const [form, setForm] = useState({
    intermediaryId: editItem?.intermediaryId || "",
    intermediarySource: (editItem?.intermediarySource || "customer") as "supplier" | "customer",
    incomeType: (editItem?.incomeType || "percent_sale") as IntermediaryIncomeType,
    rateValue: editItem?.rateValue ?? (undefined as number | undefined),
    notes: editItem?.notes || "",
  });

  const computedCommissionUsd = computeIntermediaryCommission(
    form.incomeType,
    form.rateValue,
    saleAmountUsd,
    quantityKg,
  );
  const computedCommissionRub = computedCommissionUsd * exchangeRate;

  const handleSave = () => {
    onSave({
      id: editItem?.id,
      intermediaryId: form.intermediaryId,
      intermediarySource: form.intermediarySource,
      incomeType: form.incomeType,
      rateValue: form.rateValue,
      commissionUsd: computedCommissionUsd || null,
      commissionRub: computedCommissionRub || null,
      notes: form.notes,
    });
    onClose();
  };

  const ratePlaceholder =
    form.incomeType === "percent_sale"
      ? "Процент (%)"
      : form.incomeType === "royalty_per_ton"
        ? "Роялти (USD/т)"
        : "Сумма (USD)";

  const rateLabel =
    form.incomeType === "percent_sale"
      ? "Ставка (%)"
      : form.incomeType === "royalty_per_ton"
        ? "Роялти за тонну (USD)"
        : "Фиксированная сумма (USD)";

  const handleSelectIntermediary = (value: string, source: "supplier" | "customer") => {
    setForm((f) => ({
      ...f,
      intermediaryId: value === "none" ? "" : value,
      intermediarySource: source,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editItem ? "Редактировать посредника" : "Добавить посредника"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-1 block">Посредник</Label>
            <Select
              value={form.intermediaryId || "none"}
              onValueChange={(v) => {
                if (v === "none") {
                  handleSelectIntermediary("none", "customer");
                  return;
                }
                const isCustomer = intermediaryCustomers.some((c) => c.id === v);
                handleSelectIntermediary(v, isCustomer ? "customer" : "supplier");
              }}
            >
              <SelectTrigger data-testid="select-intermediary-dialog">
                <SelectValue placeholder="Выберите посредника" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не выбран</SelectItem>
                {intermediaryCustomers.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                      Покупатели-посредники
                    </div>
                    {intermediaryCustomers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </>
                )}
                {intermediarySuppliers.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                      Поставщики-посредники
                    </div>
                    {intermediarySuppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium mb-1 block">
              Доход посредника
            </Label>
            <Select
              value={form.incomeType}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  incomeType: v as IntermediaryIncomeType,
                  rateValue: undefined,
                }))
              }
            >
              <SelectTrigger data-testid="select-income-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(INCOME_TYPE_LABELS) as IntermediaryIncomeType[]).map(
                  (key) => (
                    <SelectItem key={key} value={key}>
                      {INCOME_TYPE_LABELS[key]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium mb-1 block">{rateLabel}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder={ratePlaceholder}
              value={form.rateValue ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  rateValue: e.target.value === "" ? undefined : parseFloat(e.target.value),
                }))
              }
              data-testid="input-intermediary-rate"
            />
          </div>

          {computedCommissionUsd > 0 && (
            <div className="p-3 bg-muted/30 rounded-md space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Комиссия (USD):</span>
                <span className="font-medium text-destructive">
                  {formatCurrency(computedCommissionUsd, "USD")}
                </span>
              </div>
              {exchangeRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Комиссия (RUB):</span>
                  <span className="font-medium text-destructive">
                    {formatCurrency(computedCommissionRub, "RUB")}
                  </span>
                </div>
              )}
            </div>
          )}

          <div>
            <Label className="text-sm font-medium mb-1 block">Заметки</Label>
            <Input
              placeholder="Заметки о посреднике"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
