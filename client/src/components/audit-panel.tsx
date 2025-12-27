
import { useState } from "react";
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
} from "lucide-react";
import { useAudit, type AuditEntry } from "@/hooks/use-audit";
import { cn } from "@/lib/utils";

interface AuditPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
  entityName?: string;
}

const ACTION_CONFIG = {
  create: {
    icon: Plus,
    label: "Создание",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950",
  },
  update: {
    icon: Pencil,
    label: "Изменение",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950",
  },
  delete: {
    icon: Trash2,
    label: "Удаление",
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950",
  },
};

function AuditEntryItem({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const config = ACTION_CONFIG[entry.action];
  const Icon = config.icon;

  const hasChanges = entry.changes && Object.keys(entry.changes).length > 0;

  return (
    <div className={cn("p-4 rounded-lg border", config.bgColor)}>
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-full bg-background", config.color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={config.color}>
              {config.label}
            </Badge>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span className="font-medium">{entry.userName}</span>
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

          {hasChanges && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={() => setExpanded(!expanded)}
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                {expanded ? "Скрыть изменения" : "Показать изменения"}
                {expanded ? (
                  <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                )}
              </Button>

              {expanded && (
                <div className="mt-3 p-3 bg-background rounded border space-y-2">
                  {Object.entries(entry.changes).map(([field, change]: [string, any]) => (
                    <div key={field} className="text-sm">
                      <div className="font-medium text-foreground mb-1">
                        {field}
                      </div>
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground mb-0.5">
                            Было:
                          </div>
                          <div className="font-mono text-xs bg-muted p-2 rounded">
                            {change.old !== null && change.old !== undefined
                              ? String(change.old)
                              : "—"}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground mb-0.5">
                            Стало:
                          </div>
                          <div className="font-mono text-xs bg-muted p-2 rounded">
                            {change.new !== null && change.new !== undefined
                              ? String(change.new)
                              : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
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
                <AuditEntryItem key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="absolute bottom-4 left-6 right-6">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            Обновить историю
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
