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
import { ProductTypeBadge } from "@/components/product-type-badge";
import { NomenclatureItemDialog } from "./catalogs/nomenclature-item-dialog";
import { NomenclatureKindDialog, type NomenclatureType } from "./catalogs/nomenclature-kind-dialog";
import { UnitCatalogDialog } from "./catalogs/unit-catalog-dialog";
import { Package, Pencil, Plus, Search, Ruler, Trash2, Shapes } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ProductType = "kerosene" | "pvkj" | "service";
type UnitRow = { id: string; id1c?: string | null; shortName: string; fullName: string; conversionFactor: string | null; referenceUnitId: string | null };
type ItemRow = {
  id: string;
  id1c?: string | null;
  productType: ProductType | null;
  nomenclatureTypeId: string | null;
  typeName?: string | null;
  name: string;
  unitId: string;
  unitShortName: string;
  unitFullName: string;
  isDefault: boolean;
};
type Deleting = { id: string; name: string; kind: "item" | "unit" | "type" } | null;
const productLabels: Record<ProductType, string> = { kerosene: "Керосин", pvkj: "ПВКЖ", service: "Услуга" };

export function NomenclatureTab() {
  const { toast } = useToast();
  const { hasPermission, isAdmin } = useAuth();
  const canCreate = hasPermission("directories", "create");
  const canEdit = hasPermission("directories", "edit");
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [kindDialogOpen, setKindDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemRow | null>(null);
  const [editingUnit, setEditingUnit] = useState<UnitRow | null>(null);
  const [editingKind, setEditingKind] = useState<NomenclatureType | null>(null);
  const [deleting, setDeleting] = useState<Deleting>(null);
  const { data: items = [], isLoading: itemsLoading, isError: itemsError, refetch: refetchItems } = useQuery<ItemRow[]>({ queryKey: ["/api/nomenclature"] });
  const { data: units = [], isLoading: unitsLoading, isError: unitsError, refetch: refetchUnits } = useQuery<UnitRow[]>({ queryKey: ["/api/units-of-measure"] });
  const { data: types = [], isLoading: typesLoading, isError: typesError, refetch: refetchTypes } = useQuery<NomenclatureType[]>({ queryKey: ["/api/nomenclature-types"] });

  const defaultMutation = useMutation({
    mutationFn: async ({ item, isDefault }: { item: ItemRow; isDefault: boolean }) => {
      const response = await apiRequest("PATCH", `/api/nomenclature/${item.id}`, { isDefault });
      if (!response.ok) {
        let message = "Не удалось изменить значение по умолчанию";
        try { message = (await response.json()).message || message; } catch { /* fallback */ }
        throw new Error(message);
      }
      return { item, isDefault };
    },
    onMutate: async ({ item, isDefault }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/nomenclature"] });
      const previous = queryClient.getQueryData<ItemRow[]>(["/api/nomenclature"]);
      queryClient.setQueryData<ItemRow[]>(["/api/nomenclature"], (current) => current?.map((row) => row.id === item.id ? { ...row, isDefault } : row));
      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(["/api/nomenclature"], context.previous);
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
    onSuccess: () => toast({ title: "Значение по умолчанию обновлено" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/nomenclature"] }),
  });

  const remove = useMutation({
    mutationFn: async (target: NonNullable<Deleting>) => {
      const path = target.kind === "item" ? "/api/nomenclature" : target.kind === "unit" ? "/api/units-of-measure" : "/api/nomenclature-types";
      const response = await apiRequest("DELETE", `${path}/${target.id}`);
      if (!response.ok) {
        let message = "Не удалось удалить запись";
        try { message = (await response.json()).message || message; } catch { /* fallback */ }
        throw new Error(message);
      }
    },
    onSuccess: (_data, target) => {
      queryClient.invalidateQueries({ queryKey: [target.kind === "item" ? "/api/nomenclature" : target.kind === "unit" ? "/api/units-of-measure" : "/api/nomenclature-types"] });
      if (target.kind === "type") queryClient.invalidateQueries({ queryKey: ["/api/nomenclature"] });
      toast({ title: "Запись удалена" });
      setDeleting(null);
    },
    onError: (error: Error) => toast({ title: "Ошибка", description: error.message, variant: "destructive" }),
  });

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ru");
    return items.filter((item) => {
      const kindName = item.typeName || types.find((type) => type.id === item.nomenclatureTypeId)?.name || "Вид не задан";
      const productName = item.productType ? productLabels[item.productType] : "Не задан";
      return `${item.name} ${item.unitShortName} ${item.unitFullName} ${productName} ${kindName}`.toLocaleLowerCase("ru").includes(query)
        && (productFilter === "all" || item.productType === productFilter);
    });
  }, [items, search, productFilter, types]);
  const groups = useMemo(() => {
    const bucket = new Map<string, ItemRow[]>();
    filteredItems.forEach((item) => {
      const key = item.productType || "unclassified";
      bucket.set(key, [...(bucket.get(key) || []), item]);
    });
    const order = ["kerosene", "pvkj", "service", "unclassified"];
    return Array.from(bucket.entries()).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  }, [filteredItems]);
  const editItem = (item: ItemRow) => { setEditingItem(item); setItemDialogOpen(true); };
  const editUnit = (unit: UnitRow) => { setEditingUnit(unit); setUnitDialogOpen(true); };
  const closeItemDialog = (open: boolean) => { setItemDialogOpen(open); if (!open) setEditingItem(null); };
  const closeUnitDialog = (open: boolean) => { setUnitDialogOpen(open); if (!open) setEditingUnit(null); };
  const closeKindDialog = (open: boolean) => { setKindDialogOpen(open); if (!open) setEditingKind(null); };

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-md bg-primary/10 p-2 text-primary"><Package className="h-5 w-5" /></span>
          <div><h2 className="text-lg font-semibold">Номенклатура</h2><p className="text-sm text-muted-foreground">Товары, услуги и единицы измерения</p></div>
        </div>
        {canCreate && <Button size="sm" onClick={() => { setEditingItem(null); setItemDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" />Добавить позицию</Button>}
      </header>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.85fr)]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Поиск в номенклатуре" aria-label="Поиск номенклатуры" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            <Select value={productFilter} onValueChange={setProductFilter}><SelectTrigger className="sm:w-48"><SelectValue placeholder="Тип продукта" /></SelectTrigger><SelectContent><SelectItem value="all">Все типы продуктов</SelectItem><SelectItem value="kerosene">Керосин</SelectItem><SelectItem value="pvkj">ПВКЖ</SelectItem><SelectItem value="service">Услуга</SelectItem></SelectContent></Select>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between gap-3 bg-muted/50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><span>Позиции по типам продуктов</span><span>{filteredItems.length} из {items.length}</span></div>
            {itemsLoading || typesLoading ? <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div> :
              itemsError ? <div className="flex items-center justify-between gap-3 p-5 text-sm text-destructive"><span>Не удалось загрузить номенклатуру</span><Button size="sm" variant="outline" onClick={() => refetchItems()}>Повторить</Button></div> :
              typesError ? <div className="flex items-center justify-between gap-3 p-5 text-sm text-destructive"><span>Не удалось загрузить виды номенклатуры</span><Button size="sm" variant="outline" onClick={() => refetchTypes()}>Повторить</Button></div> :
              filteredItems.length === 0 ? <div className="p-9 text-center"><Package className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" /><p className="font-medium">{items.length ? "Ничего не найдено" : "Позиции ещё не добавлены"}</p><p className="mt-1 text-sm text-muted-foreground">{items.length ? "Попробуйте изменить поиск или фильтр." : "Добавьте продукт или услугу, чтобы начать работу."}</p></div> :
              groups.map(([groupKey, rows]) => <div key={groupKey}>
                <div className="flex items-center justify-between border-t bg-muted/25 px-4 py-2.5 first:border-t-0">
                  <div className="flex items-center gap-2">{groupKey === "unclassified" ? <Badge variant="outline">Не задан</Badge> : <ProductTypeBadge type={groupKey} />}<span className="text-xs text-muted-foreground">{rows.length} поз.</span></div>
                  <span className="hidden grid-cols-[minmax(0,1fr)_minmax(110px,.65fr)_minmax(100px,.7fr)_68px_36px] gap-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground md:grid md:w-[76%]"><span>Наименование</span><span>Ед. изм.</span><span>Вид номенклатуры</span><span className="text-center">По умолчанию</span><span /></span>
                </div>
                {rows.map((item) => {
                  const typeName = item.typeName || types.find((type) => type.id === item.nomenclatureTypeId)?.name || "Не задан";
                  const pending = defaultMutation.isPending && defaultMutation.variables?.item.id === item.id;
                  return <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_64px_36px] items-center gap-2 border-t px-3 py-3 transition-colors hover:bg-muted/20 sm:px-4 md:grid-cols-[minmax(0,1fr)_minmax(110px,.65fr)_minmax(100px,.7fr)_68px_36px] md:gap-2">
                     <div className="min-w-0"><div className="flex min-w-0 items-center gap-1.5"><p className="truncate font-medium">{item.name}</p>{item.id1c && <Badge variant="outline" className="shrink-0 text-[10px]">1С</Badge>}</div><p className="truncate text-xs text-muted-foreground md:hidden">{item.unitShortName || "—"} · {typeName}</p></div>
                    <div className="hidden min-w-0 md:block"><p className="truncate text-sm">{item.unitShortName || "—"}</p><p className="truncate text-xs text-muted-foreground">{item.unitFullName}</p></div>
                    <div className="hidden min-w-0 md:block"><Badge variant="outline" className={`max-w-full truncate ${!item.nomenclatureTypeId ? "text-muted-foreground" : ""}`}>{typeName}</Badge></div>
                     <span className="flex justify-center"><Switch aria-label={`По умолчанию: ${item.name}`} checked={!!item.isDefault} disabled={!canEdit || pending || !item.productType || (!!item.id1c && !isAdmin)} onCheckedChange={(checked) => defaultMutation.mutate({ item, isDefault: checked })} /></span>
                     {(!item.id1c || isAdmin) ? <EntityActionsMenu triggerClassName="h-8 w-8" audit={{ entityType: "nomenclature", entityId: item.id, entityName: item.name }} actions={[
                       { id: "edit", label: "Изменить", icon: Pencil, onClick: () => editItem(item), permission: { module: "directories", action: "edit" } },
                       { id: "delete", label: "Удалить", icon: Trash2, onClick: () => setDeleting({ id: item.id, name: item.name, kind: "item" }), variant: "destructive", permission: { module: "directories", action: "delete" } },
                     ]} /> : <span className="h-8 w-8" aria-label="Синхронизировано с 1С" />}
                  </div>;
                })}
              </div>)}
          </div>
        </div>

        <aside className="min-w-0 space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><Shapes className="h-4 w-4 text-muted-foreground" /><div><h3 className="font-semibold">Виды номенклатуры</h3><p className="text-xs text-muted-foreground">Классификация для обмена данными</p></div></div>
              {canCreate && <Button size="sm" variant="outline" onClick={() => { setEditingKind(null); setKindDialogOpen(true); }}><Plus className="mr-1.5 h-4 w-4" />Добавить</Button>}
            </div>
            <div className="overflow-hidden rounded-lg border">
              {typesLoading ? <div className="space-y-2 p-3">{[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div> :
                typesError ? <div className="flex items-center justify-between gap-2 p-4 text-sm text-destructive"><span>Не удалось загрузить виды</span><Button size="sm" variant="outline" onClick={() => refetchTypes()}>Повторить</Button></div> :
                types.length === 0 ? <div className="p-5 text-center text-sm text-muted-foreground">Виды пока не добавлены.</div> :
                types.map((type) => <div key={type.id} className="flex items-center justify-between gap-2 border-t px-3 py-2.5 first:border-t-0">
                   <span className="flex min-w-0 items-center gap-1.5"><span className="truncate text-sm font-medium">{type.name}</span>{type.id1c && <Badge variant="outline" className="shrink-0 text-[10px]">1С</Badge>}</span>
                   {(!type.id1c || isAdmin) ? <EntityActionsMenu triggerClassName="h-8 w-8" audit={{ entityType: "nomenclature_types", entityId: type.id, entityName: type.name }} actions={[
                    { id: "edit", label: "Изменить", icon: Pencil, onClick: () => { setEditingKind(type); setKindDialogOpen(true); }, permission: { module: "directories", action: "edit" } },
                    { id: "delete", label: "Удалить", icon: Trash2, onClick: () => setDeleting({ id: type.id, name: type.name, kind: "type" }), variant: "destructive", permission: { module: "directories", action: "delete" } },
                   ]} /> : <span className="h-8 w-8" aria-label="Синхронизировано с 1С" />}
                </div>)}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><Ruler className="h-4 w-4 text-muted-foreground" /><div><h3 className="font-semibold">Единицы измерения</h3><p className="text-xs text-muted-foreground">Коэффициент задаёт эквивалент единицы</p></div></div>
              {canCreate && <Button size="sm" variant="outline" onClick={() => { setEditingUnit(null); setUnitDialogOpen(true); }}><Plus className="mr-1.5 h-4 w-4" />Единица</Button>}
            </div>
            <div className="overflow-hidden rounded-lg border">
              {unitsLoading ? <div className="space-y-2 p-3">{[1, 2].map((i) => <Skeleton key={i} className="h-11 w-full" />)}</div> :
                unitsError ? <div className="flex items-center justify-between gap-2 p-4 text-sm text-destructive"><span>Не удалось загрузить единицы</span><Button size="sm" variant="outline" onClick={() => refetchUnits()}>Повторить</Button></div> :
                units.length === 0 ? <div className="p-5 text-center text-sm text-muted-foreground">Единицы измерения ещё не добавлены.</div> :
                units.map((unit) => {
                  const reference = units.find((candidate) => candidate.id === unit.referenceUnitId);
                  const factor = unit.conversionFactor ? Number(unit.conversionFactor) : null;
                  return <div key={unit.id} className="grid grid-cols-[minmax(0,1fr)_36px] items-center gap-2 border-t px-3 py-2.5 first:border-t-0">
                     <div className="min-w-0"><p className="flex min-w-0 items-center gap-1.5 text-sm font-medium"><span className="truncate">{unit.shortName} <span className="font-normal text-muted-foreground">· {unit.fullName}</span></span>{unit.id1c && <Badge variant="outline" className="shrink-0 text-[10px]">1С</Badge>}</p><p className="truncate text-xs text-muted-foreground">{factor && reference ? `1 ${unit.shortName} = ${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 6 }).format(factor)} ${reference.shortName}` : "Без пересчёта"}</p></div>
                     {(!unit.id1c || isAdmin) ? <EntityActionsMenu triggerClassName="h-8 w-8" audit={{ entityType: "units_of_measure", entityId: unit.id, entityName: unit.shortName }} actions={[
                      { id: "edit", label: "Изменить", icon: Pencil, onClick: () => editUnit(unit), permission: { module: "directories", action: "edit" } },
                      { id: "delete", label: "Удалить", icon: Trash2, onClick: () => setDeleting({ id: unit.id, name: unit.shortName, kind: "unit" }), variant: "destructive", permission: { module: "directories", action: "delete" } },
                     ]} /> : <span className="h-8 w-8" aria-label="Синхронизировано с 1С" />}
                  </div>;
                })}
            </div>
          </section>
        </aside>
      </div>

      <NomenclatureItemDialog open={itemDialogOpen} editItem={editingItem} units={units} nomenclatureTypes={types} onOpenChange={closeItemDialog} />
      <NomenclatureKindDialog open={kindDialogOpen} editItem={editingKind} onOpenChange={closeKindDialog} />
      <UnitCatalogDialog open={unitDialogOpen} editItem={editingUnit} units={units} onOpenChange={closeUnitDialog} />
      <DeleteConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} onConfirm={() => deleting && remove.mutate(deleting)} title={`Удалить «${deleting?.name || ""}»?`} description="Удалённую запись можно восстановить через историю аудита." />
    </section>
  );
}
