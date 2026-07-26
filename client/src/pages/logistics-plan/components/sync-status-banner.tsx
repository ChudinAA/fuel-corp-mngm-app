import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CheckCircle, Clock, AlertTriangle, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SyncStatusBannerProps {
  syncData: any;
  periodFrom: string;
  periodTo: string;
}

/**
 * Shown when the active sync uses a non-null scenarioId (alternative scenario).
 * Dismissed state is stored in localStorage per period+scenario.
 */
function AlternativeScenarioBanner({
  scenarioId,
  periodFrom,
}: {
  scenarioId: string;
  periodFrom: string;
}) {
  const storageKey = `alt-scenario-dismissed-${periodFrom}-${scenarioId}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const { data: scenarios = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/planning/scenarios"],
    queryFn: async () => (await apiRequest("GET", "/api/planning/scenarios")).json(),
    enabled: !dismissed,
  });

  const scenarioName = scenarios.find((s) => s.id === scenarioId)?.name;

  const handleDismiss = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {}
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="flex items-start gap-3 rounded-md border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-500 px-4 py-3 text-sm">
      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-amber-800 dark:text-amber-300">
          Запущен альтернативный сценарий планирования
          {scenarioName ? (
            <span className="font-normal"> — «{scenarioName}»</span>
          ) : null}
        </p>
        <p className="text-amber-700 dark:text-amber-400 mt-0.5 text-xs leading-relaxed">
          На выбранный месяц в логистику запущен альтернативный сценарий.
          Рекомендуется проверить и при необходимости скорректировать маршруты и распределение транспорта.
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-amber-600 hover:text-amber-800 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/40"
        onClick={handleDismiss}
        title="Скрыть уведомление"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function SyncStatusBanner({ syncData, periodFrom, periodTo }: SyncStatusBannerProps) {
  if (!syncData?.latest) return null;

  const latest = syncData.latest;
  const createdAt = latest.createdAt
    ? format(new Date(latest.createdAt), "dd.MM.yy HH:mm", { locale: ru })
    : "—";

  const isAltScenario = !!latest.scenarioId;

  return (
    <div className="flex flex-col gap-2">
      {/* Main sync status */}
      <div
        className={cn(
          "flex items-center gap-3 rounded-md border px-4 py-2 text-sm",
          isAltScenario
            ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
            : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
        )}
      >
        <CheckCircle
          className={cn(
            "h-4 w-4 shrink-0",
            isAltScenario
              ? "text-blue-600 dark:text-blue-400"
              : "text-green-600 dark:text-green-400",
          )}
        />
        <span
          className={cn(
            isAltScenario
              ? "text-blue-800 dark:text-blue-300"
              : "text-green-800 dark:text-green-300",
          )}
        >
          Ежемесячный план синхронизирован с логистикой{" "}
          <strong>{createdAt}</strong>
          {isAltScenario && (
            <span className="ml-2 text-xs font-medium text-blue-600 dark:text-blue-400">
              (альтернативный сценарий)
            </span>
          )}
        </span>
      </div>

      {/* Alternative scenario global warning banner */}
      {isAltScenario && (
        <AlternativeScenarioBanner
          scenarioId={latest.scenarioId}
          periodFrom={periodFrom}
        />
      )}
    </div>
  );
}
