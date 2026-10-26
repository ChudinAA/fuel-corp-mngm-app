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

type Contract = {
  id: string; contractName: string; contractNumber: string; contractDate: string;
  supplierId: string | null; buyerId: string | null; carrierId: string | null;
  parentContractId: string | null; counterpartyName: string;
  counterpartyType: "supplier" | "buyer" | "carrier";
};
type Party = { id: string; name: string };
type ContractForm = {
  contractName: string; contractNumber: string; contractDate: string;
  partyType: "supplier" | "buyer" | "carrier"; partyId: string; parentContractId: string;
};

interface ContractCatalogDialogProps {
  open: boolean;
  editItem: Contract | null;
  contracts: Contract[];
  suppliers: Party[];
  buyers: Party[];
  carriers: Party[];
  onOpenChange: (open: boolean) => void;
}

const blankForm = (): ContractForm => ({
  contractName: "", contractNumber: "", contractDate: new Date().toISOString().slice(0, 10),
  partyType: "supplier", partyId: "", parentContractId: "",
});
const parseError = async (response: Response, fallback: string) => {
  try { const body = await response.json(); return body.message || fallback; } catch { return fallback; }
};

export function ContractCatalogDialog({ open, editItem, contracts, suppliers, buyers, carriers, onOpenChange }: ContractCatalogDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<ContractForm>(blankForm);
  const parties = form.partyType === "supplier" ? suppliers : form.partyType === "buyer" ? buyers : carriers;
  const parentOptions = useMemo(() => contracts.filter((item) => {
    const partyId = form.partyType === "supplier" ? item.supplierId : form.partyType === "buyer" ? item.buyerId : item.carrierId;
    return !item.parentContractId && item.id !== editItem?.id && !!form.partyId && partyId === form.partyId;
  }), [contracts, editItem?.id, form.partyType, form.partyId]);

  useEffect(() => {
    if (!open) return;
    setForm(editItem ? {
      contractName: editItem.contractName,
      contractNumber: editItem.contractNumber,
      contractDate: editItem.contractDate?.slice(0, 10) || "",
      partyType: editItem.counterpartyType,
      partyId: editItem.supplierId || editItem.buyerId || editItem.carrierId || "",
      parentContractId: editItem.parentContractId || "",
    } : blankForm());
  }, [open, editItem?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.partyId) throw new Error("Выберите контрагента");
      const payload = {
        contractName: form.contractName.trim(),
        contractNumber: form.contractNumber.trim(),
        contractDate: form.contractDate,
        supplierId: form.partyType === "supplier" ? form.partyId : null,
        buyerId: form.partyType === "buyer" ? form.partyId : null,
        carrierId: form.partyType === "carrier" ? form.partyId : null,
        parentContractId: form.parentContractId || null,
      };
      const response = editItem
        ? await apiRequest("PATCH", `/api/contracts/${editItem.id}`, payload)
        : await apiRequest("POST", "/api/contracts", payload);
      if (!response.ok) throw new Error(await parseError(response, "Не удалось сохранить договор"));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: editItem ? "Договор обновлён" : "Договор добавлен" });
      setForm(blankForm());
      onOpenChange(false);
    },
    onError: (error: Error) => toast({ title: "Ошибка", description: error.message, variant: "destructive" }),
  });

  const title = editItem ? "Изменить договор" : "Новый договор";
  const handleOpenChange = (next: boolean) => {
    if (!next) setForm(blankForm());
    onOpenChange(next);
  };
  const { isMinimized, MinimizeButton, MinimizedBar } = useMinimizableDialog({ title, onClose: () => handleOpenChange(false) });

  return (
    <>
      <MinimizableDialog open={open} isMinimized={isMinimized} onOpenChange={handleOpenChange}>
        <MinimizableDialogContent isMinimized={isMinimized} className="max-w-lg">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2 pr-7">
              <div><DialogTitle>{title}</DialogTitle><DialogDescription className="mt-1">Заполните реквизиты и сторону договора.</DialogDescription></div>
              <div className="-mt-1 shrink-0">{MinimizeButton}</div>
            </div>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
            <div className="space-y-1.5"><Label htmlFor="contract-name">Наименование</Label><Input id="contract-name" autoFocus value={form.contractName} onChange={(event) => setForm({ ...form, contractName: event.target.value })} required maxLength={250} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="contract-number">Номер</Label><Input id="contract-number" value={form.contractNumber} onChange={(event) => setForm({ ...form, contractNumber: event.target.value })} required maxLength={100} /></div>
              <div className="space-y-1.5"><Label htmlFor="contract-date">Дата</Label><Input id="contract-date" type="date" value={form.contractDate} onChange={(event) => setForm({ ...form, contractDate: event.target.value })} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="contract-party-type">Сторона договора</Label><select id="contract-party-type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.partyType} onChange={(event) => setForm({ ...form, partyType: event.target.value as ContractForm["partyType"], partyId: "", parentContractId: "" })}><option value="supplier">Поставщик</option><option value="buyer">Покупатель</option><option value="carrier">Перевозчик</option></select></div>
              <div className="space-y-1.5"><Label htmlFor="contract-party">Контрагент</Label><select id="contract-party" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.partyId} onChange={(event) => setForm({ ...form, partyId: event.target.value, parentContractId: "" })} required><option value="">Выберите</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="contract-parent">Связь с договором</Label><select id="contract-parent" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.parentContractId} onChange={(event) => setForm({ ...form, parentContractId: event.target.value })}><option value="">Основной договор</option>{parentOptions.map((item) => <option key={item.id} value={item.id}>№ {item.contractNumber} · {item.contractName}</option>)}</select><p className="text-xs text-muted-foreground">Выберите основной договор, если создаёте приложение.</p></div>
            <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Отмена</Button><Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{save.isPending ? "Сохранение…" : editItem ? "Сохранить" : "Создать"}</Button></div>
          </form>
        </MinimizableDialogContent>
      </MinimizableDialog>
      {MinimizedBar}
    </>
  );
}
