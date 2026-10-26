import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuditPanel } from "@/components/audit-panel";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Package, Pencil, Plus, Trash2, History, X } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type TypeRow = { id: string; id1c: string | null; code: string; name: string };
type UnitRow = { id: string; id1c: string | null; shortName: string; fullName: string; conversionFactor: string | null; referenceNomenclatureId: string | null };
type ItemRow = {
  id: string;
  id1c: string | null;
  nomenclatureTypeId: string;
  typeCode: string;
  typeName: string;
  name: string;
  unitId: string;
  unitShortName: string;
  unitFullName: string;
  isDefault: boolean;
};
type AuditTarget = { entityType: string; id: string; name: string };
type DeleteTarget = { path: string; id: string; title: string } | null;

const blankType = { id: "", id1c: "", code: "", name: "" };
const blankUnit = { id: "", id1c: "", shortName: "", fullName: "", conversionFactor: "", referenceNomenclatureId: "" };
const blankItem = { id: "", id1c: "", nomenclatureTypeId: "", name: "", unitId: "", isDefault: false };

export function NomenclatureTab() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("directories", "create");
  const canEdit = hasPermission("directories", "edit");
  const canDelete = hasPermission("directories", "delete");
  const [typeForm, setTypeForm] = useState(blankType);
  const [unitForm, setUnitForm] = useState(blankUnit);
  const [itemForm, setItemForm] = useState(blankItem);
  const [audit, setAudit] = useState<AuditTarget | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget>(null);

  const { data: types = [] } = useQuery<TypeRow[]>({ queryKey: ["/api/nomenclature-types"] });
  const { data: units = [] } = useQuery<UnitRow[]>({ queryKey: ["/api/units-of-measure"] });
  const { data: items = [], isLoading } = useQuery<ItemRow[]>({ queryKey: ["/api/nomenclature"] });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/nomenclature"] });
    queryClient.invalidateQueries({ queryKey: ["/api/nomenclature-types"] });
    queryClient.invalidateQueries({ queryKey: ["/api/units-of-measure"] });
  };
  const save = useMutation({
    mutationFn: async ({ path, id, payload }: { path: string; id: string; payload: any }) => {
      const response = id
        ? await apiRequest("PATCH", `${path}/${id}`, payload)
        : await apiRequest("POST", path, payload);
      if (!response.ok) throw new Error((await response.json()).message || "Не удалось сохранить");
    },
    onSuccess: () => { refresh(); toast({ title: "Изменения сохранены" }); },
    onError: (error: Error) => toast({ title: "Ошибка", description: error.message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: async ({ path, id }: { path: string; id: string }) => {
      const response = await apiRequest("DELETE", `${path}/${id}`);
      if (!response.ok) throw new Error((await response.json()).message || "Не удалось удалить запись");
    },
    onSuccess: () => { refresh(); setDeleting(null); toast({ title: "Запись удалена" }); },
    onError: (error: Error) => toast({ title: "Ошибка", description: error.message, variant: "destructive" }),
  });

  const saveType = (event: React.FormEvent) => {
    event.preventDefault();
    save.mutate({ path: "/api/nomenclature-types", id: typeForm.id, payload: { code: typeForm.code, name: typeForm.name, id1c: typeForm.id1c || null } });
    setTypeForm(blankType);
  };
  const saveUnit = (event: React.FormEvent) => {
    event.preventDefault();
    save.mutate({ path: "/api/units-of-measure", id: unitForm.id, payload: { shortName: unitForm.shortName, fullName: unitForm.fullName, conversionFactor: unitForm.conversionFactor || null, referenceNomenclatureId: unitForm.referenceNomenclatureId || null, id1c: unitForm.id1c || null } });
    setUnitForm(blankUnit);
  };
  const saveItem = (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemForm.nomenclatureTypeId || !itemForm.unitId) return;
    save.mutate({ path: "/api/nomenclature", id: itemForm.id, payload: { name: itemForm.name, nomenclatureTypeId: itemForm.nomenclatureTypeId, unitId: itemForm.unitId, isDefault: itemForm.isDefault, id1c: itemForm.id1c || null } });
    setItemForm(blankItem);
  };

  const rowActions = (target: AuditTarget, path: string, name: string) => (
    <div className="flex gap-1">
      <Button size="icon" variant="ghost" title="История" onClick={() => setAudit(target)}><History className="h-4 w-4" /></Button>
      {canEdit && <Button size="icon" variant="ghost" title="Изменить" onClick={() => {
        if (path === "/api/nomenclature-types") {
          const row = types.find((item) => item.id === target.id);
          if (row) setTypeForm({ ...row, id1c: row.id1c || "" });
        } else if (path === "/api/units-of-measure") {
          const row = units.find((item) => item.id === target.id);
          if (row) setUnitForm({ ...row, id1c: row.id1c || "", conversionFactor: row.conversionFactor || "", referenceNomenclatureId: row.referenceNomenclatureId || "" });
        } else {
          const row = items.find((item) => item.id === target.id);
          if (row) setItemForm({ id: row.id, id1c: row.id1c || "", name: row.name, nomenclatureTypeId: row.nomenclatureTypeId, unitId: row.unitId, isDefault: row.isDefault });
        }
      }}><Pencil className="h-4 w-4" /></Button>}
      {canDelete && <Button size="icon" variant="ghost" title="Удалить" onClick={() => setDeleting({ path, id: target.id, title: name })}><Trash2 className="h-4 w-4" /></Button>}
    </div>
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Номенклатура</CardTitle></CardHeader>
        <CardContent>
          {(canCreate || (canEdit && itemForm.id)) && <form className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-5" onSubmit={saveItem}>
            <Input placeholder="Наименование" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required />
            <Input placeholder="id_1C" value={itemForm.id1c} onChange={(e) => setItemForm({ ...itemForm, id1c: e.target.value })} />
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={itemForm.nomenclatureTypeId} onChange={(e) => setItemForm({ ...itemForm, nomenclatureTypeId: e.target.value })} required>
              <option value="">Вид номенклатуры</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={itemForm.unitId} onChange={(e) => setItemForm({ ...itemForm, unitId: e.target.value })} required>
              <option value="">Единица измерения</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.shortName} — {unit.fullName}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <Checkbox id="default-nomenclature" checked={itemForm.isDefault} onCheckedChange={(checked) => setItemForm({ ...itemForm, isDefault: checked === true })} />
              <label htmlFor="default-nomenclature" className="text-sm">По умолчанию</label>
              <Button type="submit" disabled={save.isPending}><Plus className="mr-1 h-4 w-4" />{itemForm.id ? "Сохранить" : "Добавить"}</Button>
              {itemForm.id && <Button type="button" variant="outline" size="icon" onClick={() => setItemForm(blankItem)}><X className="h-4 w-4" /></Button>}
            </div>
          </form>}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Вид</TableHead><TableHead>Наименование</TableHead><TableHead>Ед. изм.</TableHead><TableHead>По умолчанию</TableHead><TableHead>id_1C</TableHead><TableHead>Действия</TableHead></TableRow></TableHeader>
              <TableBody>{isLoading ? <TableRow><TableCell colSpan={6}>Загрузка…</TableCell></TableRow> : items.map((item) => (
                <TableRow key={item.id}><TableCell>{item.typeName}</TableCell><TableCell>{item.name}</TableCell><TableCell>{item.unitShortName}</TableCell><TableCell>{item.isDefault ? "Да" : "—"}</TableCell><TableCell>{item.id1c || "—"}</TableCell><TableCell>{rowActions({ entityType: "nomenclature", id: item.id, name: item.name }, "/api/nomenclature", item.name)}</TableCell></TableRow>
              ))}{!isLoading && items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Пока нет записей</TableCell></TableRow>}</TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Виды номенклатуры</CardTitle></CardHeader>
          <CardContent>
            {(canCreate || (canEdit && typeForm.id)) && <form className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3" onSubmit={saveType}>
              <Input placeholder="Код (kerosene, pvkj, service)" value={typeForm.code} onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })} required />
              <Input placeholder="Название" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} required />
              <div className="flex gap-2"><Input placeholder="id_1C" value={typeForm.id1c} onChange={(e) => setTypeForm({ ...typeForm, id1c: e.target.value })} /><Button type="submit"><Plus className="h-4 w-4" /></Button>{typeForm.id && <Button type="button" variant="outline" size="icon" onClick={() => setTypeForm(blankType)}><X className="h-4 w-4" /></Button>}</div>
            </form>}
            <Table><TableHeader><TableRow><TableHead>Код</TableHead><TableHead>Вид</TableHead><TableHead>Действия</TableHead></TableRow></TableHeader><TableBody>
              {types.map((type) => <TableRow key={type.id}><TableCell>{type.code}</TableCell><TableCell>{type.name}</TableCell><TableCell>{rowActions({ entityType: "nomenclature_types", id: type.id, name: type.name }, "/api/nomenclature-types", type.name)}</TableCell></TableRow>)}
            </TableBody></Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Единицы измерения</CardTitle></CardHeader>
          <CardContent>
            {(canCreate || (canEdit && unitForm.id)) && <form className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2" onSubmit={saveUnit}>
              <Input placeholder="Краткое наименование" value={unitForm.shortName} onChange={(e) => setUnitForm({ ...unitForm, shortName: e.target.value })} required />
              <Input placeholder="Полное наименование" value={unitForm.fullName} onChange={(e) => setUnitForm({ ...unitForm, fullName: e.target.value })} required />
              <Input placeholder="Кратность" type="number" step="0.000001" value={unitForm.conversionFactor} onChange={(e) => setUnitForm({ ...unitForm, conversionFactor: e.target.value })} />
              <select aria-label="Кратность к номенклатуре" className="h-10 rounded-md border bg-background px-3 text-sm" value={unitForm.referenceNomenclatureId} onChange={(e) => setUnitForm({ ...unitForm, referenceNomenclatureId: e.target.value })}>
                <option value="">Кратность к номенклатуре (необязательно)</option>
                {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <div className="flex gap-2"><Input placeholder="id_1C" value={unitForm.id1c} onChange={(e) => setUnitForm({ ...unitForm, id1c: e.target.value })} /><Button type="submit"><Plus className="h-4 w-4" /></Button>{unitForm.id && <Button type="button" variant="outline" size="icon" onClick={() => setUnitForm(blankUnit)}><X className="h-4 w-4" /></Button>}</div>
            </form>}
            <Table><TableHeader><TableRow><TableHead>Кратко</TableHead><TableHead>Полное название</TableHead><TableHead>Кратность</TableHead><TableHead>Действия</TableHead></TableRow></TableHeader><TableBody>
              {units.map((unit) => <TableRow key={unit.id}><TableCell>{unit.shortName}</TableCell><TableCell>{unit.fullName}</TableCell><TableCell>{unit.conversionFactor || "—"}{unit.referenceNomenclatureId ? ` → ${items.find((item) => item.id === unit.referenceNomenclatureId)?.name || "номенклатура"}` : ""}</TableCell><TableCell>{rowActions({ entityType: "units_of_measure", id: unit.id, name: unit.shortName }, "/api/units-of-measure", unit.shortName)}</TableCell></TableRow>)}
            </TableBody></Table>
          </CardContent>
        </Card>
      </div>
      <AuditPanel open={!!audit} onOpenChange={(open) => !open && setAudit(null)} entityType={audit?.entityType || ""} entityId={audit?.id} entityName={audit?.name} />
      <DeleteConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} onConfirm={() => deleting && remove.mutate({ path: deleting.path, id: deleting.id })} title={`Удалить «${deleting?.title || ""}»?`} description="Удалённую запись можно восстановить через историю аудита." />
    </div>
  );
}
