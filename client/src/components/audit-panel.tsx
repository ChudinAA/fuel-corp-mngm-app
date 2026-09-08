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
import {
  getFieldLabel,
  ENTITY_TYPE_LABELS,
  isFieldVisible,
} from "@/lib/field-labels";

interface AuditPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId?: string;
  entityName?: string;
}

// ─── Конфигурация типов действий ────────────────────────────────────────────

const ACTION_CONFIG = {
  CREATE: {
    icon: Plus,
    label: "Создание",
    shortLabel: "Создано",
    color: "text-emerald-600 dark:text-emerald-500",
    badgeCls:
      "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-400",
    dotCls: "bg-emerald-500",
  },
  UPDATE: {
    icon: Pencil,
    label: "Изменение",
    shortLabel: "Изменено",
    color: "text-blue-600 dark:text-blue-500",
    badgeCls:
      "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800/50 dark:bg-blue-950/30 dark:text-blue-400",
    dotCls: "bg-blue-500",
  },
  DELETE: {
    icon: Trash2,
    label: "Удаление",
    shortLabel: "Удалено",
    color: "text-red-600 dark:text-red-500",
    badgeCls:
      "border-red-300 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400",
    dotCls: "bg-red-500",
  },
  RESTORE: {
    icon: RotateCcw,
    label: "Восстановление",
    shortLabel: "Восстановлено",
    color: "text-purple-600 dark:text-purple-500",
    badgeCls:
      "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800/50 dark:bg-purple-950/30 dark:text-purple-400",
    dotCls: "bg-purple-500",
  },
} as const;

// ─── Вспомогательные функции ─────────────────────────────────────────────────

/** Форматирует значение для отображения пользователю */
function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (typeof value === "number") return value.toLocaleString("ru-RU");
  if (typeof value === "string") {
    // ISO-дата/время
    if (/^\d{4}-\d{2}-\d{2}(T|\s)/.test(value)) {
      try {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
          return value.includes("T") || value.includes(" ")
            ? format(d, "dd.MM.yyyy HH:mm", { locale: ru })
            : format(d, "dd.MM.yyyy", { locale: ru });
        }
      } catch {}
    }
    // Дата без времени
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      try {
        const d = new Date(value + "T00:00:00");
        if (!isNaN(d.getTime())) return format(d, "dd.MM.yyyy", { locale: ru });
      } catch {}
    }
    return value;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Метка даты группы (Сегодня / Вчера / дата) */
function formatDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return "Сегодня";
  if (isYesterday(d)) return "Вчера";
  return format(d, "d MMMM yyyy", { locale: ru });
}

/** Определяет, является ли запись результатом отката */
function isRollbackResult(entry: AuditEntry): boolean {
  return !!entry.userName?.includes("откат");
}

/** Текстовая расшифровка типа отката */
function rollbackLabel(userName: string): string {
  if (userName.includes("откат создания")) return "Откат создания";
  if (userName.includes("откат изменения")) return "Откат изменения";
  if (userName.includes("откат удаления")) return "Откат удаления";
  return "Откат";
}

/** Очищает имя пользователя от пометок об откате */
function cleanUserName(userName: string | null | undefined): string {
  if (!userName) return "Неизвестно";
  return userName.replace(/\s*\(откат.*?\)\s*/g, "").trim();
}

/** Вычисляет видимые изменения из записи аудита */
function computeChanges(
  entry: AuditEntry,
  entityType: string
): Array<{ field: string; label: string; oldVal: unknown; newVal: unknown }> {
  const skip = (field: string) => !isFieldVisible(entityType, field);

  if (entry.operation === "DELETE" && entry.oldData) {
    return Object.keys(entry.oldData)
      .filter((f) => !skip(f))
      .filter((f) => entry.oldData![f] !== null && entry.oldData![f] !== undefined && entry.oldData![f] !== "")
      .map((f) => ({
        field: f,
        label: getFieldLabel(entityType, f),
        oldVal: entry.oldData![f],
        newVal: null,
      }));
  }

  if (entry.operation === "RESTORE" && entry.newData) {
    return Object.keys(entry.newData)
      .filter((f) => !skip(f))
      .filter((f) => entry.newData![f] !== null && entry.newData![f] !== undefined && entry.newData![f] !== "")
      .map((f) => ({
        field: f,
        label: getFieldLabel(entityType, f),
        oldVal: null,
        newVal: entry.newData![f],
      }));
  }

  if (entry.operation === "CREATE" && entry.newData) {
    return Object.keys(entry.newData)
      .filter((f) => !skip(f))
      .filter((f) => entry.newData![f] !== null && entry.newData![f] !== undefined && entry.newData![f] !== "")
      .map((f) => ({
        field: f,
        label: getFieldLabel(entityType, f),
        oldVal: null,
        newVal: entry.newData![f],
      }));
  }

  // UPDATE — только changedFields
  if (entry.changedFields && entry.changedFields.length > 0) {
    return entry.changedFields
      .filter((f) => !skip(f))
      .filter((f) => {
        const o = entry.oldData?.[f];
        const n = entry.newData?.[f];
        // Пропускаем если оба null/undefined
        return !(
          (o === null || o === undefined || o === "") &&
          (n === null || n === undefined || n === "")
        );
      })
      .map((f) => ({
        field: f,
        label: getFieldLabel(entityType, f),
        oldVal: entry.oldData?.[f],
        newVal: entry.newData?.[f],
      }));
  }

  return [];
}

/** Краткая сводка изменённых полей для превью строки */
function changeSummary(
  entry: AuditEntry,
  entityType: string
): string | null {
  if (entry.operation === "CREATE") return "Новая запись";
  if (entry.operation === "DELETE") return "Запись удалена";
  if (entry.operation === "RESTORE") return "Запись восстановлена";

  if (entry.changedFields && entry.changedFields.length > 0) {
    const visible = entry.changedFields.filter((f) =>
      isFieldVisible(entityType, f)
    );
    if (visible.length === 0) return null;
    const labels = visible.slice(0, 3).map((f) => getFieldLabel(entityType, f));
    const suffix = visible.length > 3 ? ` +${visible.length - 3}` : "";
    return labels.join(", ") + suffix;
  }
  return null;
}

// ─── Компонент детального просмотра изменений ───────────────────────────────

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
      <p className="text-xs text-muted-foreground italic px-1">
        Подробности недоступны
      </p>
    );
  }

  if (entry.operation === "CREATE") {
    return (
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground mb-2 font-medium">
          Созданные данные:
        </p>
        <div className="grid gap-1">
          {changes.map(({ field, label, newVal }) => (
            <div key={field} className="flex items-baseline gap-2 text-xs">
              <span className="text-muted-foreground min-w-[120px] shrink-0">
                {label}
              </span>
              <span className="font-medium text-foreground break-words">
                {formatValue(newVal)}
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
        <p className="text-xs text-muted-foreground mb-2 font-medium">
          Удалённые данные:
        </p>
        <div className="grid gap-1">
          {changes.map(({ field, label, oldVal }) => (
            <div key={field} className="flex items-baseline gap-2 text-xs">
              <span className="text-muted-foreground min-w-[120px] shrink-0">
                {label}
              </span>
              <span className="line-through text-red-600 dark:text-red-400 font-medium break-words">
                {formatValue(oldVal)}
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
        <p className="text-xs text-muted-foreground mb-2 font-medium">
          Восстановленные данные:
        </p>
        <div className="grid gap-1">
          {changes.map(({ field, label, newVal }) => (
            <div key={field} className="flex items-baseline gap-2 text-xs">
              <span className="text-muted-foreground min-w-[120px] shrink-0">
                {label}
              </span>
              <span className="text-purple-700 dark:text-purple-400 font-medium break-words">
                {formatValue(newVal)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // UPDATE — показываем "было → стало"
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-2 font-medium">
        Изменения:
      </p>
      <div className="grid gap-3">
        {changes.map(({ field, label, oldVal, newVal }) => (
          <div key={field} className="space-y-1">
            <p className="text-xs font-medium text-foreground">{label}</p>
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 line-through break-words max-w-[160px]">
                {formatValue(oldVal)}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold break-words max-w-[160px]">
                {formatValue(newVal)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Строка записи аудита ────────────────────────────────────────────────────

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
    ACTION_CONFIG[entry.operation as keyof typeof ACTION_CONFIG] ||
    ACTION_CONFIG.UPDATE;
  const Icon = config.icon;
  const isRolledBack = !!entry.rolledBackAt;
  const isEntityDeleted = !!entry.entityDeleted;
  const isRollbackEntry = isRollbackResult(entry);
  const summary = changeSummary(entry, entityType);
  const canRollback =
    isAdmin &&
    ["CREATE", "UPDATE", "DELETE"].includes(entry.operation) &&
    !isRolledBack &&
    !isEntityDeleted;

  const timeStr = format(new Date(entry.createdAt), "HH:mm", { locale: ru });
  const userName = cleanUserName(entry.userName);

  return (
    <>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <div
            className={cn(
              "group flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
              "hover:bg-muted/60",
              expanded && "bg-muted/40",
              isRolledBack && "opacity-60"
            )}
          >
            {/* Иконка действия */}
            <div
              className={cn(
                "mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0",
                "bg-background border",
                config.color
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>

            {/* Основная информация */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Время */}
                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                  {timeStr}
                </span>

                {/* Пользователь */}
                <span className="flex items-center gap-1 text-xs font-semibold text-foreground">
                  <User className="h-3 w-3 text-muted-foreground" />
                  {userName}
                </span>

                {/* Бейдж действия */}
                <Badge
                  variant="outline"
                  className={cn("text-[10px] px-1.5 py-0 h-4", config.badgeCls)}
                >
                  {isRollbackEntry
                    ? rollbackLabel(entry.userName || "")
                    : config.label}
                </Badge>

                {/* Удалённая запись */}
                {isEntityDeleted && entry.operation !== "DELETE" && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4 border-muted-foreground/30 text-muted-foreground"
                  >
                    Запись удалена
                  </Badge>
                )}

                {/* Уже откачено */}
                {isRolledBack && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4 border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800/50 dark:bg-orange-950/30 dark:text-orange-400"
                  >
                    Откат выполнен
                  </Badge>
                )}
              </div>

              {/* Краткое описание */}
              {summary && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {summary}
                </p>
              )}

              {/* Информация об откате */}
              {isRolledBack && entry.rolledBackAt && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Откат:{" "}
                  {format(
                    new Date(entry.rolledBackAt),
                    "dd.MM.yyyy в HH:mm",
                    { locale: ru }
                  )}
                </p>
              )}
            </div>

            {/* Правая часть: кнопки и chevron */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Кнопка отката (только admin) */}
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

// ─── Группа по дате ──────────────────────────────────────────────────────────

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
      {/* Заголовок даты */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 w-full py-2 px-1 text-left group"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            collapsed && "-rotate-90"
          )}
        />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <span className="text-xs text-muted-foreground/60 font-normal">
          ({entries.length})
        </span>
        <div className="flex-1 h-px bg-border/50 ml-1" />
      </button>

      {/* Записи дня */}
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

// ─── Главный компонент панели ─────────────────────────────────────────────────

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

  // Группировка по дате (YYYY-MM-DD), сортировка: свежие сверху
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
          <SheetDescription className="text-xs">
            {entityName ? (
              <>
                <span className="text-muted-foreground">{entityLabel}: </span>
                <span className="font-medium text-foreground">{entityName}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{entityLabel}</span>
            )}
            {isAdmin && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-600 dark:text-amber-500">
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
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <History className="h-6 w-6 text-muted-foreground opacity-50" />
                </div>
                <p className="text-sm text-muted-foreground">
                  История изменений пуста
                </p>
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

                {/* Загрузить ещё */}
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

        {/* Нижняя панель */}
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
