import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, TrendingDown, TrendingUp, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

const EMPTY_FORM = {
  warehouseId: "",
  type: "income" as "income" | "expense",
  volume: "",
  counterpartyId: "",
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

  const periodFrom = format(period.from, "yyyy-MM-dd");
  const periodTo = format(period.to, "yyyy-MM-dd");

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

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(v: TopLevelVolume) {
    setForm({
      warehouseId: v.warehouseId,
      type: v.type as "income" | "expense",
      volume: (parseFloat(v.volume) / 1000).toString(),
      counterpartyId: v.counterpartyId || "",
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
        counterpartyId: form.counterpartyId || null,
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

  const totalIncome = volumes.filter((v) => v.type === "income").reduce((s, v) => s + parseFloat(v.volume || "0"), 0);
  const totalExpense = volumes.filter((v) => v.type === "expense").reduce((s, v) => s + parseFloat(v.volume || "0"), 0);

  // Group by warehouse for side-by-side view
  const byWarehouse = new Map<string, { name: string; income: TopLevelVolume[]; expense: TopLevelVolume[] }>();
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-medium">{supplierName}</p>
          <p className="text-xs text-muted-foreground">Верхнеуровневое планирование</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-emerald-600">
            <TrendingDown className="h-3 w-3" />
            Приход: {fmtTons(totalIncome.toFixed(2))} т
          </Badge>
          <Badge variant="outline" className="gap-1 text-amber-600">
            <TrendingUp className="h-3 w-3" />
            Расход: {fmtTons(totalExpense.toFixed(2))} т
          </Badge>
          {canManage && (
            <Button size="sm" onClick={openAdd} data-testid="button-add-top-level-volume">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Добавить
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Склад</TableHead>
              <TableHead className="text-emerald-700 dark:text-emerald-400">Поступления</TableHead>
              <TableHead className="text-amber-700 dark:text-amber-400">Расходы</TableHead>
              {canManage && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : warehouseGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                  Нет верхнеуровневых записей. Нажмите «Добавить» чтобы начать.
                </TableCell>
              </TableRow>
            ) : (
              warehouseGroups.map(([whId, whData]) => {
                const maxRows = Math.max(whData.income.length, whData.expense.length, 1);
                return Array.from({ length: maxRows }, (_, i) => {
                  const incomeEntry = whData.income[i];
                  const expenseEntry = whData.expense[i];
                  return (
                    <TableRow key={`${whId}-${i}`}>
                      {i === 0 ? (
                        <TableCell className="font-medium align-top" rowSpan={maxRows}>
                          {whData.name}
                        </TableCell>
                      ) : null}
                      <TableCell className="align-top">
                        {incomeEntry ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-600 tabular-nums">
                              +{fmtTons(incomeEntry.volume)} т
                            </span>
                            {incomeEntry.counterpartyName && (
                              <span className="text-xs text-muted-foreground">({incomeEntry.counterpartyName})</span>
                            )}
                            <FieldCommentPopover
                              entityType="top_level_volume"
                              entityId={incomeEntry.id}
                              fieldKey="volume"
                            />
                            {canManage && (
                              <>
                                <button
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                  onClick={() => openEdit(incomeEntry)}
                                  title="Редактировать"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                  onClick={() => setDeleteId(incomeEntry.id)}
                                  title="Удалить"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </div>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="align-top">
                        {expenseEntry ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-600 tabular-nums">
                              -{fmtTons(expenseEntry.volume)} т
                            </span>
                            {expenseEntry.counterpartyName && (
                              <span className="text-xs text-muted-foreground">({expenseEntry.counterpartyName})</span>
                            )}
                            <FieldCommentPopover
                              entityType="top_level_volume"
                              entityId={expenseEntry.id}
                              fieldKey="volume"
                            />
                            {canManage && (
                              <>
                                <button
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                  onClick={() => openEdit(expenseEntry)}
                                  title="Редактировать"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                  onClick={() => setDeleteId(expenseEntry.id)}
                                  title="Удалить"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </div>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      {canManage && <TableCell />}
                    </TableRow>
                  );
                });
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditingId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Редактировать объём" : "Добавить верхнеуровневый объём"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Склад</Label>
              <Select value={form.warehouseId} onValueChange={(v) => setForm((f) => ({ ...f, warehouseId: v }))}>
                <SelectTrigger data-testid="select-top-level-warehouse">
                  <SelectValue placeholder="Выберите склад" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Тип</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as "income" | "expense", counterpartyId: "" }))}>
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
                <Label>Клиент <span className="text-muted-foreground text-xs">(опционально)</span></Label>
                <Select value={form.counterpartyId} onValueChange={(v) => setForm((f) => ({ ...f, counterpartyId: v }))}>
                  <SelectTrigger data-testid="select-top-level-customer">
                    <SelectValue placeholder="Выберите клиента" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Не указан —</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
              <Label>Заметки <span className="text-muted-foreground text-xs">(опционально)</span></Label>
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
            <Button variant="outline" onClick={() => setFormOpen(false)}>Отмена</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.warehouseId || !form.volume || saveMutation.isPending}
              data-testid="button-confirm-top-level-volume"
            >
              {saveMutation.isPending ? "Сохранение..." : editingId ? "Сохранить" : "Добавить"}
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
