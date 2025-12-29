import { useState, useMemo } from "react";
import * as React from "react";
import { format } from "date-fns";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  History,
  User,
  Plus,
  Pencil,
  Trash2,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  Undo2,
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
import { useAudit, type AuditEntry } from "@/hooks/use-audit";
import { useRollback } from "@/hooks/use-rollback";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { getFieldLabel } from "@/lib/field-labels";

interface AuditPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
  entityName?: string;
}

const ACTION_CONFIG: Record<string, {
  icon: any;
  label: string;
  color: string;
  bgColor: string;
}> = {
  CREATE: {
    icon: Plus,
    label: "Создание",
    color: "text-green-600 dark:text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/30",
  },
  UPDATE: {
    icon: Pencil,
    label: "Изменение",
    color: "text-blue-600 dark:text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
  DELETE: {
    icon: Trash2,
    label: "Удаление",
    color: "text-red-600 dark:text-red-500",
    bgColor: "bg-red-50 dark:bg-red-950/30",
  },
  RESTORE: {
    icon: History,
    label: "Восстановление",
    color: "text-purple-600 dark:text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
  },
};

function AuditEntryItem({
  entry,
  entityType,
  onRollback,
}: {
  entry: AuditEntry;
  entityType: string;
  onRollback: (auditLogId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const { hasPermission } = useAuth();
  const config = ACTION_CONFIG[entry.operation] || ACTION_CONFIG.UPDATE;
  const Icon = config.icon;

  // Check if this entry has been rolled back
  const isRolledBack = !!entry.rolledBackAt;

  // Check if the entity was later deleted (for CREATE/UPDATE operations)
  const isEntityDeleted = !!entry.entityDeleted;

  // Check if rollback is available for this operation
  const canRollback = ['CREATE', 'UPDATE', 'DELETE'].includes(entry.operation) && !isEntityDeleted;

  // Map entity type to permission module
  const getPermissionModule = (entityType: string): string => {
    const moduleMap: Record<string, string> = {
      'opt': 'opt',
      'aircraft_refueling': 'refueling',
      'movement': 'movement',
      'exchange': 'exchange',
      'warehouses': 'warehouses',
      'prices': 'prices',
      'suppliers': 'directories',
      'customers': 'directories',
      'bases': 'directories',
      'logistics_carriers': 'directories',
      'logistics_delivery_locations': 'directories',
      'logistics_vehicles': 'directories',
      'logistics_trailers': 'directories',
      'logistics_drivers': 'directories',
      'delivery_cost': 'delivery',
      'users': 'users',
      'roles': 'roles',
    };
    return moduleMap[entityType] || entityType;
  };

  const hasEditPermission = hasPermission(getPermissionModule(entityType), 'edit');

  const handleRollback = () => {
    setShowRollbackDialog(false);
    onRollback(entry.id);
  };

  // Calculate actual changes from oldData and newData
  const changes = React.useMemo(() => {
    // For DELETE (user action), show all old data
    if (entry.operation === 'DELETE' && entry.oldData) {
      const result: Record<string, { old: any; new: any }> = {};
      Object.keys(entry.oldData).forEach(field => {
        // Skip metadata and technical fields
        if (['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdById', 'updatedById', 'deletedById', 'transactionId'].includes(field)) {
          return;
        }
        result[field] = { old: entry.oldData[field], new: null };
      });
      return Object.keys(result).length > 0 ? result : null;
    }

    // For RESTORE (rollback of DELETE), show all restored data
    if (entry.operation === 'RESTORE' && entry.newData) {
      const result: Record<string, { old: any; new: any }> = {};
      Object.keys(entry.newData).forEach(field => {
        // Skip metadata and technical fields
        if (['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdById', 'updatedById', 'deletedById', 'transactionId'].includes(field)) {
          return;
        }
        result[field] = { old: null, new: entry.newData[field] };
      });
      return Object.keys(result).length > 0 ? result : null;
    }

    // For CREATE, show all created data (unless it's a rollback result)
    if (entry.operation === 'CREATE') {
      // Check if this is a rollback result by looking at userName
      if (entry.userName?.includes('откат')) return null;
      
      // Show created data
      if (entry.newData) {
        const result: Record<string, { old: any; new: any }> = {};
        Object.keys(entry.newData).forEach(field => {
          // Skip metadata and technical fields
          if (['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdById', 'updatedById', 'deletedById', 'transactionId'].includes(field)) {
            return;
          }
          result[field] = { old: null, new: entry.newData[field] };
        });
        return Object.keys(result).length > 0 ? result : null;
      }
      return null;
    }

    // For UPDATE, use changedFields from backend (already normalized)
    if (!entry.changedFields || entry.changedFields.length === 0) return null;

    const result: Record<string, { old: any; new: any }> = {};

    entry.changedFields.forEach(field => {
      result[field] = {
        old: entry.oldData?.[field],
        new: entry.newData?.[field]
      };
    });

    return result;
  }, [entry]);

  const hasChanges = changes && Object.keys(changes).length > 0;

  return (
    <div className={cn("p-4 rounded-lg border", config.bgColor)}>
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-full bg-background", config.color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={config.color}>
                {config.label}
              </Badge>
              {entry.userName?.includes('откат') ? (
                <Badge variant="outline" className="bg-orange-50/50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-800/30 font-bold">
                  {entry.userName.includes('откат создания') ? 'Откат создания' :
                   entry.userName.includes('откат изменения') ? 'Откат изменения' :
                   entry.userName.includes('откат удаления') ? 'Откат удаления' : 'Откат'}
                </Badge>
              ) : null}
              {isEntityDeleted && entry.operation !== 'DELETE' ? (
                <Badge variant="outline" className="bg-gray-50/50 dark:bg-gray-950/20 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700/30">
                  Запись была удалена
                </Badge>
              ) : null}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span className="font-medium">{entry.userName?.replace(/\s*\(откат.*?\)\s*/g, '')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {format(new Date(entry.createdAt), "dd MMM yyyy, HH:mm", {
                    locale: ru,
                  })}
                </span>
              </div>
            </div>
            {((['CREATE', 'UPDATE', 'DELETE'].includes(entry.operation)) && hasEditPermission) && (
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => setShowRollbackDialog(true)}
                disabled={isRolledBack || isEntityDeleted}
                title={isEntityDeleted ? 'Запись была удалена. Откатите операцию удаления.' : ''}
              >
                <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                {isRolledBack ? 'Откачено' : isEntityDeleted ? 'Недоступно' : 'Откатить'}
              </Button>
            )}
          </div>

          {hasChanges && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={() => setExpanded(!expanded)}
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                {expanded
                  ? (entry.operation === 'DELETE' ? "Скрыть удалённые данные" : 
                     entry.operation === 'RESTORE' ? "Скрыть восстановленные данные" : 
                     entry.operation === 'CREATE' ? "Скрыть созданные данные" : 
                     "Скрыть изменения")
                  : (entry.operation === 'DELETE' ? "Показать удалённые данные" : 
                     entry.operation === 'RESTORE' ? "Показать восстановленные данные" : 
                     entry.operation === 'CREATE' ? "Показать созданные данные" : 
                     "Показать изменения")
                }
                {expanded ? (
                  <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                )}
              </Button>

              {expanded && changes && (
                <div className="mt-3 p-3 bg-background rounded border space-y-2">
                  {Object.entries(changes).map(([field, change]: [string, any]) => (
                    <div key={field} className="text-sm">
                      <div className="font-medium text-foreground mb-1">
                        {getFieldLabel(entityType, field)}
                      </div>
                      <div className="flex items-start gap-2 text-muted-foreground">
                        {entry.operation === 'RESTORE' ? (
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-muted-foreground mb-0.5">
                              Восстановленное значение:
                            </div>
                            <div className="font-mono text-xs bg-muted p-2 rounded break-words whitespace-pre-wrap overflow-wrap-anywhere">
                              {change.new !== null && change.new !== undefined && change.new !== ''
                                ? String(change.new)
                                : "—"}
                            </div>
                          </div>
                        ) : entry.operation === 'DELETE' ? (
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-muted-foreground mb-0.5">
                              Удалённое значение:
                            </div>
                            <div className="font-mono text-xs bg-muted p-2 rounded break-all whitespace-normal overflow-wrap-anywhere">
                              {change.old !== null && change.old !== undefined && change.old !== ''
                                ? String(change.old)
                                : "—"}
                            </div>
                          </div>
                        ) : entry.operation === 'CREATE' ? (
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-muted-foreground mb-0.5">
                              Созданное значение:
                            </div>
                            <div className="font-mono text-xs bg-muted p-2 rounded break-all whitespace-normal overflow-wrap-anywhere">
                              {change.new !== null && change.new !== undefined && change.new !== ''
                                ? String(change.new)
                                : "—"}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-muted-foreground mb-0.5">
                                Было:
                              </div>
                              <div className="font-mono text-xs bg-muted p-2 rounded break-all whitespace-normal overflow-wrap-anywhere">
                                {change.old !== null && change.old !== undefined && change.old !== ''
                                  ? String(change.old)
                                  : "—"}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-muted-foreground mb-0.5">
                                Стало:
                              </div>
                              <div className="font-mono text-xs bg-muted p-2 rounded break-all whitespace-normal overflow-wrap-anywhere">
                                {change.new !== null && change.new !== undefined && change.new !== ''
                                  ? String(change.new)
                                  : "—"}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <AlertDialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтверждение отката</AlertDialogTitle>
            <AlertDialogDescription>
              {entry.operation === 'CREATE' &&
                'Это действие удалит созданную запись. Вы уверены?'}
              {entry.operation === 'UPDATE' &&
                'Это действие восстановит предыдущие значения полей. Вы уверены?'}
              {entry.operation === 'DELETE' &&
                'Это действие восстановит удалённую запись. Вы уверены?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleRollback}>
              Откатить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function AuditPanel({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
}: AuditPanelProps) {
  const { auditHistory, isLoading, refetch } = useAudit({
    entityType,
    entityId,
    enabled: open,
  });
  const { rollback, isRollingBack } = useRollback();

  const handleRollback = (auditLogId: string) => {
    rollback(auditLogId, {
      onSuccess: () => {
        // Refresh audit history after successful rollback
        refetch();
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            История изменений
          </SheetTitle>
          <SheetDescription>
            {entityName
              ? `История изменений для "${entityName}"`
              : "История изменений записи"}
          </SheetDescription>
        </SheetHeader>

        <Separator className="my-4" />

        <ScrollArea className="h-[calc(100vh-120px)] pr-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 border rounded-lg">
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : auditHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground">
                История изменений пока отсутствует
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {auditHistory.map((entry) => (
                <AuditEntryItem
                  key={entry.id}
                  entry={entry}
                  entityType={entityType}
                  onRollback={handleRollback}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="absolute bottom-4 left-6 right-6">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => refetch()}
            disabled={isLoading || isRollingBack}
          >
            {isRollingBack ? "Выполняется откат..." : "Обновить историю"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}