import {
  AlertTriangle,
  Clock3,
  Loader2,
  Package,
  RotateCcw,
  Warehouse,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PRODUCT_TYPE } from "@shared/constants";

export interface RecalculationIssue {
  id: string;
  recordName: string;
  recordType: "warehouse" | "equipment";
  productType: string;
  afterDate: string;
  status: "pending" | "processing" | "failed";
  attempts: number;
  maxAttempts: number;
  safeMessage: string;
  nextAction: string;
}

interface RecalculationIssuesAlertProps {
  issues: RecalculationIssue[];
  isLoading?: boolean;
  isAdmin?: boolean;
  restartingIssueId?: string | null;
  onRestart?: (issue: RecalculationIssue) => void;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatProductType(productType: string): string {
  switch (productType) {
    case PRODUCT_TYPE.KEROSENE:
      return "Керосин";
    case PRODUCT_TYPE.PVKJ:
      return "ПВКЖ";
    case PRODUCT_TYPE.SERVICE:
      return "Услуга";
    case PRODUCT_TYPE.STORAGE:
      return "Хранение";
    case PRODUCT_TYPE.AGENT:
      return "Агент";
    default:
      return productType;
  }
}

function RecalculationIssueRow({
  issue,
  isAdmin,
  isRestarting,
  onRestart,
}: {
  issue: RecalculationIssue;
  isAdmin: boolean;
  isRestarting: boolean;
  onRestart?: (issue: RecalculationIssue) => void;
}) {
  const isFailed = issue.status === "failed";
  const isProcessing = issue.status === "processing";
  const RecordIcon = issue.recordType === "warehouse" ? Warehouse : Package;
  const StatusIcon = isFailed
    ? AlertTriangle
    : isProcessing
      ? Loader2
      : Clock3;
  const statusLabel = isFailed
    ? "Требуется внимание"
    : isProcessing
      ? "Пересчёт выполняется"
      : "Ожидает повтора";

  return (
    <li
      className={`rounded-md border p-3 sm:p-4 ${
        isFailed
          ? "border-destructive/30 bg-destructive/[0.045]"
          : "border-amber-600/20 bg-amber-500/[0.045]"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <RecordIcon
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 ${
                isFailed ? "text-destructive" : "text-amber-700 dark:text-amber-400"
              }`}
            />
            <span className="break-words font-medium">{issue.recordName}</span>
            <Badge variant="outline" className="font-normal">
              {issue.recordType === "warehouse" ? "Склад" : "Оборудование"}
            </Badge>
            <Badge variant="secondary" className="font-normal">
              {formatProductType(issue.productType)}
            </Badge>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {issue.safeMessage}
          </p>
          <p className="text-sm">
            <span className="font-medium">Дальнейшее действие: </span>
            <span className="text-muted-foreground">{issue.nextAction}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground sm:flex-col sm:items-end sm:gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-col sm:items-end sm:gap-2">
            <span
              className={`inline-flex items-center gap-1.5 font-medium ${
                isFailed
                  ? "text-destructive"
                  : "text-amber-800 dark:text-amber-300"
              }`}
            >
              <StatusIcon
                aria-hidden="true"
                className={`h-3.5 w-3.5 ${isProcessing ? "animate-spin" : ""}`}
              />
              {statusLabel}
            </span>
            <span>С {formatDate(issue.afterDate)}</span>
            <span>
              Попытка {issue.attempts} из {issue.maxAttempts}
            </span>
          </div>
          {isAdmin && isFailed && onRestart && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isRestarting}
              onClick={() => onRestart(issue)}
              aria-label={`Перезапустить пересчёт: ${issue.recordName}`}
            >
              {isRestarting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Перезапустить
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

export function RecalculationIssuesAlert({
  issues,
  isLoading = false,
  isAdmin = false,
  restartingIssueId = null,
  onRestart,
}: RecalculationIssuesAlertProps) {
  if (isLoading) {
    return (
      <div
        aria-label="Загрузка сведений о пересчёте"
        className="space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (issues.length === 0) return null;

  const failedCount = issues.filter((issue) => issue.status === "failed").length;
  const hasFailed = failedCount > 0;

  return (
    <Alert
      className={`space-y-3 ${
        hasFailed
          ? "border-destructive/35 bg-destructive/[0.025]"
          : "border-amber-600/30 bg-amber-500/[0.025]"
      }`}
    >
      {hasFailed ? (
        <AlertTriangle aria-hidden="true" className="h-4 w-4" />
      ) : (
        <Clock3 aria-hidden="true" className="h-4 w-4" />
      )}
      <AlertTitle className="flex flex-wrap items-center gap-2">
        <span>
          {hasFailed
            ? "Есть проблемы с пересчётом остатков"
            : "Пересчёт остатков"}
        </span>
        <Badge variant={hasFailed ? "destructive" : "outline"}>
          {issues.length}{" "}
          {issues.length === 1
            ? "запись"
            : issues.length >= 2 && issues.length <= 4
              ? "записи"
              : "записей"}
        </Badge>
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          До завершения пересчёта текущие остатки могут быть неактуальны.
          {hasFailed
            ? ` Требуют внимания: ${failedCount}.`
            : " Система продолжает обработку автоматически."}
        </p>
        <ul className="space-y-2">
          {issues.map((issue) => (
            <RecalculationIssueRow
              key={issue.id}
              issue={issue}
              isAdmin={isAdmin}
              isRestarting={restartingIssueId === issue.id}
              onRestart={onRestart}
            />
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
