import { useState } from "react";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AllocatedVolumeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  supplierName: string;
}

function getMonthOptions() {
  const months = [];
  const now = new Date();
  for (let i = -1; i <= 11; i++) {
    const d = addMonths(now, i);
    const from = startOfMonth(d);
    const to = endOfMonth(d);
    months.push({
      label: format(d, "LLLL yyyy", { locale: ru }),
      from: format(from, "yyyy-MM-dd"),
      to: format(to, "yyyy-MM-dd"),
    });
  }
  return months;
}

export function AllocatedVolumeDialog({
  open,
  onOpenChange,
  supplierId,
  supplierName,
}: AllocatedVolumeDialogProps) {
  const { toast } = useToast();
  const months = getMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(months[1].from);
  const [volume, setVolume] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedMonthData = months.find((m) => m.from === selectedMonth) || months[1];

  const handleSave = async () => {
    if (!volume) return;
    setSaving(true);
    try {
      await apiRequest("POST", "/api/planning/allocated-volumes", {
        supplierId,
        periodFrom: selectedMonthData.from,
        periodTo: selectedMonthData.to,
        volume: (parseFloat(volume) * 1000).toFixed(2), // tons -> kg
      });
      queryClient.invalidateQueries({ queryKey: ["/api/planning/summary/resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/planning/resources"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/planning/allocated-volumes/by-supplier", supplierId],
      });
      toast({ title: "Выделенный объём сохранён" });
      onOpenChange(false);
      setVolume("");
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-allocated-volume">
        <DialogHeader>
          <DialogTitle>Выделенный объём — {supplierName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Месяц</Label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              data-testid="select-allocated-month"
            >
              {months.map((m) => (
                <option key={m.from} value={m.from}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Объём (тонн)</Label>
            <Input
              type="number"
              step="0.001"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="0.000"
              data-testid="input-allocated-volume"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !volume}
            data-testid="button-save-allocated-volume"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
