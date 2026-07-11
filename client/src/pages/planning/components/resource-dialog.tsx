import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { apiRequest } from "@/lib/queryClient";

interface ResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { supplierId: string; basisId?: string; notes?: string }) => Promise<void>;
  existing?: { supplierId: string; basisId?: string | null; notes?: string | null } | null;
}

export function ResourceDialog({
  open,
  onOpenChange,
  onSubmit,
  existing,
}: ResourceDialogProps) {
  const [supplierId, setSupplierId] = useState("");
  const [basisId, setBasisId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: suppliers = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/suppliers"],
    queryFn: async () => (await apiRequest("GET", "/api/suppliers")).json(),
  });

  const { data: supplierBases = [] } = useQuery<{ id: string; name: string; code?: string }[]>({
    queryKey: ["/api/planning/supplier-bases", supplierId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/planning/supplier-bases/${supplierId}`)).json(),
    enabled: !!supplierId,
  });

  useEffect(() => {
    if (open) {
      setSupplierId(existing?.supplierId || "");
      setBasisId(existing?.basisId || "");
      setNotes(existing?.notes || "");
    }
  }, [open, existing]);

  // Reset basisId when supplier changes (unless editing existing)
  useEffect(() => {
    if (!existing?.supplierId || supplierId !== existing.supplierId) {
      setBasisId("");
    }
  }, [supplierId]);

  const handleSubmit = async () => {
    if (!supplierId) return;
    setSaving(true);
    try {
      await onSubmit({
        supplierId,
        basisId: basisId || undefined,
        notes: notes || undefined,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }));
  const basisOptions = supplierBases.map((b) => ({
    value: b.id,
    label: b.code ? `${b.name} (${b.code})` : b.name,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-resource">
        <DialogHeader>
          <DialogTitle>{existing ? "Редактировать ресурс" : "Добавить ресурс"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Поставщик</Label>
            <Combobox
              options={supplierOptions}
              value={supplierId}
              onValueChange={setSupplierId}
              placeholder="Выберите поставщика"
              dataTestId="select-resource-supplier"
            />
          </div>
          {supplierId && (
            <div className="space-y-1.5">
              <Label>Базис (необязательно)</Label>
              <Combobox
                options={[{ value: "", label: "— Все базисы —" }, ...basisOptions]}
                value={basisId}
                onValueChange={setBasisId}
                placeholder={
                  basisOptions.length === 0
                    ? "Нет баз для этого поставщика"
                    : "Выберите базис"
                }
                dataTestId="select-resource-basis"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Примечание</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Необязательно"
              data-testid="input-resource-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !supplierId}
            data-testid="button-save-resource"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
