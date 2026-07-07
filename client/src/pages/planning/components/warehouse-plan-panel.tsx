import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, Lock, List } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { EntityActionsMenu } from "@/components/entity-actions-menu";
import type { PlanningPeriod } from "../planning-page";
import { PlanEntryDialog, type PlanEntryFormEntry } from "./plan-entry-dialog";
import { AllocationDialog, type AllocationFormEntry } from "./allocation-dialog";

interface PlanEntryRow extends PlanEntryFormEntry {
  balanceAfter: string | null;
  counterpartyName?: string | null;
  isLocked: boolean;
}

interface ActualDetailItem {
  sourceType: string;
  sourceId: string;
  label: string;
  quantity: string;
  date: string;
}

interface ActualsByDate {
  date: string;
  incomeActual: string;
  expenseActual: string;
  details: ActualDetailItem[];
}

function fmtPeriod(period: PlanningPeriod) {
  return {
    dateFrom: format(period.from, "yyyy-MM-dd"),
    dateTo: format(period.to, "yyyy-MM-dd"),
  };
}

function ActualsModal({
  open,
  onClose,
  date,
  actual,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  actual: ActualsByDate | undefined;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent data-testid="dialog-actuals">
        <DialogHeader>
          <DialogTitle>
            Факт за {format(new Date(date + "T00:00:00"), "dd.MM.yyyy")}
          </DialogTitle>
        </DialogHeader>
        {!actual || actual.details.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет фактических данных за этот день</p>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-4 text-sm">
              <span>
                Приход: <strong>{actual.incomeActual || "0"}</strong>
              </span>
              <span>
                Расход: <strong>{actual.expenseActual || "0"}</strong>
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Детализация</p>
              {actual.details.map((d, idx) => (
                <div
                  key={`${d.sourceType}-${d.sourceId}-${idx}`}
                  className="flex justify-between text-sm border-b pb-1"
                  data-testid={`text-actual-detail-${idx}`}
                >
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-medium">{d.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function WarehousePlanPanel({
  warehouseId,
  period,
}: {
  warehouseId: string;
  period: PlanningPeriod;
}) {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const { dateFrom, dateTo } = fmtPeriod(period);

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PlanEntryRow | null>(null);
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<AllocationFormEntry | null>(null);

  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [deleteAllocationId, setDeleteAllocationId] = useState<string | null>(null);

  const [actualsModalDate, setActualsModalDate] = useState<string | null>(null);

  const entriesKey = ["/api/planning/entries", warehouseId, dateFrom, dateTo];
  const allocationsKey = ["/api/planning/allocations", warehouseId, dateFrom, dateTo];
  const actualsKey = ["/api/planning/actuals", warehouseId, dateFrom, dateTo];

  const { data: entries = [], isLoading: loadingEntries } = useQuery<PlanEntryRow[]>({
    queryKey: entriesKey,
    queryFn: async () =>
      (
        await apiRequest(
          "GET",
          `/api/planning/entries?warehouseId=${warehouseId}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
        )
      ).json(),
  });

  const { data: allocations = [], isLoading: loadingAllocations } = useQuery<
    AllocationFormEntry[]
  >({
    queryKey: allocationsKey,
    queryFn: async () =>
      (
        await apiRequest(
          "GET",
          `/api/planning/allocations?warehouseId=${warehouseId}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
        )
      ).json(),
  });

  const { data: actuals = [] } = useQuery<ActualsByDate[]>({
    queryKey: actualsKey,
    queryFn: async () =>
      (
        await apiRequest(
          "GET",
          `/api/planning/actuals?warehouseId=${warehouseId}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
        )
      ).json(),
    refetchInterval: 30_000,
  });

  const actualsByDate = new Map(actuals.map((a) => [a.date, a]));

  const canCreate = hasPermission("planning", "create");
  const canEdit = hasPermission("planning", "edit");
  const canDelete = hasPermission("planning", "delete");

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/planning/entries", warehouseId] });
    queryClient.invalidateQueries({ queryKey: ["/api/planning/actuals", warehouseId] });
    queryClient.invalidateQueries({ queryKey: ["/api/planning/summary/resources"] });
    queryClient.invalidateQueries({ queryKey: ["/api/planning/summary/warehouses"] });
    queryClient.invalidateQueries({ queryKey: ["/api/planning/summary/customers"] });
  };

  const handleEntrySubmit = async (values: any) => {
    try {
      if (editingEntry) {
        await apiRequest("PATCH", `/api/planning/entries/${editingEntry.id}`, {
          ...values,
          balanceAfter: values.isManualBalance ? values.balanceAfter : null,
        });
      } else {
        await apiRequest("POST", "/api/planning/entries", {
          ...values,
          warehouseId,
          balanceAfter: values.isManualBalance ? values.balanceAfter : null,
        });
      }
      invalidateAll();
      toast({ title: "Запись сохранена" });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось сохранить запись",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleDeleteEntry = async () => {
    if (!deleteEntryId) return;
    try {
      await apiRequest("DELETE", `/api/planning/entries/${deleteEntryId}`);
      invalidateAll();
      toast({ title: "Запись удалена" });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error?.message || "Запись заблокирована или не найдена",
        variant: "destructive",
      });
    } finally {
      setDeleteEntryId(null);
    }
  };

  const handleAllocationSubmit = async (values: any) => {
    try {
      if (editingAllocation) {
        await apiRequest("PATCH", `/api/planning/allocations/${editingAllocation.id}`, values);
      } else {
        await apiRequest("POST", "/api/planning/allocations", { ...values, warehouseId });
      }
      queryClient.invalidateQueries({ queryKey: allocationsKey });
      queryClient.invalidateQueries({ queryKey: ["/api/planning/summary/resources"] });
      toast({ title: "Распределение сохранено" });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось сохранить распределение",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleDeleteAllocation = async () => {
    if (!deleteAllocationId) return;
    try {
      await apiRequest("DELETE", `/api/planning/allocations/${deleteAllocationId}`);
      queryClient.invalidateQueries({ queryKey: allocationsKey });
      queryClient.invalidateQueries({ queryKey: ["/api/planning/summary/resources"] });
      toast({ title: "Распределение удалено" });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось удалить распределение",
        variant: "destructive",
      });
    } finally {
      setDeleteAllocationId(null);
    }
  };

  const actualsForModal = actualsModalDate ? actualsByDate.get(actualsModalDate) : undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle>План / Факт</CardTitle>
          {canCreate && (
            <Button
              size="sm"
              onClick={() => {
                setEditingEntry(null);
                setEntryDialogOpen(true);
              }}
              data-testid="button-add-plan-entry"
            >
              <Plus className="h-4 w-4 mr-1" />
              Добавить запись
            </Button>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Контрагент</TableHead>
                <TableHead>План (кг)</TableHead>
                <TableHead>Факт (кг)</TableHead>
                <TableHead>Остаток (план)</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingEntries ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Нет плановых записей за период
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => {
                  const dateKey = entry.date.slice(0, 10);
                  const actual = actualsByDate.get(dateKey);
                  const actualValue =
                    entry.type === "income" ? actual?.incomeActual : actual?.expenseActual;
                  const hasDetails = actual && actual.details.length > 0;

                  const planNum = parseFloat(entry.volume) || 0;
                  const factNum = parseFloat(actualValue || "0") || 0;
                  const diff = factNum - planNum;

                  return (
                    <TableRow key={entry.id} data-testid={`row-plan-entry-${entry.id}`}>
                      <TableCell>
                        <span>
                          {format(new Date(dateKey + "T00:00:00"), "dd.MM.yyyy")}
                        </span>
                        {entry.isLocked && (
                          <Lock className="inline-block h-3 w-3 ml-1 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.type === "income" ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                            Приход
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-200">
                            Расход
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{entry.counterpartyName || "—"}</TableCell>
                      <TableCell>{entry.volume}</TableCell>
                      <TableCell>
                        {actualValue ? (
                          <button
                            onClick={() => setActualsModalDate(dateKey)}
                            className="flex items-center gap-1 text-left hover:underline"
                            data-testid={`button-show-actuals-${entry.id}`}
                          >
                            <span
                              className={
                                diff >= 0 ? "text-emerald-600" : "text-destructive"
                              }
                            >
                              {actualValue}
                            </span>
                            {hasDetails && (
                              <List className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{entry.balanceAfter || "—"}</TableCell>
                      <TableCell>
                        <EntityActionsMenu
                          actions={[
                            {
                              id: "edit",
                              label: "Редактировать",
                              icon: Pencil,
                              onClick: () => {
                                setEditingEntry(entry);
                                setEntryDialogOpen(true);
                              },
                              permission: { module: "planning", action: "edit" },
                              condition: !entry.isLocked,
                            },
                            {
                              id: "delete",
                              label: "Удалить",
                              icon: Trash2,
                              variant: "destructive",
                              onClick: () => setDeleteEntryId(entry.id),
                              permission: { module: "planning", action: "delete" },
                              condition: !entry.isLocked,
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle>Распределение свободных объёмов</CardTitle>
          {canCreate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingAllocation(null);
                setAllocationDialogOpen(true);
              }}
              data-testid="button-add-allocation"
            >
              <Plus className="h-4 w-4 mr-1" />
              Добавить распределение
            </Button>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Откуда (поставщик)</TableHead>
                <TableHead>Куда (клиент)</TableHead>
                <TableHead>Объём (кг)</TableHead>
                <TableHead>Примечание</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingAllocations ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : allocations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Нет распределений за период
                  </TableCell>
                </TableRow>
              ) : (
                allocations.map((a: any) => (
                  <TableRow key={a.id} data-testid={`row-allocation-${a.id}`}>
                    <TableCell>
                      {format(new Date(a.date.slice(0, 10) + "T00:00:00"), "dd.MM.yyyy")}
                    </TableCell>
                    <TableCell>{a.fromName || a.fromCounterpartyId || "—"}</TableCell>
                    <TableCell>{a.toName || a.toCounterpartyId || "—"}</TableCell>
                    <TableCell>{a.volume}</TableCell>
                    <TableCell>{a.notes || "—"}</TableCell>
                    <TableCell>
                      <EntityActionsMenu
                        actions={[
                          {
                            id: "edit",
                            label: "Редактировать",
                            icon: Pencil,
                            onClick: () => {
                              setEditingAllocation(a);
                              setAllocationDialogOpen(true);
                            },
                            permission: { module: "planning", action: "edit" },
                          },
                          {
                            id: "delete",
                            label: "Удалить",
                            icon: Trash2,
                            variant: "destructive",
                            onClick: () => setDeleteAllocationId(a.id),
                            permission: { module: "planning", action: "delete" },
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PlanEntryDialog
        open={entryDialogOpen}
        onOpenChange={setEntryDialogOpen}
        warehouseId={warehouseId}
        entry={editingEntry}
        onSubmit={handleEntrySubmit}
      />

      <AllocationDialog
        open={allocationDialogOpen}
        onOpenChange={setAllocationDialogOpen}
        entry={editingAllocation}
        onSubmit={handleAllocationSubmit}
      />

      <AlertDialog open={!!deleteEntryId} onOpenChange={(o) => !o && setDeleteEntryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запись плана?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Запись будет удалена безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEntry}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-entry"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteAllocationId}
        onOpenChange={(o) => !o && setDeleteAllocationId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить распределение?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllocation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-allocation"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {actualsModalDate && (
        <ActualsModal
          open={!!actualsModalDate}
          onClose={() => setActualsModalDate(null)}
          date={actualsModalDate}
          actual={actualsForModal}
        />
      )}
    </div>
  );
}
