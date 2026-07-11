import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Plus,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  History,
} from "lucide-react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { AuditPanel } from "@/components/audit-panel";
import type { PlanningPeriod } from "../planning-page";
import { PlanEntryDialog, type PlanEntryFormEntry } from "./plan-entry-dialog";
import { AllocationDialog, type AllocationFormEntry } from "./allocation-dialog";
import { FieldCommentPopover } from "./field-comment-popover";
import { fmtTons } from "../utils/planning-utils";
import { cn } from "@/lib/utils";

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

interface DateRow {
  date: string;
  incomeEntries: PlanEntryRow[];
  expenseEntries: PlanEntryRow[];
  actual: ActualsByDate | undefined;
  lastBalanceAfter: string | null;
}

function fmtPeriod(period: PlanningPeriod) {
  return {
    dateFrom: format(period.from, "yyyy-MM-dd"),
    dateTo: format(period.to, "yyyy-MM-dd"),
  };
}

function fmtDate(dateStr: string) {
  return format(new Date(dateStr + "T00:00:00"), "dd.MM.yyyy");
}

function isCurrentMonth(dateStr: string): boolean {
  const now = new Date();
  const d = new Date(dateStr + "T00:00:00");
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function isPastMonth(dateStr: string): boolean {
  const now = new Date();
  const d = new Date(dateStr + "T00:00:00");
  const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const entryMonthStart = new Date(d.getFullYear(), d.getMonth(), 1);
  return entryMonthStart.getTime() < curMonthStart.getTime();
}

function CounterpartyList({
  entries,
  label,
  colorClass,
  maxVisible = 2,
}: {
  entries: PlanEntryRow[];
  label: string;
  colorClass: string;
  maxVisible?: number;
}) {
  if (entries.length === 0) return null;
  const visible = entries.slice(0, maxVisible);
  const rest = entries.length - maxVisible;
  const names = entries.map((e) => e.counterpartyName || "—").join(", ");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("text-xs", colorClass)}>
            {label}:{" "}
            {visible.map((e) => e.counterpartyName || "—").join(", ")}
            {rest > 0 && <span className="text-muted-foreground"> +{rest}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-sm">{names}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
  const { hasPermission, isAdmin } = useAuth();
  const { dateFrom, dateTo } = fmtPeriod(period);

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PlanEntryRow | null>(null);
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<AllocationFormEntry | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [deleteAllocationId, setDeleteAllocationId] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [auditEntry, setAuditEntry] = useState<{ id: string; label: string } | null>(null);
  const [auditAllocation, setAuditAllocation] = useState<{ id: string; label: string } | null>(null);

  const entriesKey = ["/api/planning/entries", warehouseId, dateFrom, dateTo];
  const allocationsKey = ["/api/planning/allocations", warehouseId, dateFrom, dateTo];
  const actualsKey = ["/api/planning/actuals", warehouseId, dateFrom, dateTo];
  const settingsKey = ["/api/planning/settings"];

  const { data: entries = [], isLoading: loadingEntries } = useQuery<PlanEntryRow[]>({
    queryKey: entriesKey,
    queryFn: async () =>
      (await apiRequest("GET", `/api/planning/entries?warehouseId=${warehouseId}&dateFrom=${dateFrom}&dateTo=${dateTo}`)).json(),
  });

  const { data: allocations = [], isLoading: loadingAllocations } = useQuery<AllocationFormEntry[]>({
    queryKey: allocationsKey,
    queryFn: async () =>
      (await apiRequest("GET", `/api/planning/allocations?warehouseId=${warehouseId}&dateFrom=${dateFrom}&dateTo=${dateTo}`)).json(),
  });

  const { data: actuals = [] } = useQuery<ActualsByDate[]>({
    queryKey: actualsKey,
    queryFn: async () =>
      (await apiRequest("GET", `/api/planning/actuals?warehouseId=${warehouseId}&dateFrom=${dateFrom}&dateTo=${dateTo}`)).json(),
    refetchInterval: 30_000,
  });

  const { data: settings = {} } = useQuery<Record<string, string>>({
    queryKey: settingsKey,
    queryFn: async () => (await apiRequest("GET", "/api/planning/settings")).json(),
  });

  const lockEnabled = settings["editLockEnabled"] === "true";

  const canCreate = hasPermission("planning", "create");
  const canEdit = hasPermission("planning", "edit");
  const canDelete = hasPermission("planning", "delete");

  const actualsByDate = new Map(actuals.map((a) => [a.date, a]));

  // Build date-grouped rows merging plan entries + actuals
  const allDates = new Set<string>();
  entries.forEach((e) => allDates.add(e.date.slice(0, 10)));
  actuals.forEach((a) => allDates.add(a.date));

  const dateRows: DateRow[] = Array.from(allDates)
    .sort()
    .map((date) => {
      const dayEntries = entries.filter((e) => e.date.slice(0, 10) === date);
      const incomeEntries = dayEntries.filter((e) => e.type === "income");
      const expenseEntries = dayEntries.filter((e) => e.type === "expense");
      const actual = actualsByDate.get(date);
      const lastEntry = dayEntries[dayEntries.length - 1];
      return {
        date,
        incomeEntries,
        expenseEntries,
        actual,
        lastBalanceAfter: lastEntry?.balanceAfter || null,
      };
    });

  // Summary totals
  const totalIncomeKg = entries
    .filter((e) => e.type === "income")
    .reduce((s, e) => s + parseFloat(e.volume || "0"), 0);
  const totalExpenseKg = entries
    .filter((e) => e.type === "expense")
    .reduce((s, e) => s + parseFloat(e.volume || "0"), 0);
  const totalActualIncomeKg = actuals.reduce((s, a) => s + parseFloat(a.incomeActual || "0"), 0);
  const totalActualExpenseKg = actuals.reduce((s, a) => s + parseFloat(a.expenseActual || "0"), 0);

  const defaultDate = format(period.from, "yyyy-MM-dd");

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
        await apiRequest("PATCH", `/api/planning/entries/${editingEntry.id}`, values);
      } else {
        await apiRequest("POST", "/api/planning/entries", { ...values, warehouseId });
      }
      invalidateAll();
      toast({ title: "Запись сохранена" });
    } catch (error: any) {
      toast({ title: "Ошибка", description: error?.message || "Не удалось сохранить запись", variant: "destructive" });
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
      toast({ title: "Ошибка", description: error?.message || "Запись заблокирована или не найдена", variant: "destructive" });
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
      toast({ title: "Ошибка", description: error?.message || "Не удалось сохранить распределение", variant: "destructive" });
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
      toast({ title: "Ошибка", description: error?.message || "Не удалось удалить распределение", variant: "destructive" });
    } finally {
      setDeleteAllocationId(null);
    }
  };

  const toggleLock = async () => {
    const newVal = lockEnabled ? "false" : "true";
    try {
      await apiRequest("PATCH", "/api/planning/settings", { key: "editLockEnabled", value: newVal });
      queryClient.invalidateQueries({ queryKey: settingsKey });
      toast({ title: lockEnabled ? "Блокировка снята" : "Блокировка включена" });
    } catch {
      toast({ title: "Ошибка сохранения настройки", variant: "destructive" });
    }
  };

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const toggleAllDates = () => {
    if (allExpanded) {
      setExpandedDates(new Set());
      setAllExpanded(false);
    } else {
      setExpandedDates(new Set(dateRows.map((r) => r.date)));
      setAllExpanded(true);
    }
  };

  const isEntryEditable = (entry: PlanEntryRow): boolean => {
    if (!lockEnabled) return true;
    return !isPastMonth(entry.date.slice(0, 10));
  };

  return (
    <div className="space-y-4">
      {/* Plan/Fact table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle>План / Факт</CardTitle>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={toggleLock}
                      data-testid="button-toggle-lock"
                    >
                      {lockEnabled ? (
                        <Lock className="h-4 w-4 text-destructive" />
                      ) : (
                        <Unlock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {lockEnabled
                      ? "Редактирование прошлых месяцев заблокировано (нажмите чтобы снять)"
                      : "Редактирование прошлых месяцев разрешено (нажмите чтобы заблокировать)"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
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
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={toggleAllDates}
                    className="h-6 w-6"
                    title={allExpanded ? "Свернуть все" : "Развернуть все"}
                    data-testid="button-toggle-all-rows"
                  >
                    {allExpanded ? (
                      <ChevronsDownUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Приход план (т)</TableHead>
                <TableHead>Расход план (т)</TableHead>
                <TableHead>Факт прих (т)</TableHead>
                <TableHead>Факт расх (т)</TableHead>
                <TableHead>Остаток план (т)</TableHead>
                <TableHead>Контрагенты</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingEntries ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : dateRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Нет данных за период
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {dateRows.map((row) => {
                    const isExpanded = expandedDates.has(row.date);
                    const incomeKg = row.incomeEntries.reduce((s, e) => s + parseFloat(e.volume || "0"), 0);
                    const expenseKg = row.expenseEntries.reduce((s, e) => s + parseFloat(e.volume || "0"), 0);
                    const factIncomeKg = parseFloat(row.actual?.incomeActual || "0");
                    const factExpenseKg = parseFloat(row.actual?.expenseActual || "0");
                    const past = isPastMonth(row.date);
                    const current = isCurrentMonth(row.date);

                    return [
                      // Summary row for date
                      <TableRow
                        key={`summary-${row.date}`}
                        className={cn(
                          "cursor-pointer hover-elevate",
                          past && lockEnabled && "opacity-70",
                        )}
                        onClick={() => toggleDate(row.date)}
                        data-testid={`row-date-${row.date}`}
                      >
                        <TableCell className="py-2">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium py-2">
                          <span>{fmtDate(row.date)}</span>
                          {past && lockEnabled && (
                            <Lock className="inline-block h-3 w-3 ml-1 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          {incomeKg > 0 ? (
                            <div className="flex items-center gap-1">
                              <span className="text-emerald-600 font-medium">{fmtTons(incomeKg)}</span>
                              <FieldCommentPopover
                                entityType="plan_date_income"
                                entityId={warehouseId}
                                fieldKey={`income_${row.date}`}
                              />
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          {expenseKg > 0 ? (
                            <div className="flex items-center gap-1">
                              <span className="text-amber-600 font-medium">{fmtTons(expenseKg)}</span>
                              <FieldCommentPopover
                                entityType="plan_date_expense"
                                entityId={warehouseId}
                                fieldKey={`expense_${row.date}`}
                              />
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          {factIncomeKg > 0 ? (
                            <div className="flex items-center gap-1">
                              <span className="text-emerald-500">{fmtTons(factIncomeKg)}</span>
                              <FieldCommentPopover
                                entityType="plan_date_fact_income"
                                entityId={warehouseId}
                                fieldKey={`fact_income_${row.date}`}
                              />
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          {factExpenseKg > 0 ? (
                            <div className="flex items-center gap-1">
                              <span className="text-amber-500">{fmtTons(factExpenseKg)}</span>
                              <FieldCommentPopover
                                entityType="plan_date_fact_expense"
                                entityId={warehouseId}
                                fieldKey={`fact_expense_${row.date}`}
                              />
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          {row.lastBalanceAfter ? (
                            <span className="text-sm">{fmtTons(row.lastBalanceAfter)}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="space-y-0.5">
                            <CounterpartyList
                              entries={row.incomeEntries}
                              label="Приход"
                              colorClass="text-emerald-600"
                            />
                            <CounterpartyList
                              entries={row.expenseEntries}
                              label="Расход"
                              colorClass="text-amber-600"
                            />
                          </div>
                        </TableCell>
                      </TableRow>,

                      // Detail rows when expanded
                      ...(isExpanded
                        ? [
                            ...row.incomeEntries.map((entry) => (
                              <TableRow
                                key={`detail-${entry.id}`}
                                className="bg-muted/30"
                                data-testid={`row-plan-entry-${entry.id}`}
                              >
                                <TableCell />
                                <TableCell className="pl-8 py-1.5">
                                  <Badge variant="outline" className="text-emerald-600 border-emerald-200 text-xs">
                                    Приход
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <div className="flex items-center gap-1">
                                    <span className="text-emerald-600">{fmtTons(entry.volume)}</span>
                                    <FieldCommentPopover
                                      entityType="plan_entry"
                                      entityId={entry.id}
                                      fieldKey="volume"
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="py-1.5" />
                                <TableCell className="py-1.5">
                                  {row.actual?.incomeActual && parseFloat(row.actual.incomeActual) > 0 ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-emerald-500 text-xs">{fmtTons(row.actual.incomeActual)}</span>
                                      <FieldCommentPopover
                                        entityType="plan_entry_fact"
                                        entityId={entry.id}
                                        fieldKey="factIncome"
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-1.5" />
                                <TableCell className="py-1.5">
                                  {entry.balanceAfter ? (
                                    <span className="text-xs text-muted-foreground">{fmtTons(entry.balanceAfter)}</span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">{entry.counterpartyName || "—"}</span>
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
                                          condition: isEntryEditable(entry),
                                        },
                                        {
                                          id: "delete",
                                          label: "Удалить",
                                          icon: Trash2,
                                          variant: "destructive",
                                          onClick: () => setDeleteEntryId(entry.id),
                                          permission: { module: "planning", action: "delete" },
                                          condition: isEntryEditable(entry),
                                        },
                                        {
                                          id: "history",
                                          label: "История изменений",
                                          icon: History,
                                          onClick: () =>
                                            setAuditEntry({
                                              id: entry.id,
                                              label: `Приход ${fmtDate(entry.date.slice(0, 10))} ${entry.counterpartyName || ""}`,
                                            }),
                                        },
                                      ]}
                                    />
                                  </div>
                                </TableCell>
                              </TableRow>
                            )),
                            ...row.expenseEntries.map((entry) => (
                              <TableRow
                                key={`detail-${entry.id}`}
                                className="bg-muted/30"
                                data-testid={`row-plan-entry-${entry.id}`}
                              >
                                <TableCell />
                                <TableCell className="pl-8 py-1.5">
                                  <Badge variant="outline" className="text-amber-600 border-amber-200 text-xs">
                                    Расход
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-1.5" />
                                <TableCell className="py-1.5">
                                  <div className="flex items-center gap-1">
                                    <span className="text-amber-600">{fmtTons(entry.volume)}</span>
                                    <FieldCommentPopover
                                      entityType="plan_entry"
                                      entityId={entry.id}
                                      fieldKey="volume"
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="py-1.5" />
                                <TableCell className="py-1.5">
                                  {row.actual?.expenseActual && parseFloat(row.actual.expenseActual) > 0 ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-amber-500 text-xs">{fmtTons(row.actual.expenseActual)}</span>
                                      <FieldCommentPopover
                                        entityType="plan_entry_fact"
                                        entityId={entry.id}
                                        fieldKey="factExpense"
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-1.5">
                                  {entry.balanceAfter ? (
                                    <span className="text-xs text-muted-foreground">{fmtTons(entry.balanceAfter)}</span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">{entry.counterpartyName || "—"}</span>
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
                                          condition: isEntryEditable(entry),
                                        },
                                        {
                                          id: "delete",
                                          label: "Удалить",
                                          icon: Trash2,
                                          variant: "destructive",
                                          onClick: () => setDeleteEntryId(entry.id),
                                          permission: { module: "planning", action: "delete" },
                                          condition: isEntryEditable(entry),
                                        },
                                        {
                                          id: "history",
                                          label: "История изменений",
                                          icon: History,
                                          onClick: () =>
                                            setAuditEntry({
                                              id: entry.id,
                                              label: `Расход ${fmtDate(entry.date.slice(0, 10))} ${entry.counterpartyName || ""}`,
                                            }),
                                        },
                                      ]}
                                    />
                                  </div>
                                </TableCell>
                              </TableRow>
                            )),
                            // Actual details if any and no plan entries
                            row.incomeEntries.length === 0 &&
                              row.expenseEntries.length === 0 &&
                              row.actual &&
                              row.actual.details.length > 0 && (
                                <TableRow key={`actual-only-${row.date}`} className="bg-muted/20">
                                  <TableCell />
                                  <TableCell colSpan={7} className="pl-8 py-1.5">
                                    <div className="text-xs text-muted-foreground space-y-0.5">
                                      {row.actual.details.map((d, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                          <span>{d.label}</span>
                                          <span className="font-medium">{fmtTons(d.quantity)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ),
                          ].filter(Boolean)
                        : []),
                    ];
                  })}

                  {/* Summary row */}
                  <TableRow className="bg-muted/50 font-semibold border-t-2">
                    <TableCell />
                    <TableCell className="py-2 text-sm">Итого за период</TableCell>
                    <TableCell className="py-2">
                      <span className="text-emerald-600">{fmtTons(totalIncomeKg)}</span>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="text-amber-600">{fmtTons(totalExpenseKg)}</span>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="text-emerald-500">{fmtTons(totalActualIncomeKg)}</span>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="text-amber-500">{fmtTons(totalActualExpenseKg)}</span>
                    </TableCell>
                    <TableCell className="py-2" />
                    <TableCell className="py-2" />
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Allocations table */}
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
                <TableHead>Объём (т)</TableHead>
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
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span>{fmtTons(a.volume)}</span>
                        <FieldCommentPopover
                          entityType="free_volume_allocation"
                          entityId={a.id}
                          fieldKey="volume"
                        />
                      </div>
                    </TableCell>
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
                          {
                            id: "history",
                            label: "История изменений",
                            icon: History,
                            onClick: () =>
                              setAuditAllocation({
                                id: a.id,
                                label: `Распределение ${format(new Date(a.date.slice(0, 10) + "T00:00:00"), "dd.MM.yyyy")}`,
                              }),
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

      {/* Dialogs */}
      <PlanEntryDialog
        open={entryDialogOpen}
        onOpenChange={setEntryDialogOpen}
        warehouseId={warehouseId}
        entry={editingEntry}
        onSubmit={handleEntrySubmit}
        defaultDate={defaultDate}
      />

      <AllocationDialog
        open={allocationDialogOpen}
        onOpenChange={setAllocationDialogOpen}
        entry={editingAllocation}
        onSubmit={handleAllocationSubmit}
        defaultDate={defaultDate}
      />

      <AlertDialog open={!!deleteEntryId} onOpenChange={(o) => !o && setDeleteEntryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запись плана?</AlertDialogTitle>
            <AlertDialogDescription>Это действие нельзя отменить.</AlertDialogDescription>
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
            <AlertDialogDescription>Это действие нельзя отменить.</AlertDialogDescription>
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

      {auditEntry && (
        <AuditPanel
          open={!!auditEntry}
          onOpenChange={(o) => !o && setAuditEntry(null)}
          entityType="plan_entries"
          entityId={auditEntry.id}
          entityName={auditEntry.label}
        />
      )}

      {auditAllocation && (
        <AuditPanel
          open={!!auditAllocation}
          onOpenChange={(o) => !o && setAuditAllocation(null)}
          entityType="free_volume_allocations"
          entityId={auditAllocation.id}
          entityName={auditAllocation.label}
        />
      )}
    </div>
  );
}
