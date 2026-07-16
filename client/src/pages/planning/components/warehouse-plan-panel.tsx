import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, differenceInDays } from "date-fns";
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
  TrendingUp,
  TrendingDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  Plane,
  Globe,
  ArrowRightLeft,
  ClipboardList,
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
import { QuickPlanDialog } from "./quick-plan-dialog";
import { FieldCommentPopover } from "./field-comment-popover";
import { fmtTons } from "../utils/planning-utils";
import { cn } from "@/lib/utils";

interface PlanEntryRow extends PlanEntryFormEntry {
  counterpartyName?: string | null;
  basisName?: string | null;
  isLocked: boolean;
}

interface ActualDetailItem {
  sourceType: string;
  sourceId: string;
  label: string;
  quantity: string;
  date: string;
  isExpense: boolean;
  balanceAfter: string | null;
  counterpartyName?: string | null;
}

interface ActualsByDate {
  date: string;
  incomeActual: string;
  expenseActual: string;
  factBalanceAfter: string | null;
  details: ActualDetailItem[];
}

// ─── 5-day period types ───
interface FiveDayPeriod {
  start: string;
  end: string;
}

interface PeriodRow {
  period: FiveDayPeriod;
  incomeEntries: PlanEntryRow[];
  expenseEntries: PlanEntryRow[];
  actuals: ActualsByDate[];
  lastPlanBalanceAfter: string | null;
}

function buildFiveDayPeriods(from: Date, to: Date): FiveDayPeriod[] {
  const periods: FiveDayPeriod[] = [];
  let current = new Date(from);
  current.setHours(0, 0, 0, 0);
  const endDay = new Date(to);
  endDay.setHours(0, 0, 0, 0);

  while (current <= endDay) {
    const daysLeft = differenceInDays(endDay, current) + 1;
    let len: number;

    if (daysLeft <= 6) {
      if (daysLeft < 3 && periods.length > 0) {
        const last = periods[periods.length - 1];
        last.end = format(endDay, "yyyy-MM-dd");
        break;
      }
      len = daysLeft;
    } else {
      const afterThis = daysLeft - 5;
      if (afterThis > 0 && afterThis < 3) {
        len = daysLeft;
      } else {
        len = 5;
      }
    }

    const periodEnd = addDays(current, len - 1);
    periods.push({
      start: format(current, "yyyy-MM-dd"),
      end: format(periodEnd, "yyyy-MM-dd"),
    });
    current = addDays(periodEnd, 1);
  }

  return periods;
}

function periodKey(p: FiveDayPeriod) {
  return `${p.start}_${p.end}`;
}

function fmtPeriodLabel(p: FiveDayPeriod): string {
  const s = new Date(p.start + "T00:00:00");
  const e = new Date(p.end + "T00:00:00");
  const sDay = format(s, "dd");
  const eDay = format(e, "dd");
  const sMonth = format(s, "MMM", { locale: ru });
  const eMonth = format(e, "MMM", { locale: ru });
  if (sMonth === eMonth) {
    return `${sDay}–${eDay} ${sMonth}`;
  }
  return `${sDay} ${sMonth} – ${eDay} ${eMonth}`;
}

function fmtPeriod(period: PlanningPeriod) {
  return {
    dateFrom: format(period.from, "yyyy-MM-dd"),
    dateTo: format(period.to, "yyyy-MM-dd"),
  };
}

function isPastMonth(dateStr: string): boolean {
  const now = new Date();
  const d = new Date(dateStr + "T00:00:00");
  const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const entryMonthStart = new Date(d.getFullYear(), d.getMonth(), 1);
  return entryMonthStart.getTime() < curMonthStart.getTime();
}

function getSourceTypeIcon(sourceType: string, label: string) {
  if (label.startsWith("Инвентаризация")) {
    return <ClipboardList className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />;
  }
  if (sourceType === "opt") {
    return <Package className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />;
  }
  if (sourceType === "refueling_abroad") {
    return <Globe className="h-3.5 w-3.5 text-cyan-500 flex-shrink-0" />;
  }
  if (sourceType === "refueling") {
    return <Plane className="h-3.5 w-3.5 text-sky-500 flex-shrink-0" />;
  }
  if (sourceType === "movement") {
    return <ArrowRightLeft className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />;
  }
  return <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />;
}

// ─── Detail panel inside expanded period row ───
function PeriodDetailPanel({
  row,
  warehouseId,
  lockEnabled,
  isEntryEditable,
  onEditEntry,
  onDeleteEntry,
  onAuditEntry,
}: {
  row: PeriodRow;
  warehouseId: string;
  lockEnabled: boolean;
  isEntryEditable: (e: PlanEntryRow) => boolean;
  onEditEntry: (e: PlanEntryRow) => void;
  onDeleteEntry: (id: string) => void;
  onAuditEntry: (e: PlanEntryRow) => void;
}) {
  const [factExpanded, setFactExpanded] = useState(false);

  const allFactDetails = row.actuals.flatMap((a) => a.details);
  const incomeDetails = allFactDetails.filter((d) => !d.isExpense);
  const expenseDetails = allFactDetails.filter((d) => d.isExpense);

  const planBalanceKg = row.lastPlanBalanceAfter;
  const lastActualWithBalance = [...row.actuals]
    .reverse()
    .find((a) => a.factBalanceAfter !== null);
  const factBalanceKg = lastActualWithBalance?.factBalanceAfter ?? null;

  const totalFactIncome = row.actuals.reduce(
    (s, a) => s + parseFloat(a.incomeActual || "0"),
    0,
  );
  const totalFactExpense = row.actuals.reduce(
    (s, a) => s + parseFloat(a.expenseActual || "0"),
    0,
  );
  const hasAnyPlan = row.incomeEntries.length > 0 || row.expenseEntries.length > 0;
  const hasAnyFact = incomeDetails.length > 0 || expenseDetails.length > 0;

  function PlanEntry({ e }: { e: PlanEntryRow }) {
    return (
      <div key={e.id} className="flex items-start gap-1.5 text-sm py-0.5">
        <div className="flex-1 min-w-0">
          <span
            className={
              e.type === "income"
                ? "text-emerald-700 font-medium"
                : "text-amber-700 font-medium"
            }
          >
            {e.counterpartyName || "—"}
          </span>
          {e.basisName && (
            <span className="ml-1 text-xs text-muted-foreground font-normal">
              ({e.basisName})
            </span>
          )}
          <span
            className={cn(
              "ml-2 font-semibold tabular-nums text-xs",
              e.type === "income" ? "text-emerald-600" : "text-amber-600",
            )}
          >
            {fmtTons(e.volume)}
          </span>
          <span className="ml-1 text-xs text-muted-foreground">
            {format(new Date(e.date.slice(0, 10) + "T00:00:00"), "dd.MM")}
          </span>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <FieldCommentPopover
            entityType="plan_entry"
            entityId={e.id}
            fieldKey="volume"
          />
          <EntityActionsMenu
            actions={[
              {
                id: "edit",
                label: "Редактировать",
                icon: Pencil,
                onClick: () => onEditEntry(e),
                permission: { module: "planning", action: "edit" },
                condition: isEntryEditable(e),
              },
              {
                id: "delete",
                label: "Удалить",
                icon: Trash2,
                variant: "destructive",
                onClick: () => onDeleteEntry(e.id),
                permission: { module: "planning", action: "delete" },
                condition: isEntryEditable(e),
              },
              {
                id: "history",
                label: "История изменений",
                icon: History,
                onClick: () => onAuditEntry(e),
              },
            ]}
          />
        </div>
      </div>
    );
  }

  return (
    <TableRow className="bg-muted/20 hover:bg-muted/30">
      <TableCell colSpan={9} className="p-0">
        <div className="mx-4 my-2 border rounded-md overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">

          {/* ══ ПЛАН ══ */}
          <div className="p-3 flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="text-xs font-medium text-blue-600 border-blue-200"
              >
                ПЛАН
              </Badge>
            </div>

            {!hasAnyPlan && (
              <p className="text-xs text-muted-foreground italic">
                Нет плановых записей
              </p>
            )}

            <div className="grid grid-cols-2 divide-x flex-1">
              <div className="pr-3 space-y-0.5">
                <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium mb-1">
                  <ArrowDownToLine className="h-3 w-3 text-emerald-500" />
                  Поступления
                </div>
                {row.incomeEntries.length > 0 ? (
                  row.incomeEntries.map((e) => <PlanEntry key={e.id} e={e} />)
                ) : (
                  <p className="text-xs text-muted-foreground/50 italic">—</p>
                )}
              </div>
              <div className="pl-3 space-y-0.5">
                <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium mb-1">
                  <ArrowUpFromLine className="h-3 w-3 text-amber-500" />
                  Расходы
                </div>
                {row.expenseEntries.length > 0 ? (
                  row.expenseEntries.map((e) => <PlanEntry key={e.id} e={e} />)
                ) : (
                  <p className="text-xs text-muted-foreground/50 italic">—</p>
                )}
              </div>
            </div>

            {planBalanceKg !== null && (
              <div className="pt-2 border-t flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Остаток (план):</span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    parseFloat(planBalanceKg) < 0
                      ? "text-destructive"
                      : "text-foreground",
                  )}
                >
                  {fmtTons(planBalanceKg)}
                </span>
              </div>
            )}
          </div>

          {/* ══ ФАКТ ══ */}
          <div className="p-3 flex flex-col gap-2">
            <button
              onClick={() => setFactExpanded((v) => !v)}
              className="flex items-center gap-1.5 w-full text-left rounded-sm hover:bg-muted/50 transition-colors -mx-1 px-1 py-0.5"
              data-testid="button-toggle-fact"
            >
              <Badge
                variant="outline"
                className="text-xs font-medium text-slate-600 border-slate-200 pointer-events-none"
              >
                ФАКТ
              </Badge>
              {/* Compact summary when collapsed */}
              {!factExpanded && hasAnyFact && (
                <span className="text-xs text-muted-foreground ml-1">
                  {totalFactIncome > 0 && (
                    <span className="text-emerald-600 mr-2">
                      ↓ {fmtTons(totalFactIncome)}
                    </span>
                  )}
                  {totalFactExpense > 0 && (
                    <span className="text-amber-600">
                      ↑ {fmtTons(totalFactExpense)}
                    </span>
                  )}
                </span>
              )}
              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                {factExpanded ? "свернуть" : hasAnyFact ? "детали" : "нет данных"}
                {factExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </span>
            </button>

            {!factExpanded && !hasAnyFact && (
              <p className="text-xs text-muted-foreground italic">
                Нет фактических операций
              </p>
            )}

            {factExpanded && (
              <>
                {!hasAnyFact && (
                  <p className="text-xs text-muted-foreground italic">
                    Нет фактических операций
                  </p>
                )}

                <div className="grid grid-cols-2 divide-x flex-1">
                  <div className="pr-3 space-y-0.5">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium mb-1">
                      <ArrowDownToLine className="h-3 w-3 text-emerald-400" />
                      Поступления
                    </div>
                    {incomeDetails.length > 0 ? (
                      incomeDetails.map((d, i) => (
                        <div key={i} className="flex items-center gap-1.5 py-0.5">
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex-shrink-0">
                                  {getSourceTypeIcon(d.sourceType, d.label)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="text-xs">{d.label}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <span className="text-emerald-600 font-semibold tabular-nums text-xs">
                            {fmtTons(d.quantity)}
                          </span>
                          {d.counterpartyName && (
                            <span className="text-xs text-muted-foreground truncate">
                              {d.counterpartyName}
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground/50 italic">—</p>
                    )}
                  </div>
                  <div className="pl-3 space-y-0.5">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium mb-1">
                      <ArrowUpFromLine className="h-3 w-3 text-amber-400" />
                      Расходы
                    </div>
                    {expenseDetails.length > 0 ? (
                      expenseDetails.map((d, i) => (
                        <div key={i} className="flex items-center gap-1.5 py-0.5">
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex-shrink-0">
                                  {getSourceTypeIcon(d.sourceType, d.label)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="text-xs">{d.label}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <span className="text-amber-600 font-semibold tabular-nums text-xs">
                            {fmtTons(d.quantity)}
                          </span>
                          {d.counterpartyName && (
                            <span className="text-xs text-muted-foreground truncate">
                              {d.counterpartyName}
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground/50 italic">—</p>
                    )}
                  </div>
                </div>

                {factBalanceKg !== null && (
                  <div className="pt-2 border-t flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Остаток (факт):</span>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        parseFloat(factBalanceKg) < 0
                          ? "text-destructive"
                          : "text-foreground",
                      )}
                    >
                      {fmtTons(factBalanceKg)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Main panel ───
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
  const [quickDialogOpen, setQuickDialogOpen] = useState(false);
  const [quickAddPeriod, setQuickAddPeriod] = useState<FiveDayPeriod | null>(null);
  const [quickAddType, setQuickAddType] = useState<"income" | "expense">("income");
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<AllocationFormEntry | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [deleteAllocationId, setDeleteAllocationId] = useState<string | null>(null);
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [auditEntry, setAuditEntry] = useState<{ id: string; label: string } | null>(null);
  const [auditAllocation, setAuditAllocation] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const entriesKey = ["/api/planning/entries", warehouseId, dateFrom, dateTo];
  const allocationsKey = ["/api/planning/allocations", warehouseId, dateFrom, dateTo];
  const actualsKey = ["/api/planning/actuals", warehouseId, dateFrom, dateTo];
  const settingsKey = ["/api/planning/settings"];

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

  const { data: settings = {} } = useQuery<Record<string, string>>({
    queryKey: settingsKey,
    queryFn: async () => (await apiRequest("GET", "/api/planning/settings")).json(),
  });

  const lockEnabled = settings["editLockEnabled"] === "true";
  const canCreate = hasPermission("planning", "create");

  // ─── Build 5-day periods for entire selected range ───
  const fiveDayPeriods = buildFiveDayPeriods(period.from, period.to);

  const actualsByDate = new Map(actuals.map((a) => [a.date, a]));

  const periodRows: PeriodRow[] = fiveDayPeriods.map((p) => {
    const periodEntries = entries.filter((e) => {
      const d = e.date.slice(0, 10);
      return d >= p.start && d <= p.end;
    });
    const incomeEntries = periodEntries.filter((e) => e.type === "income");
    const expenseEntries = periodEntries.filter((e) => e.type === "expense");

    const periodActuals = actuals.filter((a) => a.date >= p.start && a.date <= p.end);

    // Last plan balance: the last entry's balanceAfter in this period
    const lastEntry = periodEntries[periodEntries.length - 1];
    const lastPlanBalanceAfter = lastEntry?.balanceAfter ?? null;

    return {
      period: p,
      incomeEntries,
      expenseEntries,
      actuals: periodActuals,
      lastPlanBalanceAfter,
    };
  });

  // ─── Totals for summary row ───
  const totalIncomeKg = entries
    .filter((e) => e.type === "income")
    .reduce((s, e) => s + parseFloat(e.volume || "0"), 0);
  const totalExpenseKg = entries
    .filter((e) => e.type === "expense")
    .reduce((s, e) => s + parseFloat(e.volume || "0"), 0);
  const totalActualIncomeKg = actuals.reduce(
    (s, a) => s + parseFloat(a.incomeActual || "0"),
    0,
  );
  const totalActualExpenseKg = actuals.reduce(
    (s, a) => s + parseFloat(a.expenseActual || "0"),
    0,
  );
  const lastPlanBalance =
    [...periodRows]
      .reverse()
      .find((r) => r.lastPlanBalanceAfter)
      ?.lastPlanBalanceAfter ?? null;
  const lastFactBalance =
    [...actuals]
      .reverse()
      .find((a) => a.factBalanceAfter)
      ?.factBalanceAfter ?? null;

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
        await apiRequest(
          "PATCH",
          `/api/planning/allocations/${editingAllocation.id}`,
          values,
        );
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
      toast({ title: "Ошибка", description: error?.message, variant: "destructive" });
    } finally {
      setDeleteAllocationId(null);
    }
  };

  const toggleLock = async () => {
    const newVal = lockEnabled ? "false" : "true";
    try {
      await apiRequest("PATCH", "/api/planning/settings", {
        key: "editLockEnabled",
        value: newVal,
      });
      queryClient.invalidateQueries({ queryKey: settingsKey });
      toast({ title: lockEnabled ? "Блокировка снята" : "Блокировка включена" });
    } catch {
      toast({ title: "Ошибка сохранения настройки", variant: "destructive" });
    }
  };

  const togglePeriod = (p: FiveDayPeriod) => {
    const key = periodKey(p);
    setExpandedPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllPeriods = () => {
    if (allExpanded) {
      setExpandedPeriods(new Set());
      setAllExpanded(false);
    } else {
      setExpandedPeriods(new Set(fiveDayPeriods.map(periodKey)));
      setAllExpanded(true);
    }
  };

  const isEntryEditable = (entry: PlanEntryRow): boolean => {
    if (!lockEnabled) return true;
    return !isPastMonth(entry.date.slice(0, 10));
  };

  const openQuickAdd = (
    e: React.MouseEvent,
    p: FiveDayPeriod,
    type: "income" | "expense",
  ) => {
    e.stopPropagation();
    setQuickAddPeriod(p);
    setQuickAddType(type);
    setQuickDialogOpen(true);
  };

  const COL_COUNT = 9;

  return (
    <div className="space-y-4">
      {/* Plan/Fact table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap pb-3">
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
                      ? "Редактирование прошлых месяцев заблокировано"
                      : "Редактирование прошлых месяцев разрешено"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
                    onClick={toggleAllPeriods}
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
                <TableHead>
                  <div className="flex items-center gap-1">
                    <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
                    Приход план (т)
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                    Расход план (т)
                  </div>
                </TableHead>
                <TableHead>Остаток план (т)</TableHead>
                <TableHead>Факт прих (т)</TableHead>
                <TableHead>Факт расх (т)</TableHead>
                <TableHead>Остаток факт (т)</TableHead>
                <TableHead>Контрагенты</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingEntries ? (
                <TableRow>
                  <TableCell
                    colSpan={COL_COUNT}
                    className="text-center text-muted-foreground py-8"
                  >
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {/* ── Итого за период ── */}
                  <TableRow className="bg-blue-50/50 dark:bg-blue-950/20 font-semibold border-b-2">
                    <TableCell />
                    <TableCell className="py-2 text-sm text-blue-700 dark:text-blue-400">
                      Итого за период
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="text-emerald-600">{fmtTons(totalIncomeKg)}</span>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="text-amber-600">{fmtTons(totalExpenseKg)}</span>
                    </TableCell>
                    <TableCell className="py-2">
                      {lastPlanBalance ? (
                        <span
                          className={
                            parseFloat(lastPlanBalance) < 0 ? "text-destructive" : ""
                          }
                        >
                          {fmtTons(lastPlanBalance)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      {totalActualIncomeKg > 0 ? (
                        <span className="text-emerald-500">
                          {fmtTons(totalActualIncomeKg)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      {totalActualExpenseKg > 0 ? (
                        <span className="text-amber-500">
                          {fmtTons(totalActualExpenseKg)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      {lastFactBalance ? (
                        <span
                          className={
                            parseFloat(lastFactBalance) < 0 ? "text-destructive" : ""
                          }
                        >
                          {fmtTons(lastFactBalance)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2" />
                  </TableRow>

                  {/* ── Period rows ── */}
                  {periodRows.map((row) => {
                    const key = periodKey(row.period);
                    const isExpanded = expandedPeriods.has(key);
                    const incomeKg = row.incomeEntries.reduce(
                      (s, e) => s + parseFloat(e.volume || "0"),
                      0,
                    );
                    const expenseKg = row.expenseEntries.reduce(
                      (s, e) => s + parseFloat(e.volume || "0"),
                      0,
                    );
                    const factIncomeKg = row.actuals.reduce(
                      (s, a) => s + parseFloat(a.incomeActual || "0"),
                      0,
                    );
                    const factExpenseKg = row.actuals.reduce(
                      (s, a) => s + parseFloat(a.expenseActual || "0"),
                      0,
                    );
                    const lastActualBal = [...row.actuals]
                      .reverse()
                      .find((a) => a.factBalanceAfter)?.factBalanceAfter ?? null;

                    const past = isPastMonth(row.period.start);

                    const incomeNames = row.incomeEntries
                      .map((e) => e.counterpartyName || "?")
                      .slice(0, 2);
                    const expenseNames = row.expenseEntries
                      .map((e) => e.counterpartyName || "?")
                      .slice(0, 2);

                    return [
                      <TableRow
                        key={`summary-${key}`}
                        className={cn(
                          "cursor-pointer hover-elevate",
                          past && lockEnabled && "opacity-75",
                        )}
                        onClick={() => togglePeriod(row.period)}
                        data-testid={`row-period-${key}`}
                      >
                        <TableCell className="py-2">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="py-2 font-medium text-sm whitespace-nowrap">
                          {fmtPeriodLabel(row.period)}
                          {past && lockEnabled && (
                            <Lock className="inline-block h-3 w-3 ml-1 text-muted-foreground" />
                          )}
                        </TableCell>

                        {/* Приход план */}
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1.5">
                            {incomeKg > 0 ? (
                              <>
                                <span className="text-emerald-600 font-medium">
                                  {fmtTons(incomeKg)}
                                </span>
                                <FieldCommentPopover
                                  entityType="plan_period_income"
                                  entityId={warehouseId}
                                  fieldKey={`income_${key}`}
                                />
                              </>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                            {canCreate && (
                              <button
                                onClick={(e) => openQuickAdd(e, row.period, "income")}
                                className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-blue-400 bg-blue-50 text-blue-500 hover:bg-blue-100 hover:border-blue-500 transition-colors flex-shrink-0"
                                title="Добавить приход"
                                data-testid={`button-quick-add-income-${key}`}
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </TableCell>

                        {/* Расход план */}
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1.5">
                            {expenseKg > 0 ? (
                              <>
                                <span className="text-amber-600 font-medium">
                                  {fmtTons(expenseKg)}
                                </span>
                                <FieldCommentPopover
                                  entityType="plan_period_expense"
                                  entityId={warehouseId}
                                  fieldKey={`expense_${key}`}
                                />
                              </>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                            {canCreate && (
                              <button
                                onClick={(e) => openQuickAdd(e, row.period, "expense")}
                                className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-blue-400 bg-blue-50 text-blue-500 hover:bg-blue-100 hover:border-blue-500 transition-colors flex-shrink-0"
                                title="Добавить расход"
                                data-testid={`button-quick-add-expense-${key}`}
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-2">
                          {row.lastPlanBalanceAfter ? (
                            <span
                              className={cn(
                                "text-sm",
                                parseFloat(row.lastPlanBalanceAfter) < 0 &&
                                  "text-destructive",
                              )}
                            >
                              {fmtTons(row.lastPlanBalanceAfter)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          {factIncomeKg > 0 ? (
                            <span className="text-emerald-500">
                              {fmtTons(factIncomeKg)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          {factExpenseKg > 0 ? (
                            <span className="text-amber-500">
                              {fmtTons(factExpenseKg)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          {lastActualBal ? (
                            <span
                              className={cn(
                                "text-sm",
                                parseFloat(lastActualBal) < 0 && "text-destructive",
                              )}
                            >
                              {fmtTons(lastActualBal)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex flex-col gap-0.5 text-xs">
                            {incomeNames.length > 0 && (
                              <span className="text-emerald-600 truncate max-w-[120px]">
                                ↓ {incomeNames.join(", ")}
                                {row.incomeEntries.length > 2
                                  ? ` +${row.incomeEntries.length - 2}`
                                  : ""}
                              </span>
                            )}
                            {expenseNames.length > 0 && (
                              <span className="text-amber-600 truncate max-w-[120px]">
                                ↑ {expenseNames.join(", ")}
                                {row.expenseEntries.length > 2
                                  ? ` +${row.expenseEntries.length - 2}`
                                  : ""}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>,

                      isExpanded && (
                        <PeriodDetailPanel
                          key={`detail-${key}`}
                          row={row}
                          warehouseId={warehouseId}
                          lockEnabled={lockEnabled}
                          isEntryEditable={isEntryEditable}
                          onEditEntry={(e) => {
                            setEditingEntry(e);
                            setQuickAddPeriod(null);
                            setEntryDialogOpen(true);
                          }}
                          onDeleteEntry={(id) => setDeleteEntryId(id)}
                          onAuditEntry={(e) =>
                            setAuditEntry({
                              id: e.id,
                              label: `Запись ${e.type === "income" ? "прихода" : "расхода"} ${fmtPeriodLabel(row.period)} — ${e.counterpartyName || ""}`,
                            })
                          }
                        />
                      ),
                    ];
                  })}
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
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : allocations.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    Нет распределений за период
                  </TableCell>
                </TableRow>
              ) : (
                allocations.map((a: any) => (
                  <TableRow key={a.id} data-testid={`row-allocation-${a.id}`}>
                    <TableCell>
                      {format(
                        new Date(a.date.slice(0, 10) + "T00:00:00"),
                        "dd.MM.yyyy",
                      )}
                    </TableCell>
                    <TableCell>{a.fromName || "—"}</TableCell>
                    <TableCell>{a.toName || "—"}</TableCell>
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
      {/* Quick-add dialog (new flexible entry per 5-day period) */}
      {quickAddPeriod && (
        <QuickPlanDialog
          open={quickDialogOpen}
          onOpenChange={(o) => {
            setQuickDialogOpen(o);
            if (!o) {
              setQuickAddPeriod(null);
              invalidateAll();
            }
          }}
          period={quickAddPeriod}
          defaultType={quickAddType}
          warehouseId={warehouseId}
          onSubmitEntry={async (values: any) => {
            await apiRequest("POST", "/api/planning/entries", { ...values, warehouseId });
          }}
        />
      )}

      {/* Full edit dialog for existing entries */}
      <PlanEntryDialog
        open={entryDialogOpen}
        onOpenChange={(o) => {
          setEntryDialogOpen(o);
          if (!o) setQuickAddPeriod(null);
        }}
        warehouseId={warehouseId}
        entry={editingEntry}
        onSubmit={handleEntrySubmit}
        defaultDate={defaultDate}
        defaultType={undefined}
      />

      <AllocationDialog
        open={allocationDialogOpen}
        onOpenChange={setAllocationDialogOpen}
        entry={editingAllocation}
        onSubmit={handleAllocationSubmit}
        defaultDate={defaultDate}
      />

      <AlertDialog
        open={!!deleteEntryId}
        onOpenChange={(o) => !o && setDeleteEntryId(null)}
      >
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
          open
          onOpenChange={(o) => !o && setAuditEntry(null)}
          entityType="plan_entries"
          entityId={auditEntry.id}
          entityName={auditEntry.label}
        />
      )}

      {auditAllocation && (
        <AuditPanel
          open
          onOpenChange={(o) => !o && setAuditAllocation(null)}
          entityType="free_volume_allocations"
          entityId={auditAllocation.id}
          entityName={auditAllocation.label}
        />
      )}
    </div>
  );
}
