import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMinimizableDialog } from "@/hooks/use-minimizable-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogDescription, DialogHeader, DialogTitle, MinimizableDialog, MinimizableDialogContent } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

export type NomenclatureType = { id: string; name: string; code: string };
interface Props {
  open: boolean;
  editItem: NomenclatureType | null;
  onOpenChange: (open: boolean) => void;
}

export function NomenclatureKindDialog({ open, editItem, onOpenChange }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  useEffect(() => {
    if (open) setName(editItem?.name || "");
  }, [open, editItem?.id]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), code: editItem?.code || crypto.randomUUID() };
      const response = editItem
        ? await apiRequest("PATCH", `/api/nomenclature-types/${editItem.id}`, payload)
        : await apiRequest("POST", "/api/nomenclature-types", payload);
      if (!response.ok) {
        let message = "Не удалось сохранить вид номенклатуры";
        try { message = (await response.json()).message || message; } catch { /* fallback */ }
        throw new Error(message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nomenclature-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nomenclature"] });
      toast({ title: editItem ? "Вид номенклатуры обновлён" : "Вид номенклатуры добавлен" });
      setName("");
      onOpenChange(false);
    },
    onError: (error: Error) => toast({ title: "Ошибка", description: error.message, variant: "destructive" }),
  });

  const title = editItem ? "Изменить вид номенклатуры" : "Новый вид номенклатуры";
  const close = (next: boolean) => {
    if (!next) setName("");
    onOpenChange(next);
  };
  const { isMinimized, MinimizeButton, MinimizedBar } = useMinimizableDialog({ title, onClose: () => close(false) });

  return (
    <>
      <MinimizableDialog open={open} isMinimized={isMinimized} onOpenChange={close}>
        <MinimizableDialogContent isMinimized={isMinimized} className="max-w-md">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2 pr-7">
              <div><DialogTitle>{title}</DialogTitle><DialogDescription className="mt-1">Классификация для интеграции и учётных документов.</DialogDescription></div>
              <div className="-mt-1 shrink-0">{MinimizeButton}</div>
            </div>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
            <div className="space-y-1.5">
              <Label htmlFor="nomenclature-kind-name">Название</Label>
              <Input id="nomenclature-kind-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} required maxLength={150} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => close(false)}>Отмена</Button>
              <Button type="submit" disabled={save.isPending || !name.trim()}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{save.isPending ? "Сохранение…" : editItem ? "Сохранить" : "Создать"}</Button>
            </div>
          </form>
        </MinimizableDialogContent>
      </MinimizableDialog>
      {MinimizedBar}
    </>
  );
}
