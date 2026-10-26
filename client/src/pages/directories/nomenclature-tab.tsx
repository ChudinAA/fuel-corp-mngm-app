import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { EntityActionsMenu } from "@/components/entity-actions-menu";
import { NomenclatureItemDialog } from "./catalogs/nomenclature-item-dialog";
import { UnitCatalogDialog } from "./catalogs/unit-catalog-dialog";
import { Package, Pencil, Plus, Search, Ruler, Trash2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type ProductType = "kerosene" | "pvkj" | "service";
type UnitRow = { id: string; shortName: string; fullName: string; conversionFactor: string | null; referenceUnitId: string | null };
type ItemRow = {
  id: string;
  productType: ProductType | null;
  typeCode?: ProductType | null;
  name: string;
  unitId: string;
  unitShortName: string;
  unitFullName: string;
  isDefault: boolean;
};
type Deleting = { id: string; name: string; kind: "item" | "unit" } | null;
const productLabels: Record<ProductType, string> = { kerosene: "Керосин", pvkj: "ПВКЖ", service: "Услуга" };

export function NomenclatureTab() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("directories", "create");
  const canEdit = hasPermission("directories", "edit");
  const canDelete = hasPermission("directories", "delete");
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemRow | null>(null);
  const [editingUnit, setEditingUnit] = useState<UnitRow | null>(null);
  const [deleting, setDeleting] = useState<Deleting>(null);
  const { data: items = [], isLoading: itemsLoading, isError: itemsError, refetch: refetchItems } = useQuery<ItemRow[]>({ queryKey: ["/api/nomenclature"] });
  const { data: units = [], isLoading: unitsLoading, isError: unitsError, refetch: refetchUnits } = useQuery<UnitRow[]>({ queryKey: ["/api/units-of-measure"] });

  const refreshItems = () => queryClient.invalidateQueries({ queryKey: ["/api/nomenclature"] });
  const defaultMutation = useMutation({
    mutationFn: async ({ item, isDefault }: { item: ItemRow; isDefault: boolean }) => {
      const response = await apiRequest("PATCH", `/api/nomenclature/${item.id}`, { isDefault });
      if (!response.ok) {
        let message = "Не удалось изменить значение по умолчанию";
        try { message = (await response.json()).message || message; } catch { /* use fallback */ }
        throw new Error(message);
      }
      return { item, isDefault };
    },
    onMutate: async ({ item, isDefault }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/nomenclature"] });
      const previous = queryClient.getQueryData<ItemRow[]>(["/api/nomenclature"]);
      queryClient.setQueryData<ItemRow[]>(["/api/nomenclature"], (current) => current?.map((row) => row.productType === item.productType && row.id === item.id ? { ...row, isDefault } : row));
      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(["/api/nomenclature"], context.previous);
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
    onSuccess: () => toast({ title: "Значение обновлено" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/nomenclature"] }),
  });
  const remove = useMutation({
    mutationFn: async (target: NonNullable<Deleting>) => {
      const path = target.kind === "item" ? "/api/nomenclature" : "/api/units-of-measure";
      const response = await apiRequest("DELETE", `${path}/${target.id}`);
      if (!response.ok) {
        let message = "Не удалось удалить запись";
        try { message = (await response.json()).message || message; } catch { /* use fallback */ }
        throw new Error(message);
      }
    },
    onSuccess: () => {
      refreshItems();
      queryClient.invalidateQueries({ queryKey: ["/api/units-of-measure"] });
      toast({ title: "Запись удалена" });
      setDeleting(null);
    },
    onError: (error: Error) => toast({ title: "Ошибка", description: error.message, variant: "destructive" }),
  });

  const filteredItems = useMemo(() => items.filter((item) => {
    const productType = item.productType ?? item.typeCode;
    const productName = productType ? productLabels[productType] : "Не задан";
    return `${item.name} ${item.unitShortName} ${item.unitFullName} ${productName}`.toLocaleLowerCase("ru").includes(search.trim().toLocaleLowerCase("ru"))
      && (productFilter === "all" || productType === productFilter);
  }), [items, search, productFilter]);
  const editItem = (item: ItemRow) => { setEditingItem(item); setItemDialogOpen(true); };
  const editUnit = (unit: UnitRow) => { setEditingUnit(unit); setUnitDialogOpen(true); };
  const closeItemDialog = (open: boolean) => { setItemDialogOpen(open); if (!open) setEditingItem(null); };
  const closeUnitDialog = (open: boolean) => { setUnitDialogOpen(open); if (!open) setEditingUnit(null); };

  return (
    <section className="space-y-7">
      <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-md bg-primary/10 p-2 text-primary"><Package className="h-5 w-5" /></span>
          <div><h2 className="text-lg font-semibold">Номенклатура</h2><p className="text-sm text-muted-foreground">Товары, услуги и единицы измерения</p></div>
        </div>
        {canCreate && <Button size="sm" onClick={() => { setEditingItem(null); setItemDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" />Добавить позицию</Button>}
      </header>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Поиск в номенклатуре" aria-label="Поиск номенклатуры" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <Select value={productFilter} onValueChange={setProductFilter}><SelectTrigger className="sm:w-48"><SelectValue placeholder="Тип продукта" /></SelectTrigger><SelectContent><SelectItem value="all">Все типы продуктов</SelectItem><SelectItem value="kerosene">Керосин</SelectItem><SelectItem value="pvkj">ПВКЖ</SelectItem><SelectItem value="service">Услуга</SelectItem></SelectContent></Select>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[minmax(0,1fr)_64px_40px] gap-2 bg-muted/50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid-cols-[160px_minmax(0,1fr)_minmax(120px,.7fr)_64px_40px]"><span className="sm:hidden">Позиция</span><span className="hidden sm:block">Тип продукта</span><span className="hidden sm:block">Наименование</span><span className="hidden sm:block">Ед. изм.</span><span className="text-center">По умолчанию</span><span /></div>
          {itemsLoading ? <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div> :
            itemsError ? <div className="flex items-center justify-between gap-3 p-5 text-sm text-destructive"><span>Не удалось загрузить номенклатуру</span><Button size="sm" variant="outline" onClick={() => refetchItems()}>Повторить</Button></div> :
              filteredItems.length === 0 ? <div className="p-9 text-center"><Package className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" /><p className="font-medium">{items.length ? "Ничего не найдено" : "Позиции ещё не добавлены"}</p><p className="mt-1 text-sm text-muted-foreground">{items.length ? "Попробуйте изменить поиск или фильтр." : "Добавьте продукт или услугу, чтобы начать работу."}</p></div> :
                filteredItems.map((item) => {
                  const productType = item.productType ?? item.typeCode;
                  const defaultPending = defaultMutation.isPending && defaultMutation.variables?.item.id === item.id;
                  return <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_64px_40px] items-center gap-2 border-t px-4 py-3 transition-colors hover:bg-muted/30 sm:grid-cols-[160px_minmax(0,1fr)_minmax(120px,.7fr)_64px_40px]">
                    <Badge variant="outline" className="hidden w-fit max-w-full truncate sm:block">{productType ? productLabels[productType] : "Не задан"}</Badge>
                    <div className="min-w-0 sm:col-span-1"><div className="flex min-w-0 items-center gap-2"><Badge variant="outline" className="max-w-full truncate sm:hidden">{productType ? productLabels[productType] : "Не задан"}</Badge><p className="truncate font-medium">{item.name}</p></div><p className="text-xs text-muted-foreground sm:hidden">{item.unitShortName}</p></div>
                    <span className="flex justify-center sm:hidden"><Switch aria-label={`По умолчанию: ${item.name}`} checked={!!item.isDefault} disabled={!canEdit || defaultPending || !productType} onCheckedChange={(checked) => defaultMutation.mutate({ item, isDefault: checked })} /></span>
                    <div className="hidden min-w-0 sm:block"><p className="truncate text-sm">{item.unitShortName || "—"}</p><p className="truncate text-xs text-muted-foreground">{item.unitFullName}</p></div>
                    <span className="hidden sm:flex sm:justify-center"><Switch aria-label={`По умолчанию: ${item.name}`} checked={!!item.isDefault} disabled={!canEdit || defaultPending || !productType} onCheckedChange={(checked) => defaultMutation.mutate({ item, isDefault: checked })} /></span>
                    <EntityActionsMenu triggerClassName="h-8 w-8" audit={{ entityType: "nomenclature", entityId: item.id, entityName: item.name }} actions={[
                      { id: "edit", label: "Изменить", icon: Pencil, onClick: () => editItem(item), permission: { module: "directories", action: "edit" } },
                      { id: "delete", label: "Удалить", icon: Trash2, onClick: () => setDeleting({ id: item.id, name: item.name, kind: "item" }), variant: "destructive", permission: { module: "directories", action: "delete" } },
                    ]} />
                  </div>;
                })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><Ruler className="h-4 w-4 text-muted-foreground" /><div><h3 className="font-semibold">Единицы измерения</h3><p className="text-xs text-muted-foreground">Коэффициент пересчёта задаёт эквивалент единицы</p></div></div>
          {canCreate && <Button size="sm" variant="outline" onClick={() => { setEditingUnit(null); setUnitDialogOpen(true); }}><Plus className="mr-1.5 h-4 w-4" />Единица</Button>}
        </div>
        <div className="overflow-hidden rounded-lg border">
          {unitsLoading ? <div className="space-y-2 p-4">{[1, 2].map((i) => <Skeleton key={i} className="h-11 w-full" />)}</div> :
            unitsError ? <div className="flex items-center justify-between gap-3 p-5 text-sm text-destructive"><span>Не удалось загрузить единицы измерения</span><Button size="sm" variant="outline" onClick={() => refetchUnits()}>Повторить</Button></div> :
              units.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">Единицы измерения ещё не добавлены.</div> :
                units.map((unit) => {
                  const reference = units.find((candidate) => candidate.id === unit.referenceUnitId);
                  const factor = unit.conversionFactor ? Number(unit.conversionFactor) : null;
                  return <div key={unit.id} className="grid grid-cols-[minmax(0,1fr)_auto_40px] items-center gap-3 border-t first:border-t-0 px-4 py-3">
                    <div className="min-w-0"><p className="font-medium">{unit.shortName} <span className="font-normal text-muted-foreground">· {unit.fullName}</span></p><p className="truncate text-xs text-muted-foreground">{factor && reference ? `1 ${unit.shortName} = ${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 6 }).format(factor)} ${reference.shortName}` : "Без пересчёта"}</p></div>
                    <span className="hidden text-xs text-muted-foreground sm:block">{factor && reference ? "Коэффициент задан" : "—"}</span>
                    <EntityActionsMenu triggerClassName="h-8 w-8" audit={{ entityType: "units_of_measure", entityId: unit.id, entityName: unit.shortName }} actions={[
                      { id: "edit", label: "Изменить", icon: Pencil, onClick: () => editUnit(unit), permission: { module: "directories", action: "edit" } },
                      { id: "delete", label: "Удалить", icon: Trash2, onClick: () => setDeleting({ id: unit.id, name: unit.shortName, kind: "unit" }), variant: "destructive", permission: { module: "directories", action: "delete" } },
                    ]} />
                  </div>;
                })}
        </div>
      </div>
      <NomenclatureItemDialog open={itemDialogOpen} editItem={editingItem} units={units} onOpenChange={closeItemDialog} />
      <UnitCatalogDialog open={unitDialogOpen} editItem={editingUnit} units={units} onOpenChange={closeUnitDialog} />
      <DeleteConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} onConfirm={() => deleting && remove.mutate(deleting)} title={`Удалить «${deleting?.name || ""}»?`} description="Удалённую запись можно восстановить через историю аудита." />
    </section>
  );
}
