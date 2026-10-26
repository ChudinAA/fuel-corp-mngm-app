import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { EntityActionsMenu } from "@/components/entity-actions-menu";
import { ContractCatalogDialog } from "./catalogs/contract-catalog-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";

type Contract = {
  id: string;
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

export function ContractsTab() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState("");
  const [recordType, setRecordType] = useState("all");
  const [partyType, setPartyType] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [deleting, setDeleting] = useState<Contract | null>(null);
  const { data: contracts = [], isLoading, isError, refetch } = useQuery<Contract[]>({ queryKey: ["/api/contracts"] });
  const { data: suppliers = [] } = useQuery<Party[]>({ queryKey: ["/api/suppliers"] });
  const { data: buyers = [] } = useQuery<Party[]>({ queryKey: ["/api/customers"] });
  const { data: carriers = [] } = useQuery<Party[]>({ queryKey: ["/api/logistics/carriers"] });
  const partyNames = useMemo(() => new Map([...suppliers, ...buyers, ...carriers].map((party) => [party.id, party.name])), [suppliers, buyers, carriers]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/contracts/${id}`);
      if (!response.ok) throw new Error((await response.json()).message || "Не удалось удалить договор");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Договор удалён" });
      setDeleting(null);
    },
    onError: (error: Error) => toast({ title: "Ошибка", description: error.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => contracts.filter((item) => {
    const haystack = `${item.contractName} ${item.contractNumber} ${item.counterpartyName} ${partyNames.get(item.supplierId || item.buyerId || item.carrierId || "") || ""}`.toLocaleLowerCase("ru");
    return haystack.includes(search.trim().toLocaleLowerCase("ru"))
      && (recordType === "all" || (recordType === "appendix" ? !!item.parentContractId : !item.parentContractId))
      && (partyType === "all" || item.counterpartyType === partyType);
  }), [contracts, search, recordType, partyType, partyNames]);

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (item: Contract) => { setEditing(item); setDialogOpen(true); };

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-md bg-primary/10 p-2 text-primary"><FileText className="h-5 w-5" /></span>
          <div><h2 className="text-lg font-semibold">Договоры</h2><p className="text-sm text-muted-foreground">Договоры и приложения контрагентов</p></div>
        </div>
        {hasPermission("directories", "create") && <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Новый договор</Button>}
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по договору или контрагенту" className="pl-9" aria-label="Поиск договоров" />
        </div>
        <Select value={recordType} onValueChange={setRecordType}>
          <SelectTrigger className="sm:w-44"><SelectValue placeholder="Тип записи" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Договоры и приложения</SelectItem><SelectItem value="contract">Основные договоры</SelectItem><SelectItem value="appendix">Приложения</SelectItem></SelectContent>
        </Select>
        <Select value={partyType} onValueChange={setPartyType}>
          <SelectTrigger className="sm:w-40"><SelectValue placeholder="Контрагент" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Все контрагенты</SelectItem><SelectItem value="supplier">Поставщики</SelectItem><SelectItem value="buyer">Покупатели</SelectItem><SelectItem value="carrier">Перевозчики</SelectItem></SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-muted/50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_120px_100px_40px]">
          <span>Договор / номер</span><span className="hidden sm:block">Контрагент</span><span className="hidden sm:block">Дата</span><span className="hidden sm:block">Вид</span><span />
        </div>
        {isLoading ? <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div> :
          isError ? <div className="flex items-center justify-between gap-3 p-5 text-sm text-destructive"><span>Не удалось загрузить договоры</span><Button size="sm" variant="outline" onClick={() => refetch()}>Повторить</Button></div> :
            filtered.length === 0 ? <div className="p-10 text-center"><FileText className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" /><p className="font-medium">{contracts.length ? "Ничего не найдено" : "Договоров пока нет"}</p><p className="mt-1 text-sm text-muted-foreground">{contracts.length ? "Измените поисковый запрос или фильтры." : "Создайте договор или приложение контрагента."}</p></div> :
              filtered.map((item) => (
                <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t px-4 py-3 transition-colors hover:bg-muted/30 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_120px_100px_40px]">
                  <div className="min-w-0"><p className="truncate font-medium">{item.contractName}</p><p className="text-sm text-muted-foreground">№ {item.contractNumber} <span className="sm:hidden">· {item.counterpartyName}</span></p></div>
                  <span className="hidden truncate text-sm sm:block">{item.counterpartyName}</span>
                  <span className="hidden text-sm text-muted-foreground sm:block">{item.contractDate?.slice(0, 10) || "—"}</span>
                  <span className="hidden sm:block"><Badge variant={item.parentContractId ? "secondary" : "outline"}>{item.parentContractId ? "Приложение" : "Договор"}</Badge></span>
                  <EntityActionsMenu
                    triggerClassName="h-8 w-8"
                    audit={{ entityType: "counterparty_contracts", entityId: item.id, entityName: item.contractName }}
                    actions={[
                      { id: "edit", label: "Изменить", icon: Pencil, onClick: () => openEdit(item), permission: { module: "directories", action: "edit" } },
                      { id: "delete", label: "Удалить", icon: Trash2, onClick: () => setDeleting(item), variant: "destructive", permission: { module: "directories", action: "delete" } },
                    ]}
                  />
                </div>
              ))}
      </div>
      <ContractCatalogDialog
        open={dialogOpen}
        editItem={editing}
        contracts={contracts}
        suppliers={suppliers}
        buyers={buyers}
        carriers={carriers}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}
      />
      <DeleteConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} onConfirm={() => deleting && remove.mutate(deleting.id)} title="Удалить договор?" description="Удалённую запись можно восстановить через историю аудита." />
    </section>
  );
}
