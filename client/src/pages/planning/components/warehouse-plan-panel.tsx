import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, Lock, ChevronDown, ChevronRight } from "lucide-react";
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

interface ActualsByDate {
  date: string;
  incomeActual: string;
  expenseActual: string;
  details: { sourceType: string; sourceId: string; label: string; quantity: string }[];
}

function fmtPeriod(period: PlanningPeriod) {
  return {
    dateFrom: format(period.from, "yyyy-MM-dd"),
    dateTo: format(period.to, "yyyy-MM-dd"),
  };
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
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

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
  });

  const actualsByDate = new Map(actuals.map((a) => [a.date, a]));

  const canCreate = hasPermission("planning", "create");
  const canEdit = hasPermission("planning", "edit");
  const canDelete = hasPermission("planning", "delete");

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/planning/entries", warehouseId] });
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

  const handleDeleteEntry = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/planning/entries/${id}`);
      invalidateAll();
      toast({ title: "Запись удалена" });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error?.message || "Запись заблокирована или не найдена",
        variant: "destructive",
      });
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

  const handleDeleteAllocation = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/planning/allocations/${id}`);
      queryClient.invalidateQueries({ queryKey: allocationsKey });
      queryClient.invalidateQueries({ queryKey: ["/api/planning/summary/resources"] });
      toast({ title: "Распределение удалено" });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось удалить распределение",
        variant: "destructive",
      });
    }
  };

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
                <TableHead />
                <TableHead>Дата</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Контрагент</TableHead>
                <TableHead>План (объём)</TableHead>
                <TableHead>Факт</TableHead>
                <TableHead>Остаток (план)</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingEntries ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Нет плановых записей за период
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => {
                  const dateKey = entry.date.slice(0, 10);
                  const actual = actualsByDate.get(dateKey);
                  const actualValue =
                    entry.type === "income" ? actual?.incomeActual : actual?.expenseActual;
                  const isExpanded = expandedDate === dateKey;

                  return (
                    <>
                      <TableRow key={entry.id} data-testid={`row-plan-entry-${entry.id}`}>
                        <TableCell>
                          {actual && actual.details.length > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setExpandedDate(isExpanded ? null : dateKey)}
                              data-testid={`button-expand-${entry.id}`}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(dateKey), "dd.MM.yyyy")}
                          {entry.isLocked && (
                            <Lock className="inline-block h-3 w-3 ml-1 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.type === "income" ? (
                            <Badge variant="outline">Приход</Badge>
                          ) : (
                            <Badge variant="outline">Расход</Badge>
                          )}
                        </TableCell>
                        <TableCell>{entry.counterpartyName || "—"}</TableCell>
                        <TableCell>{entry.volume}</TableCell>
                        <TableCell>{actualValue || "—"}</TableCell>
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
                                onClick: () => handleDeleteEntry(entry.id),
                                permission: { module: "planning", action: "delete" },
                                condition: !entry.isLocked,
                              },
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                      {isExpanded && actual && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30">
                            <div className="p-2 space-y-1">
                              <p className="text-sm font-medium">Детализация факта:</p>
                              {actual.details.map((d, idx) => (
                                <div
                                  key={`${d.sourceType}-${d.sourceId}-${idx}`}
                                  className="text-sm text-muted-foreground flex justify-between max-w-md"
                                  data-testid={`text-actual-detail-${entry.id}-${idx}`}
                                >
                                  <span>{d.label}</span>
                                  <span>{d.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
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
                <TableHead>Откуда</TableHead>
                <TableHead>Куда</TableHead>
                <TableHead>Объём</TableHead>
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
                allocations.map((a) => (
                  <TableRow key={a.id} data-testid={`row-allocation-${a.id}`}>
                    <TableCell>{format(new Date(a.date.slice(0, 10)), "dd.MM.yyyy")}</TableCell>
                    <TableCell>{a.fromCounterpartyId || "—"}</TableCell>
                    <TableCell>{a.toCounterpartyId || "—"}</TableCell>
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
                            onClick: () => handleDeleteAllocation(a.id),
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
    </div>
  );
}
