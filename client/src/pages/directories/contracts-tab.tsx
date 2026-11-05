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
import { FilePlus2, FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";

type Contract = {
  id: string;
  id1c?: string | null;
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
  const { hasPermission, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [recordType, setRecordType] = useState("all");
  const [partyType, setPartyType] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [appendixParent, setAppendixParent] = useState<Contract | null>(null);
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

  const matching = useMemo(() => contracts.filter((item) => {
    const haystack = `${item.contractName} ${item.contractNumber} ${item.counterpartyName} ${partyNames.get(item.supplierId || item.buyerId || item.carrierId || "") || ""}`.toLocaleLowerCase("ru");
    return haystack.includes(search.trim().toLocaleLowerCase("ru"))
      && (recordType === "all" || (recordType === "appendix" ? !!item.parentContractId : !item.parentContractId))
      && (partyType === "all" || item.counterpartyType === partyType);
  }), [contracts, search, recordType, partyType, partyNames]);
  const visibleRows = useMemo(() => {
    const matches = new Map(matching.map((item) => [item.id, item]));
    const byId = new Map(contracts.map((item) => [item.id, item]));
    const groups = new Map<string, { parent: Contract; children: Contract[] }>();
    matching.forEach((item) => {
      const parent = item.parentContractId ? byId.get(item.parentContractId) : item;
      if (!parent) return;
      const group = groups.get(parent.id) || { parent, children: [] };
      if (item.id !== parent.id) group.children.push(item);
      groups.set(parent.id, group);
    });
    return Array.from(groups.values()).flatMap(({ parent, children }) => {
      const parentMatches = matches.has(parent.id);
      const rows = parentMatches ? [parent, ...contracts.filter((item) => item.parentContractId === parent.id && matches.has(item.id))] : [parent, ...children];
      return rows.map((item) => ({ item, contextOnly: !matches.has(item.id) }));
    });
  }, [contracts, matching]);

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (item: Contract) => { setEditing(item); setDialogOpen(true); };
  const openAppendix = (parent: Contract) => { setEditing(null); setAppendixParent(parent); setDialogOpen(true); };

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
        <div className="flex items-center justify-between bg-muted/50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>Договоры и приложения</span><span>{matching.length} {matching.length === 1 ? "запись" : "записей"}</span>
        </div>
        {isLoading ? <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div> :
          isError ? <div className="flex items-center justify-between gap-3 p-5 text-sm text-destructive"><span>Не удалось загрузить договоры</span><Button size="sm" variant="outline" onClick={() => refetch()}>Повторить</Button></div> :
            visibleRows.length === 0 ? <div className="p-10 text-center"><FileText className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" /><p className="font-medium">{contracts.length ? "Ничего не найдено" : "Договоров пока нет"}</p><p className="mt-1 text-sm text-muted-foreground">{contracts.length ? "Измените поисковый запрос или фильтры." : "Создайте договор или приложение контрагента."}</p></div> :
              visibleRows.map(({ item, contextOnly }) => (
                <div key={item.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t px-3 py-3 transition-colors hover:bg-muted/30 sm:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_110px_76px_40px] sm:gap-3 sm:px-4 ${item.parentContractId ? "bg-muted/15" : ""} ${contextOnly ? "opacity-70" : ""}`}>
                  <div className={`min-w-0 ${item.parentContractId ? "pl-5 sm:pl-8" : ""}`}>
                    <div className="flex min-w-0 items-center gap-2">
                      {item.parentContractId && <span className="shrink-0 text-muted-foreground" aria-hidden="true">↳</span>}
                      <p className="truncate font-medium">{item.contractName}</p>
                      {item.parentContractId && <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">Приложение</Badge>}
                      {item.id1c && <Badge variant="outline" className="shrink-0 text-[10px]">1С</Badge>}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">№ {item.contractNumber} <span className="sm:hidden">· {item.contractDate?.slice(0, 10) || "—"}</span></p>
                    <span className="mt-1 flex min-w-0 items-center gap-1.5 sm:hidden">
                      <Badge variant="outline" className={`shrink-0 text-[10px] ${item.counterpartyType === "supplier" ? "border-amber-600/30 bg-amber-500/10 text-amber-800 dark:text-amber-300" : item.counterpartyType === "buyer" ? "border-teal-600/30 bg-teal-500/10 text-teal-800 dark:text-teal-300" : "border-sky-600/30 bg-sky-500/10 text-sky-800 dark:text-sky-300"}`}>{item.counterpartyType === "supplier" ? "Поставщик" : item.counterpartyType === "buyer" ? "Покупатель" : "Перевозчик"}</Badge>
                      <span className="truncate text-xs text-muted-foreground">{partyNames.get(item.supplierId || item.buyerId || item.carrierId || "") || item.counterpartyName}</span>
                    </span>
                  </div>
                  <span className="hidden min-w-0 items-center gap-2 truncate text-sm sm:flex">
                    <Badge variant="outline" className={item.counterpartyType === "supplier" ? "shrink-0 border-amber-600/30 bg-amber-500/10 text-amber-800 dark:text-amber-300" : item.counterpartyType === "buyer" ? "shrink-0 border-teal-600/30 bg-teal-500/10 text-teal-800 dark:text-teal-300" : "shrink-0 border-sky-600/30 bg-sky-500/10 text-sky-800 dark:text-sky-300"}>{item.counterpartyType === "supplier" ? "Поставщик" : item.counterpartyType === "buyer" ? "Покупатель" : "Перевозчик"}</Badge>
                    <span className="truncate">{partyNames.get(item.supplierId || item.buyerId || item.carrierId || "") || item.counterpartyName}</span>
                  </span>
                  <span className="hidden text-sm text-muted-foreground sm:block">{item.contractDate?.slice(0, 10) || "—"}</span>
                  <span className="hidden text-xs text-muted-foreground sm:block">{item.parentContractId ? "" : `${contracts.filter((c) => c.parentContractId === item.id).length} прил.`}</span>
                  <div className="flex items-center justify-end gap-1">
                    {!item.parentContractId && hasPermission("directories", "create") && <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={`Добавить приложение к ${item.contractName}`} title="Добавить приложение" onClick={() => openAppendix(item)}><FilePlus2 className="h-4 w-4" /></Button>}
                  {(!item.id1c || isAdmin) && (
                    <EntityActionsMenu
                      triggerClassName="h-8 w-8"
                      audit={{ entityType: "counterparty_contracts", entityId: item.id, entityName: item.contractName }}
                      actions={[
                        { id: "edit", label: "Изменить", icon: Pencil, onClick: () => openEdit(item), permission: { module: "directories", action: "edit" } },
                        { id: "delete", label: "Удалить", icon: Trash2, onClick: () => setDeleting(item), variant: "destructive", permission: { module: "directories", action: "delete" } },
                      ]}
                    />
                  )}
                  </div>
                </div>
              ))}
      </div>
      <ContractCatalogDialog
        open={dialogOpen}
        editItem={editing}
        initialParent={appendixParent}
        contracts={contracts}
        suppliers={suppliers}
        buyers={buyers}
        carriers={carriers}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditing(null); setAppendixParent(null); } }}
      />
      <DeleteConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} onConfirm={() => deleting && remove.mutate(deleting.id)} title="Удалить договор?" description="Удалённую запись можно восстановить через историю аудита." />
    </section>
  );
}
