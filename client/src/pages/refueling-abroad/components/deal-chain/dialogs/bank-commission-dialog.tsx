import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { ChainBankCommissionItem } from "../types";

interface BankCommissionDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (item: Omit<ChainBankCommissionItem, "type" | "chainPosition">) => void;
  editItem?: ChainBankCommissionItem;
}

export function BankCommissionDialog({
  open,
  onClose,
  onSave,
  editItem,
}: BankCommissionDialogProps) {
  const [form, setForm] = useState({
    commissionType: (editItem?.commissionType || "percent") as
      | "percent"
      | "percent_min",
    percent: editItem?.percent || (undefined as number | undefined),
    minValue: editItem?.minValue || (undefined as number | undefined),
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
            <Label className="text-sm font-medium mb-2 block">
              Название банка
            </Label>
            <Input
              placeholder="Название банка (необязательно)"
              value={form.bankName}
              onChange={(e) =>
                setForm((f) => ({ ...f, bankName: e.target.value }))
              }
              data-testid="input-bank-name"
            />
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">
              Тип комиссии
            </Label>
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
                <Label
                  htmlFor="type-percent-min"
                  className="cursor-pointer font-normal"
                >
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
                min="0"
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
          <Button
            type="button"
            onClick={handleSave}
            data-testid="button-save-bank-commission"
          >
            {editItem ? "Сохранить" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
