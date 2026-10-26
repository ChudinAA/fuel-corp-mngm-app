import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMinimizableDialog } from "@/hooks/use-minimizable-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DialogDescription, DialogHeader, DialogTitle, MinimizableDialog,
  MinimizableDialogContent,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type ProductType = "kerosene" | "pvkj" | "service";
type Unit = { id: string; shortName: string; fullName: string };
type Item = { id: string; productType: ProductType | null; typeCode?: ProductType | null; name: string; unitId: string; isDefault: boolean };
type FormState = { productType: ProductType | ""; name: string; unitId: string; isDefault: boolean };
interface Props { open: boolean; editItem: Item | null; units: Unit[]; onOpenChange: (open: boolean) => void }
const blankForm = (): FormState => ({ productType: "", name: "", unitId: "", isDefault: false });
async function errorMessage(response: Response) {
  try { return (await response.json()).message || "Не удалось сохранить позицию"; } catch { return "Не удалось сохранить позицию"; }
}

export function NomenclatureItemDialog({ open, editItem, units, onOpenChange }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(blankForm);
  useEffect(() => {
    if (!open) return;
    setForm(editItem ? { productType: editItem.productType ?? editItem.typeCode ?? "", name: editItem.name, unitId: editItem.unitId, isDefault: editItem.isDefault } : { ...blankForm(), unitId: units[0]?.id || "" });
  }, [open, editItem?.id]);
  const save = useMutation({
    mutationFn: async () => {
      if (!form.productType) throw new Error("Выберите тип продукта");
      const payload = { productType: form.productType, name: form.name.trim(), unitId: form.unitId, isDefault: form.isDefault };
      const response = editItem ? await apiRequest("PATCH", `/api/nomenclature/${editItem.id}`, payload) : await apiRequest("POST", "/api/nomenclature", payload);
      if (!response.ok) throw new Error(await errorMessage(response));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nomenclature"] });
      toast({ title: editItem ? "Позиция обновлена" : "Позиция добавлена" });
      setForm(blankForm());
      onOpenChange(false);
    },
    onError: (error: Error) => toast({ title: "Ошибка", description: error.message, variant: "destructive" }),
  });
  const title = editItem ? "Изменить позицию" : "Новая позиция";
  const handleOpenChange = (next: boolean) => { if (!next) setForm(blankForm()); onOpenChange(next); };
  const { isMinimized, MinimizeButton, MinimizedBar } = useMinimizableDialog({ title, onClose: () => handleOpenChange(false) });
  return (
    <>
      <MinimizableDialog open={open} isMinimized={isMinimized} onOpenChange={handleOpenChange}>
        <MinimizableDialogContent isMinimized={isMinimized} className="max-w-md">
          <DialogHeader><div className="flex items-start justify-between gap-2 pr-7"><div><DialogTitle>{title}</DialogTitle><DialogDescription className="mt-1">Тип продукта, название и единица учёта.</DialogDescription></div><div className="-mt-1 shrink-0">{MinimizeButton}</div></div></DialogHeader>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
            <div className="space-y-1.5"><Label htmlFor="catalog-product-type">Тип продукта</Label><select id="catalog-product-type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.productType} onChange={(event) => setForm({ ...form, productType: event.target.value as ProductType | "" })} required><option value="">Выберите тип продукта</option><option value="kerosene">Керосин</option><option value="pvkj">ПВКЖ</option><option value="service">Услуга</option></select></div>
            <div className="space-y-1.5"><Label htmlFor="catalog-item-name">Наименование</Label><Input id="catalog-item-name" autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={250} /></div>
            <div className="space-y-1.5"><Label htmlFor="catalog-item-unit">Единица измерения</Label><select id="catalog-item-unit" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.unitId} onChange={(event) => setForm({ ...form, unitId: event.target.value })} required disabled={!units.length}><option value="">{units.length ? "Выберите единицу" : "Нет доступных единиц"}</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.shortName} — {unit.fullName}</option>)}</select>{!units.length && <p className="text-xs text-muted-foreground">Сначала добавьте единицу измерения, затем вернитесь к позиции.</p>}</div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2"><div><Label htmlFor="catalog-item-default">По умолчанию</Label><p className="text-xs text-muted-foreground">Использовать как стандарт для этого типа</p></div><Switch id="catalog-item-default" checked={form.isDefault} onCheckedChange={(checked) => setForm({ ...form, isDefault: checked })} /></div>
            <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Отмена</Button><Button type="submit" disabled={save.isPending || !units.length}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{save.isPending ? "Сохранение…" : editItem ? "Сохранить" : "Создать"}</Button></div>
          </form>
        </MinimizableDialogContent>
      </MinimizableDialog>
      {MinimizedBar}
    </>
  );
}
