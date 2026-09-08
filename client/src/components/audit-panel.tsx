import { useState, useMemo } from "react";
import * as React from "react";
import { format, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  History,
  User,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Undo2,
  Loader2,
  ArrowRight,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAudit, type AuditEntry } from "@/hooks/use-audit";
import { useRollback } from "@/hooks/use-rollback";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { ENTITY_TYPE_LABELS } from "@/lib/field-labels";
import {
  computeChanges,
  getEntitySummary,
  changeSummary,
  formatValue,
} from "@/lib/audit-helpers";

interface AuditPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId?: string;
  entityName?: string;
}

// ─── Конфигурация типов действий ─────────────────────────────────────────────

const ACTION_CONFIG = {
  CREATE: {
    icon: Plus,
    label: "Создание",
    color: "text-emerald-600 dark:text-emerald-500",
    dotCls: "bg-emerald-500",
    badgeCls:
      "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-400",
    bgCls: "bg-emerald-50 dark:bg-emerald-950/20",
  },
  UPDATE: {
    icon: Pencil,
    label: "Изменение",
    color: "text-blue-600 dark:text-blue-500",
    dotCls: "bg-blue-500",
    badgeCls:
      "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800/50 dark:bg-blue-950/30 dark:text-blue-400",
    bgCls: "bg-blue-50 dark:bg-blue-950/20",
  },
  DELETE: {
    icon: Trash2,
    label: "Удаление",
    color: "text-red-600 dark:text-red-500",
    dotCls: "bg-red-500",
    badgeCls:
      "border-red-300 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400",
    bgCls: "bg-red-50 dark:bg-red-950/20",
  },
  RESTORE: {
    icon: RotateCcw,
    label: "Восстановление",
    color: "text-purple-600 dark:text-purple-500",
    dotCls: "bg-purple-500",
    badgeCls:
      "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800/50 dark:bg-purple-950/30 dark:text-purple-400",
    bgCls: "bg-purple-50 dark:bg-purple-950/20",
  },
} as const;

// ─── Вспомогательные ─────────────────────────────────────────────────────────

function formatDateGroup(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  if (isToday(d)) return "Сегодня";
  if (isYesterday(d)) return "Вчера";
  return format(d, "d MMMM yyyy", { locale: ru });
}

function isRollbackEntry(entry: AuditEntry): boolean {
  return !!entry.userName?.includes("откат");
}

function rollbackLabel(userName: string): string {
  if (userName.includes("откат создания")) return "Откат создания";
  if (userName.includes("откат изменения")) return "Откат изменения";
  if (userName.includes("откат удаления")) return "Откат удаления";
  return "Откат";
}

function cleanUserName(userName: string | null | undefined): string {
  if (!userName) return "Неизвестно";
  return userName.replace(/\s*\(откат.*?\)\s*/g, "").trim();
}

// ─── Детальный просмотр изменений ────────────────────────────────────────────

function ChangeDetail({
  entry,
  entityType,
}: {
  entry: AuditEntry;
  entityType: string;
}) {
  const changes = useMemo(
    () => computeChanges(entry, entityType),
    [entry, entityType]
  );

  if (changes.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Нет данных для отображения
      </p>
    );
  }

  // Специальный режим для авансовых карт (показываем баланс как пополнение)
  if (entityType === "exchange_advance_cards" && entry.operation === "UPDATE") {
    const balChange = changes.find((c) => c.field === "currentBalance");
    if (balChange) {
      const oldBal = balChange.oldVal as number | null;
      const newBal = balChange.newVal as number | null;
      const diff =
        oldBal != null && newBal != null ? (newBal as number) - (oldBal as number) : null;
      const isTopUp = diff !== null && diff > 0;
      return (
        <div className="space-y-2">
          <div className={cn(
            "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium",
            isTopUp
              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
              : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
          )}>
            <span>{isTopUp ? "Пополнение" : "Списание"}</span>
            {diff !== null && (
              <span className="font-bold">
                {isTopUp ? "+" : ""}{diff.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs px-1">
            <span className="text-muted-foreground">Баланс:</span>
            <span className="text-red-600 dark:text-red-400 line-through">{formatValue(oldBal, "currentBalance")}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatValue(newBal, "currentBalance")}</span>
          </div>
          {/* Остальные изменения (кроме баланса) */}
          {changes.filter(c => c.field !== "currentBalance").map(({ field, label, oldVal, newVal }) => (
            <FieldRow key={field} label={label} oldVal={oldVal} newVal={newVal} field={field} operation={entry.operation} />
          ))}
        </div>
      );
    }
  }

  if (entry.operation === "CREATE") {
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground font-medium mb-2 uppercase tracking-wide">Созданные данные</p>
        <div className="grid gap-1.5">
          {changes.map(({ field, label, newVal, isFK }) => (
            <div key={field} className="flex items-baseline gap-2 text-xs min-w-0">
              <span className="text-muted-foreground shrink-0 w-[130px] truncate" title={label}>{label}</span>
              <span className={cn(
                "font-medium text-foreground break-words min-w-0",
                isFK && "text-muted-foreground italic"
              )}>
                {isFK ? "задан(о)" : formatValue(newVal, field)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (entry.operation === "DELETE") {
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground font-medium mb-2 uppercase tracking-wide">Удалённые данные</p>
        <div className="grid gap-1.5">
          {changes.map(({ field, label, oldVal, isFK }) => (
            <div key={field} className="flex items-baseline gap-2 text-xs min-w-0">
              <span className="text-muted-foreground shrink-0 w-[130px] truncate" title={label}>{label}</span>
              <span className={cn(
                "line-through text-red-600 dark:text-red-400 break-words min-w-0",
                isFK && "not-italic text-muted-foreground"
              )}>
                {isFK ? "было задан(о)" : formatValue(oldVal, field)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (entry.operation === "RESTORE") {
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground font-medium mb-2 uppercase tracking-wide">Восстановленные данные</p>
        <div className="grid gap-1.5">
          {changes.map(({ field, label, newVal, isFK }) => (
            <div key={field} className="flex items-baseline gap-2 text-xs min-w-0">
              <span className="text-muted-foreground shrink-0 w-[130px] truncate" title={label}>{label}</span>
              <span className={cn(
                "text-purple-700 dark:text-purple-400 font-medium break-words min-w-0",
                isFK && "italic"
              )}>
                {isFK ? "восстановлен(о)" : formatValue(newVal, field)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // UPDATE
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] text-muted-foreground font-medium mb-2 uppercase tracking-wide">Изменения</p>
      {changes.map(({ field, label, oldVal, newVal, isFK }) => (
        <FieldRow key={field} label={label} oldVal={oldVal} newVal={newVal} field={field} operation="UPDATE" isFK={isFK} />
      ))}
    </div>
  );
}

function FieldRow({
  label,
  oldVal,
  newVal,
  field,
  operation,
  isFK,
}: {
  label: string;
  oldVal: unknown;
  newVal: unknown;
  field: string;
  operation: string;
  isFK?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-semibold text-foreground/80">{label}</p>
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {isFK ? (
          <span className="text-muted-foreground italic">изменена ссылка</span>
        ) : (
          <>
            <span className="px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 line-through max-w-[160px] break-words">
              {formatValue(oldVal, field)}
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold max-w-[160px] break-words">
              {formatValue(newVal, field)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Строка записи аудита ─────────────────────────────────────────────────────

function AuditEntryRow({
  entry,
  entityType,
  isAdmin,
  onRollback,
}: {
  entry: AuditEntry;
  entityType: string;
  isAdmin: boolean;
  onRollback: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const config =
    ACTION_CONFIG[entry.operation as keyof typeof ACTION_CONFIG] ??
    ACTION_CONFIG.UPDATE;
  const Icon = config.icon;

  const isRolledBack = !!entry.rolledBackAt;
  const isEntityDeleted = !!entry.entityDeleted;
  const isRollback = isRollbackEntry(entry);
  const canRollback =
    isAdmin &&
    ["CREATE", "UPDATE", "DELETE"].includes(entry.operation) &&
    !isRolledBack &&
    !isEntityDeleted;

  const timeStr = format(new Date(entry.createdAt), "HH:mm");
  const userName = cleanUserName(entry.userName);

  // Идентификатор записи (дата/тип/кол-во/название)
  const entityId = useMemo(
    () => getEntitySummary(entry, entityType),
    [entry, entityType]
  );

  // Краткое описание изменённых полей (только для UPDATE)
  const fieldsSummary = useMemo(
    () => changeSummary(entry, entityType),
    [entry, entityType]
  );

  return (
    <>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <div
            className={cn(
              "group flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors select-none",
              "hover:bg-muted/60",
              expanded && "bg-muted/40",
              isRolledBack && "opacity-55"
            )}
          >
            {/* Иконка */}
            <div
              className={cn(
                "mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0 bg-background border",
                config.color
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>

            {/* Контент */}
            <div className="flex-1 min-w-0">
              {/* Первая строка: время · пользователь · бейдж */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                  {timeStr}
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-foreground">
                  <User className="h-3 w-3 text-muted-foreground" />
                  {userName}
                </span>
                <Badge
                  variant="outline"
                  className={cn("text-[10px] px-1.5 py-0 h-4", config.badgeCls)}
                >
                  {isRollback ? rollbackLabel(entry.userName || "") : config.label}
                </Badge>
                {isEntityDeleted && entry.operation !== "DELETE" && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground border-muted-foreground/30"
                  >
                    Запись удалена
                  </Badge>
                )}
                {isRolledBack && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4 border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800/50 dark:bg-orange-950/30 dark:text-orange-400"
                  >
                    Откат выполнен
                  </Badge>
                )}
              </div>

              {/* Идентификатор сущности */}
              {entityId && (
                <p className="text-xs text-foreground/70 font-medium mt-0.5 truncate">
                  {entityId}
                </p>
              )}

              {/* Список изменённых полей (только для UPDATE) */}
              {fieldsSummary && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {fieldsSummary}
                </p>
              )}

              {/* Дата отката */}
              {isRolledBack && entry.rolledBackAt && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Откат:{" "}
                  {format(new Date(entry.rolledBackAt), "dd.MM.yyyy в HH:mm", {
                    locale: ru,
                  })}
                </p>
              )}
            </div>

            {/* Правая часть */}
            <div className="flex items-center gap-1 shrink-0">
              {canRollback && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowConfirm(true);
                  }}
                >
                  <Undo2 className="h-3 w-3 mr-1" />
                  Откатить
                </Button>
              )}
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform",
                  expanded && "rotate-90"
                )}
              />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="ml-10 mr-3 mb-2 px-3 py-3 rounded-lg bg-muted/30 border border-border/50">
            <ChangeDetail entry={entry} entityType={entityType} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Диалог подтверждения отката */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Подтвердите откат
            </AlertDialogTitle>
            <AlertDialogDescription>
              {entry.operation === "CREATE" &&
                "Созданная запись будет удалена. Действие нельзя отменить автоматически — потребуется ещё один откат."}
              {entry.operation === "UPDATE" &&
                "Значения полей будут возвращены к состоянию до этого изменения."}
              {entry.operation === "DELETE" &&
                "Удалённая запись будет восстановлена со всеми данными."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setShowConfirm(false);
                onRollback(entry.id);
              }}
            >
              Откатить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Группа по дате ───────────────────────────────────────────────────────────

function DateGroup({
  dateKey,
  entries,
  entityType,
  isAdmin,
  onRollback,
}: {
  dateKey: string;
  entries: AuditEntry[];
  entityType: string;
  isAdmin: boolean;
  onRollback: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const label = formatDateGroup(dateKey);

  return (
    <div>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 w-full py-1.5 px-1 text-left"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            collapsed && "-rotate-90"
          )}
        />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <span className="text-[11px] text-muted-foreground/50">
          ({entries.length})
        </span>
        <div className="flex-1 h-px bg-border/40 ml-1" />
      </button>

      {!collapsed && (
        <div className="space-y-0.5">
          {entries.map((entry) => (
            <AuditEntryRow
              key={entry.id}
              entry={entry}
              entityType={entityType}
              isAdmin={isAdmin}
              onRollback={onRollback}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Главная панель ───────────────────────────────────────────────────────────

export function AuditPanel({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
}: AuditPanelProps) {
  const {
    auditHistory,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAudit({ entityType, entityId, enabled: open });

  const { rollback, isRollingBack } = useRollback();
  const { isAdmin } = useAuth();

  const entries = useMemo(
    () => auditHistory?.pages.flatMap((p) => p.data) || [],
    [auditHistory]
  );

  // Группировка по дате, свежие сверху
  const groupedByDate = useMemo(() => {
    const groups: Record<string, AuditEntry[]> = {};
    entries.forEach((entry) => {
      const key = entry.createdAt.slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  const handleRollback = (auditLogId: string) => {
    rollback(auditLogId, { onSuccess: () => refetch() });
  };

  const entityLabel = ENTITY_TYPE_LABELS[entityType] || entityType;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
        {/* Шапка */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-muted-foreground" />
            История изменений
          </SheetTitle>
          <SheetDescription className="text-xs flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground">{entityLabel}</span>
            {entityName && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="font-medium text-foreground">{entityName}</span>
              </>
            )}
            {isAdmin && (
              <span className="ml-auto inline-flex items-center gap-1 text-amber-600 dark:text-amber-500 text-[11px]">
                <ShieldAlert className="h-3 w-3" />
                Откат доступен
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Список */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-3 py-3">
            {isLoading ? (
              <div className="space-y-3 px-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-48" />
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <History className="h-6 w-6 text-muted-foreground opacity-40" />
                </div>
                <p className="text-sm text-muted-foreground">История изменений пуста</p>
              </div>
            ) : (
              <div className="space-y-1">
                {groupedByDate.map(([dateKey, dateEntries]) => (
                  <DateGroup
                    key={dateKey}
                    dateKey={dateKey}
                    entries={dateEntries}
                    entityType={entityType}
                    isAdmin={isAdmin}
                    onRollback={handleRollback}
                  />
                ))}

                {hasNextPage && (
                  <div className="pt-2 px-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="w-full gap-2 text-xs"
                    >
                      {isFetchingNextPage ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Загрузка...
                        </>
                      ) : (
                        "Загрузить ещё"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Низ */}
        <div className="px-4 py-3 border-t shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={() => refetch()}
            disabled={isLoading || isRollingBack || isFetchingNextPage}
          >
            {isRollingBack ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Выполняется откат...
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Обновить
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
