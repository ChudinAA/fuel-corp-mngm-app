import { useState } from "react";
import { format as dateFmt } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Pencil,
  ArrowDownToLine,
  ArrowUpFromLine,
  PlusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { fmtTons } from "../utils/planning-utils";
import { FieldCommentPopover } from "./field-comment-popover";
import type { PlanningPeriod } from "../planning-page";
import { cn } from "@/lib/utils";

interface TopLevelVolume {
  id: string;
  supplierId: string;
  warehouseId: string;
  warehouseName?: string;
  periodFrom: string;
  periodTo: string;
  type: string;
  volume: string;
  counterpartyId?: string | null;
  counterpartyName?: string | null;
  notes?: string | null;
}

interface Warehouse {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  name: string;
}

interface TopLevelResourceDetailProps {
  supplierId: string;
  supplierName: string;
  period: PlanningPeriod;
  scenarioId: string | null;
  onClose: () => void;
}

const NONE_VALUE = "__none__";

const EMPTY_FORM = {
  warehouseId: "",
  type: "income" as "income" | "expense",
  volume: "",
  counterpartyId: NONE_VALUE,
  notes: "",
};

export function TopLevelResourceDetail({
  supplierId,
  supplierName,
  period,
  scenarioId,
  onClose,
}: TopLevelResourceDetailProps) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canManage = hasPermission("planning", "allocate");

  const periodFrom = dateFmt(period.from, "yyyy-MM-dd");
  const periodTo = dateFmt(period.to, "yyyy-MM-dd");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: volumes = [], isLoading } = useQuery<TopLevelVolume[]>({
    queryKey: ["/api/planning/top-level-volumes", supplierId, periodFrom, periodTo, scenarioId],
    queryFn: async () => {
      const params = new URLSearchParams({
        supplierId,
        periodFrom,
        periodTo,
        ...(scenarioId ? { scenarioId } : {}),
      });
      return (await apiRequest("GET", `/api/planning/top-level-volumes?${params}`)).json();
    },
  });

  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ["/api/warehouses"],
    queryFn: async () => (await apiRequest("GET", "/api/warehouses")).json(),
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => (await apiRequest("GET", "/api/customers")).json(),
    enabled: form.type === "expense",
  });

  function openAdd(preset?: { warehouseId?: string; type?: "income" | "expense" }) {
    setForm({
      ...EMPTY_FORM,
      warehouseId: preset?.warehouseId ?? "",
      type: preset?.type ?? "income",
    });
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(v: TopLevelVolume) {
    setForm({
      warehouseId: v.warehouseId,
      type: v.type as "income" | "expense",
      volume: (parseFloat(v.volume) / 1000).toString(),
      counterpartyId: v.counterpartyId || NONE_VALUE,
      notes: v.notes || "",
    });
    setEditingId(v.id);
    setFormOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const volumeKg = (parseFloat(form.volume) * 1000).toString();
      const body = {
        supplierId,
        warehouseId: form.warehouseId,
        periodFrom: period.from.toISOString(),
        periodTo: period.to.toISOString(),
        type: form.type,
        volume: volumeKg,
        counterpartyId:
          form.counterpartyId && form.counterpartyId !== NONE_VALUE
            ? form.counterpartyId
            : null,
        notes: form.notes || null,
        scenarioId: scenarioId || null,
      };
      if (editingId) {
        await apiRequest("PATCH", `/api/planning/top-level-volumes/${editingId}`, body);
      } else {
        await apiRequest("POST", "/api/planning/top-level-volumes", body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/planning/top-level-volumes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/planning/summary/resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/planning/top-level-volumes/warehouse-summary"] });
      toast({ title: editingId ? "Объём обновлён" : "Объём добавлен" });
      setFormOpen(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/planning/top-level-volumes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/planning/top-level-volumes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/planning/summary/resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/planning/top-level-volumes/warehouse-summary"] });
      toast({ title: "Запись удалена" });
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  // Group by warehouse
  const byWarehouse = new Map<
    string,
    { name: string; income: TopLevelVolume[]; expense: TopLevelVolume[] }
  >();
  for (const v of volumes) {
    const key = v.warehouseId;
    if (!byWarehouse.has(key)) {
      byWarehouse.set(key, { name: v.warehouseName || "—", income: [], expense: [] });
    }
    const entry = byWarehouse.get(key)!;
    if (v.type === "income") entry.income.push(v);
    else entry.expense.push(v);
  }
  const warehouseGroups = Array.from(byWarehouse.entries());

  const totalIncome = volumes
    .filter((v) => v.type === "income")
    .reduce((s, v) => s + parseFloat(v.volume || "0"), 0);
  const totalExpense = volumes
    .filter((v) => v.type === "expense")
    .reduce((s, v) => s + parseFloat(v.volume || "0"), 0);

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-medium">{supplierName}</p>
          <p className="text-xs text-muted-foreground">Верхнеуровневое планирование</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200">
            <ArrowDownToLine className="h-3 w-3" />
            Приход: {fmtTons(totalIncome.toString())}
          </Badge>
          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200">
            <ArrowUpFromLine className="h-3 w-3" />
            Расход: {fmtTons(totalExpense.toString())}
          </Badge>
          {canManage && (
            <Button size="sm" onClick={() => openAdd()} data-testid="button-add-top-level-volume">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Добавить
            </Button>
          )}
        </div>
      </div>

      {/* Warehouse panels */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-2">Загрузка...</p>
      ) : warehouseGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-2">
          Нет верхнеуровневых записей. Нажмите «Добавить» чтобы начать.
        </p>
      ) : (
        <div className="space-y-2">
          {warehouseGroups.map(([whId, whData]) => {
            const whIncome = whData.income.reduce(
              (s, v) => s + parseFloat(v.volume || "0"),
              0,
            );
            const whExpense = whData.expense.reduce(
              (s, v) => s + parseFloat(v.volume || "0"),
              0,
            );
            return (
              <div key={whId} className="border rounded-md overflow-hidden">
                {/* Warehouse name header */}
                <div className="px-3 py-1.5 bg-muted/30 border-b flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{whData.name}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {whIncome > 0 && (
                      <span className="text-emerald-600 font-medium">
                        ↓ {fmtTons(whIncome.toString())}
                      </span>
                    )}
                    {whExpense > 0 && (
                      <span className="text-amber-600 font-medium">
                        ↑ {fmtTons(whExpense.toString())}
                      </span>
                    )}
                  </div>
                </div>

                {/* Two-column plan grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
                  {/* Поступления */}
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                        <ArrowDownToLine className="h-3 w-3 text-emerald-500" />
                        Поступления
                        {whIncome > 0 && (
                          <span className="ml-1 text-emerald-600 font-semibold tabular-nums">
                            {fmtTons(whIncome.toString())}
                          </span>
                        )}
                      </div>
                      {canManage && (
                        <button
                          className="text-emerald-500 hover:text-emerald-700 transition-colors"
                          title="Быстрое добавление поступления"
                          onClick={() => openAdd({ warehouseId: whId, type: "income" })}
                          data-testid={`button-quick-add-income-${whId}`}
                        >
                          <PlusCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {whData.income.length > 0 ? (
                      whData.income.map((v) => (
                        <VolumeEntry
                          key={v.id}
                          entry={v}
                          canManage={canManage}
                          onEdit={() => openEdit(v)}
                          onDelete={() => setDeleteId(v.id)}
                        />
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground/50 italic">—</p>
                    )}
                  </div>

                  {/* Расходы */}
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                        <ArrowUpFromLine className="h-3 w-3 text-amber-500" />
                        Расходы
                        {whExpense > 0 && (
                          <span className="ml-1 text-amber-600 font-semibold tabular-nums">
                            {fmtTons(whExpense.toString())}
                          </span>
                        )}
                      </div>
                      {canManage && (
                        <button
                          className="text-amber-500 hover:text-amber-700 transition-colors"
                          title="Быстрое добавление расхода"
                          onClick={() => openAdd({ warehouseId: whId, type: "expense" })}
                          data-testid={`button-quick-add-expense-${whId}`}
                        >
                          <PlusCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {whData.expense.length > 0 ? (
                      whData.expense.map((v) => (
                        <VolumeEntry
                          key={v.id}
                          entry={v}
                          canManage={canManage}
                          onEdit={() => openEdit(v)}
                          onDelete={() => setDeleteId(v.id)}
                        />
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground/50 italic">—</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditingId(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Редактировать объём" : "Добавить верхнеуровневый объём"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Склад</Label>
              <Select
                value={form.warehouseId}
                onValueChange={(v) => setForm((f) => ({ ...f, warehouseId: v }))}
              >
                <SelectTrigger data-testid="select-top-level-warehouse">
                  <SelectValue placeholder="Выберите склад" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Тип</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    type: v as "income" | "expense",
                    counterpartyId: NONE_VALUE,
                  }))
                }
              >
                <SelectTrigger data-testid="select-top-level-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Приход</SelectItem>
                  <SelectItem value="expense">Расход</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type === "expense" && (
              <div className="space-y-1">
                <Label>
                  Клиент{" "}
                  <span className="text-muted-foreground text-xs">(опционально)</span>
                </Label>
                <Select
                  value={form.counterpartyId}
                  onValueChange={(v) => setForm((f) => ({ ...f, counterpartyId: v }))}
                >
                  <SelectTrigger data-testid="select-top-level-customer">
                    <SelectValue placeholder="Выберите клиента" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>— Не указан —</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Объём (т)</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={form.volume}
                onChange={(e) => setForm((f) => ({ ...f, volume: e.target.value }))}
                placeholder="0.000"
                data-testid="input-top-level-volume"
              />
            </div>
            <div className="space-y-1">
              <Label>
                Заметки{" "}
                <span className="text-muted-foreground text-xs">(опционально)</span>
              </Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Комментарий..."
                className="resize-none text-sm"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.warehouseId || !form.volume || saveMutation.isPending}
              data-testid="button-confirm-top-level-volume"
            >
              {saveMutation.isPending
                ? "Сохранение..."
                : editingId
                  ? "Сохранить"
                  : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
            <AlertDialogDescription>
              Верхнеуровневый объём будет удалён.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VolumeEntry({
  entry,
  canManage,
  onEdit,
  onDelete,
}: {
  entry: TopLevelVolume;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isIncome = entry.type === "income";
  return (
    <div className="flex items-start gap-1.5 text-sm py-0.5">
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "font-semibold tabular-nums text-xs",
            isIncome ? "text-emerald-600" : "text-amber-600",
          )}
        >
          {isIncome ? "+" : "−"}{fmtTons(entry.volume)}
        </span>
        {entry.counterpartyName && (
          <span className="ml-1.5 text-xs text-muted-foreground truncate">
            {entry.counterpartyName}
          </span>
        )}
        {entry.notes && (
          <span className="ml-1.5 text-xs text-muted-foreground/60 italic truncate">
            {entry.notes}
          </span>
        )}
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <FieldCommentPopover
          entityType="top_level_volume"
          entityId={entry.id}
          fieldKey="volume"
        />
        {canManage && (
          <>
            <button
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
              onClick={onEdit}
              title="Редактировать"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
              onClick={onDelete}
              title="Удалить"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
