import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AuditPanel } from "@/components/audit-panel";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { FileText, History, Pencil, Plus, Trash2, X } from "lucide-react";

type Contract = {
  id: string;
  id1c: string | null;
  contractName: string;
  contractNumber: string;
  contractDate: string;
  supplierId: string | null;
  buyerId: string | null;
  carrierId: string | null;
  parentContractId: string | null;
  counterpartyName: string;
  counterpartyType: "supplier" | "buyer" | "carrier";
};
type Party = { id: string; name: string };

const emptyForm = {
  id: "",
  id1c: "",
  contractName: "",
  contractNumber: "",
  contractDate: new Date().toISOString().slice(0, 10),
  partyType: "supplier" as Contract["counterpartyType"],
  partyId: "",
  parentContractId: "",
};

export function ContractsTab() {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [audit, setAudit] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<Contract | null>(null);
  const { data: contracts = [], isLoading } = useQuery<Contract[]>({ queryKey: ["/api/contracts"] });
  const { data: suppliers = [] } = useQuery<Party[]>({ queryKey: ["/api/suppliers"] });
  const { data: buyers = [] } = useQuery<Party[]>({ queryKey: ["/api/customers"] });
  const { data: carriers = [] } = useQuery<Party[]>({ queryKey: ["/api/logistics/carriers"] });
  const partyOptions = form.partyType === "supplier" ? suppliers : form.partyType === "buyer" ? buyers : carriers;
  const contractOptions = useMemo(() => contracts.filter((item) => !item.parentContractId && item.id !== form.id), [contracts, form.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.partyId) throw new Error("Выберите контрагента");
      const payload = {
        id1c: form.id1c || null,
        contractName: form.contractName,
        contractNumber: form.contractNumber,
        contractDate: form.contractDate,
        supplierId: form.partyType === "supplier" ? form.partyId : null,
        buyerId: form.partyType === "buyer" ? form.partyId : null,
        carrierId: form.partyType === "carrier" ? form.partyId : null,
        parentContractId: form.parentContractId || null,
      };
      const response = form.id
        ? await apiRequest("PATCH", `/api/contracts/${form.id}`, payload)
        : await apiRequest("POST", "/api/contracts", payload);
      if (!response.ok) throw new Error((await response.json()).message || "Не удалось сохранить договор");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: form.id ? "Договор обновлён" : "Договор добавлен" });
      setForm(emptyForm);
    },
    onError: (error: Error) => toast({ title: "Ошибка", description: error.message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/contracts/${id}`);
      if (!response.ok) throw new Error((await response.json()).message || "Не удалось удалить запись");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Договор удалён" });
      setDeleting(null);
    },
    onError: (error: Error) => toast({ title: "Ошибка", description: error.message, variant: "destructive" }),
  });

  const edit = (item: Contract) => setForm({
    id: item.id,
    id1c: item.id1c || "",
    contractName: item.contractName,
    contractNumber: item.contractNumber,
    contractDate: item.contractDate?.slice(0, 10) || "",
    partyType: item.counterpartyType,
    partyId: item.supplierId || item.buyerId || item.carrierId || "",
    parentContractId: item.parentContractId || "",
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Договоры контрагентов</CardTitle></CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-3 md:grid-cols-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
            <Input placeholder="Наименование договора" value={form.contractName} onChange={(e) => setForm({ ...form, contractName: e.target.value })} required />
            <Input placeholder="Номер договора" value={form.contractNumber} onChange={(e) => setForm({ ...form, contractNumber: e.target.value })} required />
            <Input aria-label="Дата заключения" type="date" value={form.contractDate} onChange={(e) => setForm({ ...form, contractDate: e.target.value })} required />
            <Input placeholder="id_1C (необязательно)" value={form.id1c} onChange={(e) => setForm({ ...form, id1c: e.target.value })} />
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.partyType} onChange={(e) => setForm({ ...form, partyType: e.target.value as Contract["counterpartyType"], partyId: "" })}>
              <option value="supplier">Поставщик</option><option value="buyer">Покупатель</option><option value="carrier">Перевозчик</option>
            </select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })} required>
              <option value="">Выберите контрагента</option>
              {partyOptions.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.parentContractId} onChange={(e) => setForm({ ...form, parentContractId: e.target.value })}>
              <option value="">Основной договор</option>
              {contractOptions.map((item) => <option key={item.id} value={item.id}>{item.contractNumber} · {item.contractName}</option>)}
            </select>
            <div className="flex gap-2">
              <Button type="submit" disabled={save.isPending}><Plus className="mr-1 h-4 w-4" />{form.id ? "Сохранить" : "Добавить"}</Button>
              {form.id && <Button type="button" variant="outline" onClick={() => setForm(emptyForm)}><X className="mr-1 h-4 w-4" />Отмена</Button>}
            </div>
          </form>
          <div className="mt-5 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Контрагент</TableHead><TableHead>Договор</TableHead><TableHead>Номер</TableHead><TableHead>Дата</TableHead><TableHead>Тип записи</TableHead><TableHead className="w-32">Действия</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell colSpan={6}>Загрузка…</TableCell></TableRow> :
                  contracts.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.counterpartyName}</TableCell>
                      <TableCell>{item.contractName}</TableCell>
                      <TableCell>{item.contractNumber}</TableCell>
                      <TableCell>{item.contractDate?.slice(0, 10)}</TableCell>
                      <TableCell>{item.parentContractId ? "Приложение" : "Договор"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" title="История" onClick={() => setAudit({ id: item.id, name: item.contractName })}><History className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" title="Изменить" onClick={() => edit(item)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" title="Удалить" onClick={() => setDeleting(item)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                {!isLoading && contracts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Договоры ещё не добавлены</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <AuditPanel open={!!audit} onOpenChange={(open) => !open && setAudit(null)} entityType="counterparty_contracts" entityId={audit?.id} entityName={audit?.name} />
      <DeleteConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} onConfirm={() => deleting && remove.mutate(deleting.id)} title="Удалить договор?" description="Запись можно восстановить через историю аудита." />
    </div>
  );
}
