import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMinimizableDialog } from "@/hooks/use-minimizable-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogDescription, DialogHeader, DialogTitle, MinimizableDialog,
  MinimizableDialogContent,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type Unit = { id: string; shortName: string; fullName: string; conversionFactor: string | null; referenceUnitId: string | null };
type FormState = { shortName: string; fullName: string; conversionFactor: string; referenceUnitId: string };
interface Props { open: boolean; editItem: Unit | null; units: Unit[]; onOpenChange: (open: boolean) => void }
const blankForm = (): FormState => ({ shortName: "", fullName: "", conversionFactor: "", referenceUnitId: "" });
async function errorMessage(response: Response) {
  try { return (await response.json()).message || "Не удалось сохранить единицу измерения"; } catch { return "Не удалось сохранить единицу измерения"; }
}

export function UnitCatalogDialog({ open, editItem, units, onOpenChange }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(blankForm);
  const referenceOptions = useMemo(() => units.filter((unit) => unit.id !== editItem?.id), [units, editItem?.id]);
  useEffect(() => {
    if (!open) return;
    setForm(editItem ? {
      shortName: editItem.shortName, fullName: editItem.fullName,
      conversionFactor: editItem.conversionFactor || "", referenceUnitId: editItem.referenceUnitId || "",
    } : blankForm());
  }, [open, editItem?.id]);
  const factorText = form.conversionFactor.trim();
  const conversionNumber = factorText === "" ? null : Number(factorText);
  const invalidFactor = conversionNumber !== null && (!/^\d+(?:\.\d+)?$/.test(factorText) || !Number.isFinite(conversionNumber) || conversionNumber <= 0);
  const reference = referenceOptions.find((unit) => unit.id === form.referenceUnitId);
  const equation = conversionNumber && conversionNumber > 0 && reference ? `1 ${form.shortName || "ед."} = ${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 6 }).format(conversionNumber)} ${reference.shortName}` : "";

  const save = useMutation({
    mutationFn: async () => {
      if (invalidFactor) throw new Error("Коэффициент должен быть положительным числом");
      if (!!form.conversionFactor.trim() !== !!form.referenceUnitId) throw new Error("Для пересчёта укажите коэффициент и единицу одновременно");
      const payload = {
        shortName: form.shortName.trim(),
        fullName: form.fullName.trim(),
        conversionFactor: form.conversionFactor.trim() || null,
        referenceUnitId: form.referenceUnitId || null,
      };
      const response = editItem ? await apiRequest("PATCH", `/api/units-of-measure/${editItem.id}`, payload) : await apiRequest("POST", "/api/units-of-measure", payload);
      if (!response.ok) throw new Error(await errorMessage(response));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/units-of-measure"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nomenclature"] });
      toast({ title: editItem ? "Единица обновлена" : "Единица добавлена" });
      setForm(blankForm());
      onOpenChange(false);
    },
    onError: (error: Error) => toast({ title: "Ошибка", description: error.message, variant: "destructive" }),
  });
  const title = editItem ? "Изменить единицу" : "Новая единица";
  const handleOpenChange = (next: boolean) => { if (!next) setForm(blankForm()); onOpenChange(next); };
  const { isMinimized, MinimizeButton, MinimizedBar } = useMinimizableDialog({ title, onClose: () => handleOpenChange(false) });

  return (
    <>
      <MinimizableDialog open={open} isMinimized={isMinimized} onOpenChange={handleOpenChange}>
        <MinimizableDialogContent isMinimized={isMinimized} className="max-w-md">
          <DialogHeader><div className="flex items-start justify-between gap-2 pr-7"><div><DialogTitle>{title}</DialogTitle><DialogDescription className="mt-1">Укажите единицу и при необходимости пересчёт в другую единицу.</DialogDescription></div><div className="-mt-1 shrink-0">{MinimizeButton}</div></div></DialogHeader>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="unit-short-name">Краткое название</Label><Input id="unit-short-name" autoFocus value={form.shortName} onChange={(event) => setForm({ ...form, shortName: event.target.value })} required maxLength={40} placeholder="т" /></div>
              <div className="space-y-1.5"><Label htmlFor="unit-full-name">Полное название</Label><Input id="unit-full-name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required maxLength={100} placeholder="тонна" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="unit-factor">Коэффициент</Label><Input id="unit-factor" type="text" inputMode="decimal" value={form.conversionFactor} onChange={(event) => setForm({ ...form, conversionFactor: event.target.value })} placeholder="Необязательно" aria-invalid={invalidFactor} /><p className="text-xs text-muted-foreground">Положительное число через точку, например 1000.</p></div>
              <div className="space-y-1.5"><Label htmlFor="unit-reference">В пересчёте к</Label><select id="unit-reference" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.referenceUnitId} onChange={(event) => setForm({ ...form, referenceUnitId: event.target.value })}><option value="">Не задано</option>{referenceOptions.map((unit) => <option key={unit.id} value={unit.id}>{unit.shortName} — {unit.fullName}</option>)}</select><p className="text-xs text-muted-foreground">Можно оставить без пересчёта.</p></div>
            </div>
            {equation && <div className="rounded-md bg-muted/60 px-3 py-2 text-sm font-medium tabular-nums">{equation}</div>}
            {invalidFactor && <p className="text-sm text-destructive">Укажите положительное число.</p>}
            <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Отмена</Button><Button type="submit" disabled={save.isPending || invalidFactor}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{save.isPending ? "Сохранение…" : editItem ? "Сохранить" : "Создать"}</Button></div>
          </form>
        </MinimizableDialogContent>
      </MinimizableDialog>
      {MinimizedBar}
    </>
  );
}
